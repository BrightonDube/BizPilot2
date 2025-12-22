"""AI message model for persisted chat messages."""

from sqlalchemy import Column, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import BaseModel


class AIMessage(BaseModel):
    """AI message model for persisted chat messages."""

    __tablename__ = "ai_messages"

    conversation_id = Column(UUID(as_uuid=True), ForeignKey("ai_conversations.id"), nullable=False, index=True)
    is_user = Column(Boolean, default=True, nullable=False)
    content = Column(Text, nullable=False)

    conversation = relationship("AIConversation", back_populates="messages")

    def __repr__(self) -> str:
        return f"<AIMessage {self.id} conversation={self.conversation_id} is_user={self.is_user}>"
