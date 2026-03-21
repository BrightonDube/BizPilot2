"""
AI chat endpoints for the unified chat system.

Provides endpoints for:
- GET /ai/context - Get user's AI settings and business context
- GET /ai/conversations - List user's conversations (stub for now)
- POST /ai/conversations - Create new conversation (stub for now)
- GET /ai/conversations/{id}/messages - Get conversation messages (stub for now)
- POST /ai/conversations/{id}/messages - Send message in conversation (bridges to agents/chat)

These endpoints unify the widget and /ai page to use the same conversation system.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_sync_db
from app.api.deps import get_current_active_user, get_current_business_id
from app.models.user import User
from app.services.ai_service import AIService

router = APIRouter(prefix="/ai", tags=["AI Chat"])


class AIContextResponse(BaseModel):
    """User's AI settings and business context."""
    ai_data_sharing_level: str
    app_context: dict
    business_context: dict


class ConversationResponse(BaseModel):
    """Conversation metadata."""
    id: str
    title: str


class MessageRequest(BaseModel):
    """Request to send a message."""
    content: str


class MessageResponse(BaseModel):
    """Chat message."""
    id: str
    conversation_id: str
    is_user: bool
    content: str
    type: Optional[str] = None


@router.get("/context", response_model=AIContextResponse)
async def get_ai_context(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
) -> AIContextResponse:
    """
    Get user's AI settings and business context.
    Returns data sharing level and available context for the AI.
    """
    ai_service = AIService(db)
    settings = ai_service.get_or_create_user_settings(current_user.id)
    
    # Get business context based on sharing level
    business_context = {}
    if settings.ai_data_sharing_level != "none":
        # Add basic business stats
        business_context = {
            "businessName": "Your Business",  # TODO: Get from business table
            "totalProducts": 0,  # TODO: Query from products
            "totalInventoryItems": 0,  # TODO: Query from inventory
            "lowStockItems": 0,  # TODO: Query low stock
        }
    
    return AIContextResponse(
        ai_data_sharing_level=settings.ai_data_sharing_level.value,
        app_context={
            "features": ["ai_assistant", "inventory", "pos", "invoicing"],
        },
        business_context=business_context,
    )


@router.get("/conversations", response_model=List[ConversationResponse])
async def list_conversations(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_sync_db),
) -> List[ConversationResponse]:
    """
    List user's AI conversations.
    For now, returns empty list - conversations are stored in sessionStorage.
    """
    # TODO: Implement conversation persistence in database
    return []


@router.post("/conversations", response_model=ConversationResponse)
async def create_conversation(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_sync_db),
) -> ConversationResponse:
    """
    Create a new AI conversation.
    For now, returns a stub - conversations are stored in sessionStorage.
    """
    # TODO: Implement conversation persistence in database
    import uuid
    conversation_id = str(uuid.uuid4())
    return ConversationResponse(
        id=conversation_id,
        title="New Conversation",
    )


@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_conversation_messages(
    conversation_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_sync_db),
) -> List[MessageResponse]:
    """
    Get messages for a conversation.
    For now, returns empty list - messages are stored in sessionStorage.
    """
    # TODO: Implement message persistence in database
    return []


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse)
async def send_conversation_message(
    conversation_id: str,
    request: MessageRequest,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
) -> MessageResponse:
    """
    Send a message in a conversation.
    Bridges to the existing /agents/chat endpoint.
    """
    from app.api.agents import AgentChatRequest
    
    # Call the existing agent chat endpoint
    agent_request = AgentChatRequest(
        message=request.content,
        session_id=None,  # Let agent generate new session
        conversation_id=conversation_id,
    )
    
    # Get sharing level
    ai_service = AIService(db)
    settings = ai_service.get_or_create_user_settings(current_user.id)
    
    # Call agent
    from app.agents.tasks.chat_agent import ChatAgent
    agent = ChatAgent(db)
    result = await agent.run(
        user=current_user,
        message=request.content,
        history=[],
        sharing_level=settings.ai_data_sharing_level,
        session_id=None,
        business_id=business_id,
        plan_confirmed=True,
    )
    
    # Return as message format
    import uuid
    return MessageResponse(
        id=str(uuid.uuid4()),
        conversation_id=conversation_id,
        is_user=False,
        content=result.get("message", ""),
        type=result.get("type", "response"),
    )
