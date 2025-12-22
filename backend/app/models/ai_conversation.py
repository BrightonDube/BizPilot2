"""AI conversation model for persisted chat threads."""

from sqlalchemy import Column, ForeignKey, String
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import BaseModel


class AIConversation(BaseModel):
    """AI conversation model for persisted chat threads."""

    __tablename__ = "ai_conversations"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False, default="New Conversation")

    user = relationship("User", back_populates="ai_conversations")
    messages = relationship("AIMessage", back_populates="conversation", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<AIConversation {self.id} user={self.user_id}>"
