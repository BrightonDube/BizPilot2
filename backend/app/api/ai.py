"""AI Assistant API endpoints."""

from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
import time
import hashlib
from datetime import datetime, timedelta
import logging
import re

from app.core.database import get_db
from app.core.config import settings
from app.api.deps import get_current_active_user
from app.core.subscription import require_feature
from app.models.user import User
from app.models.user_settings import AIDataSharingLevel
from app.services.ai_service import AIService
from app.services.marketing_ai_context import MarketingAIContextManager

router = APIRouter(prefix="/ai", tags=["AI Assistant"])

# In-memory rate limiting store (in production, use Redis)
guest_rate_limits = {}

# In-memory cache for common marketing responses (in production, use Redis)
marketing_response_cache = {}
CACHE_TTL = 3600  # 1 hour cache TTL

# Set up logging for guest AI
logger = logging.getLogger("guest_ai")
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

# In-memory rate limiting store (in production, use Redis)
guest_rate_limits = {}

def sanitize_input(text: str) -> str:
    """Sanitize user input to prevent injection attacks and clean up content."""
    if not text:
        return ""
    
    # Remove potentially dangerous characters and patterns
    text = re.sub(r'[<>"\'\`]', '', text)  # Remove HTML/script injection chars
    text = re.sub(r'javascript:', '', text, flags=re.IGNORECASE)  # Remove javascript: protocol
    text = re.sub(r'data:', '', text, flags=re.IGNORECASE)  # Remove data: protocol
    text = re.sub(r'vbscript:', '', text, flags=re.IGNORECASE)  # Remove vbscript: protocol
    
    # Remove excessive whitespace and normalize
    text = ' '.join(text.split())
    
    # Limit length to prevent abuse
    if len(text) > 1000:
        text = text[:1000]
    
    return text.strip()


def get_cache_key(message: str, session_id: str = None) -> str:
    """Generate cache key for marketing responses."""
    # Normalize message for caching
    normalized = message.lower().strip()
    # Create hash to avoid key length issues
    key_data = f"marketing_ai:{normalized}:{session_id or 'anonymous'}"
    return hashlib.md5(key_data.encode()).hexdigest()


def get_cached_response(cache_key: str) -> Optional[str]:
    """Get cached marketing response if available and not expired."""
    if cache_key in marketing_response_cache:
        cached_data = marketing_response_cache[cache_key]
        if time.time() - cached_data['timestamp'] < CACHE_TTL:
            return cached_data['response']
        else:
            # Remove expired cache entry
            del marketing_response_cache[cache_key]
    return None


def cache_response(cache_key: str, response: str):
    """Cache marketing response with timestamp."""
    # Limit cache size to prevent memory issues
    if len(marketing_response_cache) >= 1000:
        # Remove oldest entries (simple LRU)
        oldest_key = min(marketing_response_cache.keys(), 
                        key=lambda k: marketing_response_cache[k]['timestamp'])
        del marketing_response_cache[oldest_key]
    
    marketing_response_cache[cache_key] = {
        'response': response,
        'timestamp': time.time()
    }


def detect_abuse_patterns(message: str, client_ip: str) -> bool:
    """Detect potential abuse patterns in user input."""
    message_lower = message.lower()
    
    # Check for spam patterns
    spam_indicators = [
        len(set(message)) < 5,  # Very low character diversity
        message.count('http') > 2,  # Multiple URLs
        message.count('@') > 3,  # Multiple email addresses
        len(message.split()) > 200,  # Extremely long message
        message.count(message[0]) > len(message) * 0.5 if message else False,  # Repeated characters
    ]
    
    if any(spam_indicators):
        logger.warning(f"Potential spam detected from IP {client_ip}: {message[:100]}")
        return True
    
    # Check for injection attempts
    injection_patterns = [
        r'<script',
        r'javascript:',
        r'eval\(',
        r'document\.',
        r'window\.',
        r'alert\(',
        r'prompt\(',
        r'confirm\(',
        r'onload=',
        r'onerror=',
    ]
    
    for pattern in injection_patterns:
        if re.search(pattern, message_lower):
            logger.warning(f"Potential injection attempt from IP {client_ip}: {pattern}")
            return True
    
    return False


def get_client_ip(request: Request) -> str:
    """Get client IP address for rate limiting."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

def check_guest_rate_limit(client_ip: str, session_id: str = None) -> tuple[bool, int, int]:
    """
    Check rate limits for guest users.
    Returns (allowed, remaining, reset_time)
    """
    now = int(time.time())
    key = f"guest_{session_id or client_ip}"
    
    # Clean up old entries
    guest_rate_limits.clear() if len(guest_rate_limits) > 10000 else None
    
    if key not in guest_rate_limits:
        guest_rate_limits[key] = {
            'count': 0,
            'reset_time': now + 3600,  # 1 hour window
            'session_count': 0,
            'session_reset': now + 1800  # 30 minute session
        }
    
    rate_data = guest_rate_limits[key]
    
    # Reset counters if time window has passed
    if now >= rate_data['reset_time']:
        rate_data['count'] = 0
        rate_data['reset_time'] = now + 3600
    
    if now >= rate_data['session_reset']:
        rate_data['session_count'] = 0
        rate_data['session_reset'] = now + 1800
    
    # Check limits (50 per hour, 20 per session)
    hourly_limit = 50
    session_limit = 20
    
    if rate_data['count'] >= hourly_limit or rate_data['session_count'] >= session_limit:
        return False, 0, rate_data['reset_time']
    
    # Increment counters
    rate_data['count'] += 1
    rate_data['session_count'] += 1
    
    remaining = min(
        hourly_limit - rate_data['count'],
        session_limit - rate_data['session_count']
    )
    
    return True, remaining, rate_data['reset_time']


class ChatRequest(BaseModel):
    """Chat request schema."""
    message: str
    conversation_id: Optional[str] = None


class GuestChatRequest(BaseModel):
    """Guest chat request schema."""
    message: str
    conversation_id: Optional[str] = None
    session_id: Optional[str] = None


class GuestChatResponse(BaseModel):
    """Guest chat response schema."""
    response: str
    conversation_id: Optional[str] = None
    rate_limit_remaining: int
    rate_limit_reset: int


class ChatResponse(BaseModel):
    """Chat response schema."""
    response: str
    conversation_id: Optional[str] = None


class ConversationCreateRequest(BaseModel):
    title: Optional[str] = None


class ConversationResponse(BaseModel):
    id: str
    title: str

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    is_user: bool
    content: str

    model_config = {"from_attributes": True}


class ContextResponse(BaseModel):
    ai_data_sharing_level: str
    app_context: dict[str, Any]
    business_context: dict[str, Any]


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: User = Depends(require_feature("ai_insights")),
    db: Session = Depends(get_db),
):
    """
    Chat with the AI assistant.
    
    The AI assistant can help with:
    - Business insights and analytics
    - Product recommendations
    - Inventory management suggestions
    - Customer behavior analysis
    - Financial reporting questions
    """
    # If AI isn't configured, return a clear client error.
    # The frontend can handle this by showing a setup/config message.
    if not settings.OPENAI_API_KEY and not settings.GROQ_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="AI is not configured. Set GROQ_API_KEY (recommended) or OPENAI_API_KEY on the backend.",
        )

    svc = AIService(db)
    try:
        resp = await svc.send_message(
            user=current_user,
            content=request.message,
            conversation_id=request.conversation_id,
        )
        return ChatResponse(response=resp["response"], conversation_id=resp.get("conversation_id"))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI provider error while processing request. Please try again later.",
        )


@router.post("/guest-chat", response_model=GuestChatResponse)
async def guest_chat(
    request: GuestChatRequest,
    http_request: Request,
    db: Session = Depends(get_db),
):
    """
    Chat with the AI assistant for guest users (marketing context only).
    
    The marketing AI can help with:
    - BizPilot features and capabilities
    - Pricing information and plan comparisons
    - Industry use cases and applications
    - Getting started guidance
    - Contact information for sales and support
    
    Rate limited to prevent abuse.
    """
    # Get client IP for rate limiting
    client_ip = get_client_ip(http_request)
    
    # Check rate limits
    allowed, remaining, reset_time = check_guest_rate_limit(client_ip, request.session_id)
    if not allowed:
        logger.warning(f"Rate limit exceeded for IP {client_ip}, session {request.session_id}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please try again later or sign up for unlimited access.",
            headers={
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(reset_time)
            }
        )
    
    # Check cache for common responses
    cache_key = get_cache_key(sanitized_message, request.session_id)
    cached_response = get_cached_response(cache_key)
    
    if cached_response:
        logger.info(f"Cache hit for session {request.session_id}")
        return GuestChatResponse(
            response=cached_response,
            conversation_id=request.conversation_id,
            rate_limit_remaining=remaining,
            rate_limit_reset=reset_time
        )
    
    # Enhanced input validation and sanitization
    if not request.message or len(request.message.strip()) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty."
        )
    
    if len(request.message) > 1000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message too long. Please keep messages under 1000 characters."
        )
    
    # Sanitize input to prevent injection attacks
    sanitized_message = sanitize_input(request.message)
    
    if not sanitized_message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message contains invalid content."
        )
    
    # Detect abuse patterns
    if detect_abuse_patterns(sanitized_message, client_ip):
        logger.warning(f"Abuse pattern detected from IP {client_ip}, session {request.session_id}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message content not allowed. Please ask legitimate questions about BizPilot."
        )
    
    # Initialize marketing AI context manager
    marketing_ai = MarketingAIContextManager()
    
    try:
        # Process the question through marketing AI context
        context_result = marketing_ai.process_question(sanitized_message)
        
        # Add logging and monitoring for guest AI usage
        import logging
        from datetime import datetime
        
        # Set up logging for guest AI interactions
        logger = logging.getLogger("guest_ai")
        
        # Log the interaction for monitoring
        logger.info(f"Guest AI interaction - IP: {client_ip}, Session: {request.session_id}, Message length: {len(sanitized_message)}, Valid: {context_result['is_valid']}")
        
        if not context_result['is_valid']:
            # Question is not appropriate for marketing AI
            response_text = context_result.get('response', marketing_ai.validator.get_fallback_response("business_specific"))
            logger.info(f"Guest AI rejected question - Session: {request.session_id}, Reason: Invalid marketing question")
        else:
            # Generate AI response using marketing context
            if settings.GROQ_API_KEY:
                response_text = await generate_marketing_ai_response(
                    sanitized_message, 
                    context_result['knowledge_base'],
                    context_result.get('template_response')
                )
                logger.info(f"Guest AI generated response - Session: {request.session_id}, Response length: {len(response_text)}")
            else:
                # Fallback to template response if AI is not configured
                response_text = context_result.get('template_response') or get_marketing_fallback_response(sanitized_message)
                logger.info(f"Guest AI fallback response - Session: {request.session_id}, Reason: No AI configured")
        
        # Validate response for marketing compliance
        if not marketing_ai.validate_response(response_text):
            response_text = "I can help with general BizPilot questions about features, pricing, and getting started. For specific business advice, please sign up for a free account."
            logger.warning(f"Guest AI response failed validation - Session: {request.session_id}")
        
        # Add contact information if appropriate
        contact_info = context_result.get('contact_info', {})
        if contact_info and 'message' in contact_info:
            response_text += f"\n\n{contact_info['message']}"
            if 'email' in contact_info:
                response_text += f" Contact us at {contact_info['email']}"
            if 'signup_url' in contact_info:
                response_text += f" or get started at {contact_info['signup_url']}"
        
        # Cache the response for future use
        cache_response(cache_key, response_text)
        
        # Log successful response
        logger.info(f"Guest AI successful response - Session: {request.session_id}, Final length: {len(response_text)}")
        
        return GuestChatResponse(
            response=response_text,
            conversation_id=request.conversation_id,
            rate_limit_remaining=remaining,
            rate_limit_reset=reset_time
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Log error but don't expose internal details
        logger.error(f"Guest AI error - Session: {request.session_id}, IP: {client_ip}, Error: {str(e)}")
        
        # Return safe error response
        error_response = "I'm having trouble right now. For immediate help, please contact our sales team at sales@bizpilot.co.za or try our free Pilot Solo tier."
        
        return GuestChatResponse(
            response=error_response,
            conversation_id=request.conversation_id,
            rate_limit_remaining=remaining,
            rate_limit_reset=reset_time
        )


@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(
    current_user: User = Depends(require_feature("ai_insights")),
    db: Session = Depends(get_db),
):
    svc = AIService(db)
    convos = svc.list_conversations(current_user.id)
    return [ConversationResponse(id=str(c.id), title=c.title) for c in convos]


@router.post("/conversations", response_model=ConversationResponse)
async def create_conversation(
    payload: ConversationCreateRequest,
    current_user: User = Depends(require_feature("ai_insights")),
    db: Session = Depends(get_db),
):
    svc = AIService(db)
    convo = svc.create_conversation(current_user.id, payload.title)
    return ConversationResponse(id=str(convo.id), title=convo.title)


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(require_feature("ai_insights")),
    db: Session = Depends(get_db),
):
    svc = AIService(db)
    svc.delete_conversation(current_user.id, conversation_id)
    return {"status": "ok"}


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageResponse])
async def list_messages(
    conversation_id: str,
    current_user: User = Depends(require_feature("ai_insights")),
    db: Session = Depends(get_db),
):
    svc = AIService(db)
    msgs = svc.list_messages(current_user.id, conversation_id)
    return [
        MessageResponse(
            id=str(m.id),
            conversation_id=str(m.conversation_id),
            is_user=bool(m.is_user),
            content=m.content,
        )
        for m in msgs
    ]


@router.post("/conversations/{conversation_id}/messages", response_model=ChatResponse)
async def send_message_to_conversation(
    conversation_id: str,
    request: ChatRequest,
    current_user: User = Depends(require_feature("ai_insights")),
    db: Session = Depends(get_db),
):
    svc = AIService(db)
    resp = await svc.send_message(user=current_user, content=request.message, conversation_id=conversation_id)
    return ChatResponse(response=resp["response"], conversation_id=resp.get("conversation_id"))


@router.get("/context", response_model=ContextResponse)
async def get_ai_context(
    current_user: User = Depends(require_feature("ai_insights")),
    db: Session = Depends(get_db),
):
    svc = AIService(db)
    settings_row = svc.get_or_create_user_settings(current_user.id)
    level: AIDataSharingLevel = settings_row.ai_data_sharing_level
    app_ctx = {} if level == AIDataSharingLevel.NONE else svc.build_app_help_context()
    biz_ctx = {} if level in (AIDataSharingLevel.NONE, AIDataSharingLevel.APP_ONLY) else svc.build_business_context(current_user, level)
    return ContextResponse(
        ai_data_sharing_level=level.value,
        app_context=app_ctx,
        business_context=biz_ctx,
    )


async def generate_ai_response(message: str, user_id, db: Session) -> str:
    """Legacy keyword-based AI response used in tests and fallback mode."""
    message_lower = message.lower()

    if any(word in message_lower for word in ["revenue", "sales", "income", "money"]):
        return """Based on your business data, I can see revenue patterns. To get detailed revenue insights:
        
1. **Go to Reports** - View comprehensive revenue analytics
2. **Check Invoices** - See payment status and outstanding amounts
3. **Review Orders** - Track which products are driving sales

Would you like me to explain any specific revenue metric?"""

    if any(word in message_lower for word in ["product", "inventory", "stock"]):
        return """For product and inventory management, here are some tips:

1. **Low Stock Alerts** - Monitor products with quantity below threshold
2. **Top Sellers** - Focus on restocking high-demand items
3. **Slow Movers** - Consider promotions for slow-selling products

I can help you analyze your inventory trends. What specific aspect would you like to explore?"""

    if any(word in message_lower for word in ["customer", "client"]):
        return """Customer insights are key to business growth. Here's what you can do:

1. **Customer Segments** - Identify your best customers
2. **Purchase Patterns** - Understand buying behavior
3. **Retention** - Track repeat customers

Would you like me to help you understand your customer data better?"""

    if any(word in message_lower for word in ["invoice", "payment", "overdue"]):
        return """For invoice and payment management:

1. **Overdue Invoices** - Check the Invoices page for overdue items
2. **Payment Reminders** - Send automated reminders
3. **Payment Methods** - Accept multiple payment options

Is there a specific invoice or payment question I can help with?"""

    if any(word in message_lower for word in ["order", "orders"]):
        return """Order management tips:

1. **Order Status** - Track orders from creation to fulfillment
2. **Processing Time** - Monitor average processing duration
3. **Order Value** - Analyze average order value trends

How can I help you with your orders?"""

    if any(word in message_lower for word in ["help", "what can you do", "features"]):
        return """I'm your BizPilot AI assistant! I can help you with:

📊 **Business Insights** - Revenue, trends, and analytics
📦 **Inventory** - Stock levels and reorder suggestions  
👥 **Customers** - Customer analysis and segmentation
📝 **Invoices** - Payment tracking and reminders
🛒 **Orders** - Order management and fulfillment

Just ask me anything about your business, and I'll do my best to help!"""

    return """I understand you're asking about your business. I can help you with:

- Revenue and sales analytics
- Inventory management
- Customer insights
- Invoice and payment tracking
- Order management

Could you please be more specific about what you'd like to know? For example:
- "Show me revenue trends"
- "Which products are low on stock?"
- "Who are my top customers?"
"""


def get_fallback_response(message: str) -> str:
    """Get a fallback response when AI is not configured."""
    return """I'm your BizPilot AI assistant. While the AI service is being configured, I can point you to the right places:

📊 **For Analytics** → Go to the Reports page
📦 **For Inventory** → Check the Inventory page
👥 **For Customers** → Visit the Customers page
📝 **For Invoices** → See the Invoices page
🛒 **For Orders** → Check the Orders page

Once AI services are fully configured, I'll be able to provide personalized insights and recommendations based on your business data!"""


async def generate_marketing_ai_response(message: str, knowledge_base: list, template_response: str = None) -> str:
    """Generate AI response using marketing context and knowledge base."""
    if not settings.GROQ_API_KEY:
        return get_marketing_fallback_response(message)
    
    # Build comprehensive marketing-focused system prompt
    system_prompt = f"""You are a helpful AI assistant for BizPilot, a comprehensive business management platform based in South Africa. 
You can ONLY provide information about BizPilot's features, pricing, capabilities, and general business management guidance.

CRITICAL RESTRICTIONS - You MUST follow these rules:
- You cannot access any business data or user information
- You cannot provide business-specific advice or analysis  
- You cannot perform business operations or transactions
- You must redirect business-specific questions to sign up for a free account
- You cannot access authenticated user accounts or settings
- You cannot provide technical support for existing customers
- You cannot make pricing commitments or negotiate contracts

KNOWLEDGE BASE - Use this information to answer questions:
{chr(10).join(knowledge_base)}

RESPONSE GUIDELINES:
- Be helpful, professional, and conversational
- Focus on BizPilot features, benefits, and value propositions
- Include specific pricing information when relevant (Free, R199, R799, R1499, Custom)
- Mention all 5 tiers: Pilot Solo (Free), Pilot Lite (R199), Pilot Core (R799), Pilot Pro (R1499), Enterprise (Custom)
- For Enterprise tier, always mention "Contact sales team for custom pricing"
- Suggest appropriate contact information (sales@bizpilot.co.za for Enterprise, support@bizpilot.co.za for technical)
- Include next steps like signing up for free tier or scheduling a demo
- Keep responses under 400 words and well-structured
- Use South African context and terminology where appropriate
- Always encourage users to try the free Pilot Solo tier

TEMPLATE RESPONSE (if provided): {template_response or 'None provided'}

If asked about specific business operations, politely redirect to signing up for a free account where they can access the full AI assistant with their business data."""

    try:
        import httpx
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message}
        ]
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "llama3-8b-8192",
                    "messages": messages,
                    "max_tokens": 400,
                    "temperature": 0.7,
                    "top_p": 0.9,
                },
                timeout=30.0,
            )
            
            if response.status_code == 200:
                result = response.json()
                ai_response = result["choices"][0]["message"]["content"].strip()
                
                # Validate response doesn't contain restricted content
                if validate_marketing_response_content(ai_response):
                    return ai_response
                else:
                    print(f"AI response failed validation: {ai_response[:100]}...")
                    return template_response or get_marketing_fallback_response(message)
            else:
                print(f"Groq API error: {response.status_code} - {response.text}")
                return template_response or get_marketing_fallback_response(message)
                
    except Exception as e:
        print(f"Marketing AI generation error: {str(e)}")
        return template_response or get_marketing_fallback_response(message)


def validate_marketing_response_content(response: str) -> bool:
    """Validate that AI response contains only appropriate marketing content."""
    restricted_phrases = [
        'your business data', 'your account', 'your orders', 'your customers',
        'your inventory', 'your sales', 'login to see', 'in your dashboard',
        'access your', 'view your', 'check your', 
        'i can see your', 'based on your data', 'your business information',
        'your personal', 'your private', 'confidential', 'proprietary',
        'login to your', 'log into your', 'sign into your',
        'your specific business information'
    ]
    
    response_lower = response.lower()
    
    # Check for restricted phrases (but allow "your specific business needs" as it's generic)
    for phrase in restricted_phrases:
        if phrase.lower() in response_lower:
            return False
    
    # Check for patterns that suggest data access
    import re
    data_access_patterns = [
        r'i can see.*your',
        r'based on.*your.*data',
        r'your.*shows?.*that',
        r'according to your',
        r'from your.*i can',
        r'login.*dashboard',
        r'log.*into.*your',
        r'your.*account.*shows',
        r'your.*business.*data',
        r'your.*business.*information'
    ]
    
    for pattern in data_access_patterns:
        if re.search(pattern, response_lower):
            return False
    
    return True


def get_marketing_fallback_response(message: str) -> str:
    """Get a marketing-focused fallback response when AI is not available."""
    message_lower = message.lower()
    
    # Pricing inquiries
    if any(word in message_lower for word in ["price", "cost", "pricing", "how much", "tier", "plan", "expensive", "cheap"]):
        return """BizPilot offers 5 pricing tiers to match different business needs:

• **Pilot Solo (Free)** - Perfect for solo entrepreneurs and market stalls
• **Pilot Lite (R199/month)** - Ideal for coffee shops and food trucks  
• **Pilot Core (R799/month)** - Perfect for restaurants and retail stores
• **Pilot Pro (R1,499/month)** - For growing businesses and chains
• **Enterprise (Custom Pricing)** - For large businesses and franchises

Each tier includes comprehensive business management tools with smart features that enhance your operations. Start with our free tier and upgrade as your business grows!

Visit https://bizpilot.co.za/pricing for detailed comparisons or contact sales@bizpilot.co.za for Enterprise pricing."""

    # Feature inquiries
    if any(word in message_lower for word in ["features", "what does", "capabilities", "functionality", "can it", "does it"]):
        return """BizPilot is a complete business management platform that includes:

🏪 **Complete POS System** - Fast transactions, payment processing, mobile POS
📦 **Smart Inventory Management** - Real-time tracking, automated reordering
👥 **Customer Management** - CRM, loyalty programs, customer analytics
📊 **Advanced Reporting** - Real-time dashboards, profit analysis, insights
💰 **Financial Management** - Invoicing, payment tracking, accounting integration
🏢 **Multi-Location Support** - Centralized management for chains and franchises

All enhanced with intelligent features that learn your business patterns and provide helpful recommendations while keeping you in complete control.

Try our free Pilot Solo tier to experience the platform: https://bizpilot.co.za/signup"""

    # Industry-specific inquiries
    if any(word in message_lower for word in ["restaurant", "retail", "coffee", "business type", "industry", "cafe", "shop", "store"]):
        return """BizPilot works great for many industries:

🍽️ **Restaurants & Cafes** - Table management, menu engineering, recipe costing
🛍️ **Retail Stores** - Inventory control, barcode scanning, e-commerce integration  
☕ **Coffee Shops & Bakeries** - Fresh product tracking, loyalty programs
🏢 **Multi-Location Chains** - Centralized management, performance comparison
🏨 **Hotels & Hospitality** - PMS integration, guest management
🎨 **Specialty Retail** - Complex product variants, consignment management

Each industry gets specialized features plus smart automation that enhances your operations. The system adapts to your specific business needs while providing comprehensive management tools.

What type of business are you running? I can provide more specific information!"""

    # Getting started inquiries
    if any(word in message_lower for word in ["start", "begin", "signup", "trial", "demo", "get started", "how to", "setup"]):
        return """Getting started with BizPilot is easy:

1️⃣ **Start Free** - Sign up for Pilot Solo (no credit card required)
2️⃣ **Quick Setup** - Our guided setup takes under 10 minutes
3️⃣ **Import Data** - We help migrate existing business data from other systems
4️⃣ **Start Selling** - Begin using the POS and inventory management
5️⃣ **Upgrade When Ready** - Add advanced features as your business grows

✅ Free Pilot Solo tier includes core POS and basic inventory
✅ 14-day free trial of advanced features
✅ No setup fees or hidden costs
✅ Cancel anytime

Ready to get started? Visit https://bizpilot.co.za/signup or contact our team at sales@bizpilot.co.za for a personalized demo."""

    # Enterprise inquiries
    if any(word in message_lower for word in ["enterprise", "custom", "large business", "franchise", "white label", "dedicated"]):
        return """BizPilot Enterprise is designed for large businesses and franchises:

🏢 **Unlimited Everything** - Users, locations, transactions, storage
🎨 **White Labeling** - Custom branding, logos, colors, domain names
⚙️ **Custom Development** - Specialized features for your unique needs
🔧 **Advanced Integrations** - Connect with your existing systems
📞 **Dedicated Support** - 24/7 support with guaranteed response times
📊 **99.9% Uptime SLA** - Financial compensation for any downtime
👨‍💼 **Account Manager** - Personal relationship manager for your business

Enterprise pricing is customized based on your specific requirements and scale. Our sales team will work with you to create a tailored solution that fits your needs and budget.

Contact our Enterprise team: sales@bizpilot.co.za or +27 (0) 21 123 4567"""

    # Support inquiries
    if any(word in message_lower for word in ["support", "help", "contact", "phone", "email", "assistance"]):
        return """We're here to help you succeed with BizPilot:

📧 **General Inquiries**: info@bizpilot.co.za
📞 **Sales Team**: sales@bizpilot.co.za | +27 (0) 21 123 4567
🛠️ **Technical Support**: support@bizpilot.co.za | +27 (0) 21 123 4568
🏢 **Enterprise Sales**: enterprise@bizpilot.co.za

**Support Hours**: Monday-Friday 8AM-6PM SAST
**Enterprise Support**: 24/7 for Enterprise customers

**Self-Service Options**:
• Comprehensive help center with tutorials
• Video training library
• Community forum for tips and best practices
• Free onboarding assistance for all new customers

Start with our free Pilot Solo tier to experience our platform and support quality firsthand!"""

    # Comparison inquiries
    if any(word in message_lower for word in ["compare", "difference", "vs", "versus", "better than", "alternative", "competitor"]):
        return """BizPilot stands out from other business management solutions:

**🔗 Integrated Approach**
Unlike basic POS systems, BizPilot combines POS, inventory, CRM, and analytics in one seamless platform.

**🤖 Smart Automation**
AI-powered insights help optimize inventory, pricing, and customer engagement while keeping you in control.

**🇿🇦 South African Focus**
Local payment integration (PayStack), South African tax compliance, and local support team.

**💰 Transparent Pricing**
Clear tier structure from free to enterprise with no hidden fees or surprise charges.

**📈 Scalable Growth**
Start free and grow to enterprise without changing platforms or losing data.

**🏢 Multi-Location Ready**
Built for businesses planning to expand with centralized management and reporting.

**Key Advantages**:
• Free tier with real functionality (not just a trial)
• Industry-specific features for restaurants, retail, and services
• Enterprise-grade security with local data hosting
• Comprehensive training and migration support

Ready to see the difference? Try our free Pilot Solo tier: https://bizpilot.co.za/signup"""

    # Default response for general questions
    return """I'm here to help you learn about BizPilot's comprehensive business management platform!

I can provide information about:
• Features and capabilities across all business areas
• Pricing plans and tier comparisons (including Enterprise)
• Industry-specific solutions and use cases
• Getting started guidance and setup process
• Contact information for sales and support

**Quick Facts about BizPilot**:
🆓 Start free with Pilot Solo (no credit card required)
💼 Complete business management in one platform
🏪 Perfect for restaurants, retail, coffee shops, and more
📊 Real-time insights and smart automation
🏢 Scales from solo entrepreneurs to enterprise franchises

BizPilot combines POS, inventory management, customer management, reporting, and smart automation in one integrated platform. Start with our free Pilot Solo tier or contact us for a personalized demo.

What specific aspect of BizPilot would you like to know more about?"""
