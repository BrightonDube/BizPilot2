"""AI Assistant API endpoints."""

from typing import Any, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.config import settings
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.user_settings import AIDataSharingLevel
from app.services.ai_service import AIService

router = APIRouter(prefix="/ai", tags=["AI Assistant"])


class ChatRequest(BaseModel):
    """Chat request schema."""
    message: str
    conversation_id: Optional[str] = None


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
    current_user: User = Depends(get_current_active_user),
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
    # Backwards compatibility: if AI isn't configured, return the historical fallback
    # response and preserve the caller-provided conversation_id (even if it's not a UUID).
    if not settings.OPENAI_API_KEY and not settings.GROQ_API_KEY:
        return ChatResponse(
            response=get_fallback_response(request.message),
            conversation_id=request.conversation_id,
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
        return ChatResponse(
            response="I apologize, but I encountered an error processing your request. Please try again later.",
            conversation_id=request.conversation_id,
        )


@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    svc = AIService(db)
    convos = svc.list_conversations(current_user.id)
    return [ConversationResponse(id=str(c.id), title=c.title) for c in convos]


@router.post("/conversations", response_model=ConversationResponse)
async def create_conversation(
    payload: ConversationCreateRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    svc = AIService(db)
    convo = svc.create_conversation(current_user.id, payload.title)
    return ConversationResponse(id=str(convo.id), title=convo.title)


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    svc = AIService(db)
    svc.delete_conversation(current_user.id, conversation_id)
    return {"status": "ok"}


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageResponse])
async def list_messages(
    conversation_id: str,
    current_user: User = Depends(get_current_active_user),
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
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    svc = AIService(db)
    resp = await svc.send_message(user=current_user, content=request.message, conversation_id=conversation_id)
    return ChatResponse(response=resp["response"], conversation_id=resp.get("conversation_id"))


@router.get("/context", response_model=ContextResponse)
async def get_ai_context(
    current_user: User = Depends(get_current_active_user),
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
