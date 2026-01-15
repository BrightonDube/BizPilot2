"""Session model for tracking active user sessions."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class Session(Base):
    """Model for tracking active user sessions."""
    
    __tablename__ = "sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Token tracking
    refresh_token_hash = Column(String(255), nullable=False, unique=True)
    
    # Device/client info
    device_name = Column(String(255), nullable=True)  # e.g., "Chrome on Windows"
    device_type = Column(String(50), nullable=True)   # e.g., "desktop", "mobile", "tablet"
    ip_address = Column(String(45), nullable=True)    # IPv4 or IPv6
    user_agent = Column(Text, nullable=True)
    location = Column(String(255), nullable=True)     # e.g., "Cape Town, South Africa"
    
    # Session state
    is_active = Column(Boolean, default=True, nullable=False)
    is_current = Column(Boolean, default=False, nullable=False)  # Mark the current session
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    last_active_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="sessions")
    
    def __repr__(self):
        return f"<Session {self.id} user={self.user_id} device={self.device_name}>"
    
    @property
    def is_expired(self) -> bool:
        """Check if the session has expired."""
        return datetime.now(timezone.utc) > self.expires_at
    
    @property
    def is_valid(self) -> bool:
        """Check if the session is still valid (active and not expired)."""
        return self.is_active and not self.is_expired and self.revoked_at is None
