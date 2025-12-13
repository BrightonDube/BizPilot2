"""AI Assistant API endpoints."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.config import settings
from app.api.deps import get_current_active_user
from app.models.user import User

router = APIRouter(prefix="/ai", tags=["AI Assistant"])


class ChatRequest(BaseModel):
    """Chat request schema."""
    message: str
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    """Chat response schema."""
    response: str
    conversation_id: Optional[str] = None


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
    # Check if AI is configured
    if not settings.OPENAI_API_KEY and not settings.GROQ_API_KEY:
        # Return a helpful fallback response
        return ChatResponse(
            response=get_fallback_response(request.message),
            conversation_id=request.conversation_id,
        )
    
    try:
        # In a full implementation, this would call OpenAI or Groq
        # For now, we'll return intelligent fallback responses
        response = await generate_ai_response(request.message, current_user.id, db)
        return ChatResponse(
            response=response,
            conversation_id=request.conversation_id,
        )
    except Exception as e:
        return ChatResponse(
            response=f"I apologize, but I encountered an error processing your request. Please try again later.",
            conversation_id=request.conversation_id,
        )


async def generate_ai_response(message: str, user_id, db: Session) -> str:
    """Generate an AI response based on the message."""
    message_lower = message.lower()
    
    # Simple keyword-based responses for demo
    # In production, this would use OpenAI/Groq API
    
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

    # Default response
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
