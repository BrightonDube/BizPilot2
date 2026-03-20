from sqlalchemy import Column, String, Boolean, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel

class WebhookSubscription(BaseModel):
    """Webhook subscription for outbound events."""
    __tablename__ = "webhook_subscriptions"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    url = Column(String(500), nullable=False)
    events = Column(JSONB, nullable=False)  # List of event types e.g. ["order.created", "invoice.paid"]
    secret = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    failure_count = Column(Integer, default=0, nullable=False)
    last_triggered_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    deliveries = relationship("WebhookDelivery", back_populates="subscription", cascade="all, delete-orphan")

class WebhookDelivery(BaseModel):
    """Record of a webhook delivery attempt."""
    __tablename__ = "webhook_deliveries"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("webhook_subscriptions.id"), nullable=False, index=True)
    event_type = Column(String(100), nullable=False)
    payload = Column(JSONB, nullable=False)
    status = Column(String(20), default="pending", nullable=False)  # pending | delivered | failed
    attempt_count = Column(Integer, default=0, nullable=False)
    next_retry_at = Column(DateTime(timezone=True), nullable=True)
    response_code = Column(Integer, nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    subscription = relationship("WebhookSubscription", back_populates="deliveries")
