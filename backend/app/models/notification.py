"""Notification models for in-app notifications."""

from sqlalchemy import Column, String, Text, Boolean, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.models.base import BaseModel


class NotificationType(str, enum.Enum):
    """Notification type."""

    LOW_STOCK = "low_stock"
    OUT_OF_STOCK = "out_of_stock"
    ORDER_RECEIVED = "order_received"
    ORDER_SHIPPED = "order_shipped"
    PAYMENT_RECEIVED = "payment_received"
    PAYMENT_OVERDUE = "payment_overdue"
    SYSTEM = "system"


class NotificationPriority(str, enum.Enum):
    """Notification priority."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class Notification(BaseModel):
    """In-app notification."""

    __tablename__ = "notifications"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)  # Null = all users
    
    # Notification details
    notification_type = Column(String(50), nullable=False, index=True)
    priority = Column(String(20), nullable=False, default="medium")
    
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    
    # Status
    is_read = Column(Boolean, default=False, index=True)
    is_archived = Column(Boolean, default=False)
    
    # Reference to related entity
    reference_type = Column(String(50), nullable=True)  # product, order, invoice, etc.
    reference_id = Column(UUID(as_uuid=True), nullable=True)
    
    # Action URL (optional)
    action_url = Column(String(500), nullable=True)
    action_label = Column(String(100), nullable=True)

    def __repr__(self) -> str:
        return f"<Notification {self.notification_type} - {self.title}>"
