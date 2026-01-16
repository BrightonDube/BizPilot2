"""Layby notification model for tracking payment reminders and alerts."""

import enum
from sqlalchemy import Column, String, Text, ForeignKey, DateTime, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class NotificationChannel(str, enum.Enum):
    """Notification delivery channel."""
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"
    IN_APP = "in_app"


class NotificationStatus(str, enum.Enum):
    """Notification delivery status."""
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    CANCELLED = "cancelled"


class LaybyNotification(BaseModel):
    """Notification for layby payment reminders and alerts."""

    __tablename__ = "layby_notifications"

    layby_id = Column(UUID(as_uuid=True), ForeignKey("laybys.id", ondelete="CASCADE"), nullable=False, index=True)
    notification_type = Column(String(50), nullable=False, index=True)
    channel = Column(
        SQLEnum(NotificationChannel, values_callable=lambda x: [e.value for e in x], name='notificationchannel'),
        nullable=False
    )
    recipient = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=True)
    message = Column(Text, nullable=False)
    status = Column(
        SQLEnum(NotificationStatus, values_callable=lambda x: [e.value for e in x], name='notificationstatus'),
        nullable=False,
        default=NotificationStatus.PENDING,
        index=True
    )
    sent_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

    # Relationships
    layby = relationship("Layby", back_populates="notifications")

    def __repr__(self) -> str:
        return f"<LaybyNotification {self.id} layby={self.layby_id} type={self.notification_type}>"
