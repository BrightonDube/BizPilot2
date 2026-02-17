"""Notification models."""

import enum
from sqlalchemy import Column, String, Text, Boolean, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class NotificationType(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    SUCCESS = "success"
    ORDER = "order"
    INVENTORY = "inventory"
    SYSTEM = "system"
    PAYMENT = "payment"


class NotificationChannel(str, enum.Enum):
    IN_APP = "in_app"
    EMAIL = "email"
    PUSH = "push"


class Notification(BaseModel):
    """In-app notification."""
    __tablename__ = "notifications"

    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(
        SQLEnum(NotificationType, values_callable=lambda x: [e.value for e in x], name='notificationtype'),
        default=NotificationType.INFO,
    )
    channel = Column(
        SQLEnum(NotificationChannel, values_callable=lambda x: [e.value for e in x], name='notificationchannel'),
        default=NotificationChannel.IN_APP,
    )
    is_read = Column(Boolean, default=False, index=True)
    action_url = Column(String(500), nullable=True)
    resource_type = Column(String(100), nullable=True)
    resource_id = Column(String(100), nullable=True)

    user = relationship("User", lazy="joined")


class NotificationPreference(BaseModel):
    """User's notification preferences."""
    __tablename__ = "notification_preferences"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    order_notifications = Column(Boolean, default=True)
    inventory_alerts = Column(Boolean, default=True)
    payment_notifications = Column(Boolean, default=True)
    system_notifications = Column(Boolean, default=True)
    email_enabled = Column(Boolean, default=True)
    push_enabled = Column(Boolean, default=False)

    user = relationship("User", lazy="joined")
