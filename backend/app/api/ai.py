"""
backend/app/api/ai.py

FastAPI router for AI conversation persistence.
Provides CRUD endpoints for AI conversations and messages stored in the DB.
Registered at /api/v1/ai in app/api/__init__.py.

Endpoints:
  GET  /ai/context                              — User AI settings + business context
  GET  /ai/conversations                        — List conversations for current user
  POST /ai/conversations                        — Create a new conversation
  GET  /ai/conversations/{id}/messages          — Get messages in a conversation
  DELETE /ai/conversations/{id}                 — Soft-delete a conversation
"""

import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_sync_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.ai_conversation import AIConversation
from app.models.ai_message import AIMessage
from app.services.ai_service import AIService

logger = logging.getLogger("bizpilot.ai")

router = APIRouter(prefix="/ai", tags=["AI"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ConversationOut(BaseModel):
    """Serialised AI conversation record."""

    id: str
    title: str

    class Config:
        from_attributes = True


class MessageOut(BaseModel):
    """Serialised AI message record."""

    id: str
    conversation_id: str
    is_user: bool
    content: str

    class Config:
        from_attributes = True


class CreateConversationRequest(BaseModel):
    """Request body for creating a conversation."""

    title: Optional[str] = "New Conversation"


class AIContextOut(BaseModel):
    """AI settings and light business context for the current user."""

    ai_data_sharing_level: str
    app_context: dict
    business_context: dict


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/context", response_model=AIContextOut)
async def get_ai_context(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_sync_db),
) -> AIContextOut:
    """Return AI data-sharing settings and minimal business context for the current user."""
    svc = AIService(db)
    settings = svc.get_or_create_user_settings(str(current_user.id))
    sharing = settings.ai_data_sharing_level
    level_str = sharing.value if hasattr(sharing, "value") else str(sharing)
    return AIContextOut(
        ai_data_sharing_level=level_str,
        app_context={},
        business_context={"businessName": getattr(current_user, "email", "")},
    )


@router.get("/conversations", response_model=List[ConversationOut])
async def list_conversations(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_sync_db),
) -> List[ConversationOut]:
    """List all non-deleted conversations for the current user, newest first."""
    rows = (
        db.query(AIConversation)
        .filter(
            AIConversation.user_id == current_user.id,
            AIConversation.deleted_at.is_(None),
        )
        .order_by(AIConversation.created_at.desc())
        .all()
    )
    return [ConversationOut(id=str(r.id), title=r.title) for r in rows]


@router.post("/conversations", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    body: CreateConversationRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_sync_db),
) -> ConversationOut:
    """Create a new AI conversation thread for the current user."""
    convo = AIConversation(
        user_id=current_user.id,
        title=body.title or "New Conversation",
    )
    db.add(convo)
    db.commit()
    db.refresh(convo)
    return ConversationOut(id=str(convo.id), title=convo.title)


@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageOut])
async def get_messages(
    conversation_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_sync_db),
) -> List[MessageOut]:
    """Return all messages in a conversation, oldest first. 404 if not owned by caller."""
    convo = (
        db.query(AIConversation)
        .filter(
            AIConversation.id == conversation_id,
            AIConversation.user_id == current_user.id,
            AIConversation.deleted_at.is_(None),
        )
        .first()
    )
    if not convo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    messages = (
        db.query(AIMessage)
        .filter(AIMessage.conversation_id == conversation_id)
        .order_by(AIMessage.created_at.asc())
        .all()
    )
    return [
        MessageOut(
            id=str(m.id),
            conversation_id=str(m.conversation_id),
            is_user=m.is_user,
            content=m.content,
        )
        for m in messages
    ]


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_sync_db),
) -> None:
    """Soft-delete a conversation. Cascade to messages is handled by the DB relationship."""
    convo = (
        db.query(AIConversation)
        .filter(
            AIConversation.id == conversation_id,
            AIConversation.user_id == current_user.id,
            AIConversation.deleted_at.is_(None),
        )
        .first()
    )
    if not convo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    convo.deleted_at = datetime.now(timezone.utc)
    db.commit()
