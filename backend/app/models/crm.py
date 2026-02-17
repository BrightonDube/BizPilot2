"""CRM models for customer relationship management."""

import enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class InteractionType(str, enum.Enum):
    NOTE = "note"
    CALL = "call"
    EMAIL = "email"
    MEETING = "meeting"
    FOLLOW_UP = "follow_up"


class CustomerSegment(BaseModel):
    """Customer segment for grouping and targeting."""

    __tablename__ = "customer_segments"

    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    criteria = Column(Text, nullable=True)  # JSON-encoded filter criteria
    color = Column(String(20), default="#3B82F6")
    is_auto = Column(Boolean, default=False)


class CustomerSegmentMember(BaseModel):
    """Link between customer and segment."""

    __tablename__ = "customer_segment_members"

    segment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("customer_segments.id"),
        nullable=False,
        index=True,
    )
    customer_id = Column(
        UUID(as_uuid=True),
        ForeignKey("customers.id"),
        nullable=False,
        index=True,
    )


class CustomerInteraction(BaseModel):
    """Customer interaction/touchpoint record."""

    __tablename__ = "customer_interactions"

    customer_id = Column(
        UUID(as_uuid=True),
        ForeignKey("customers.id"),
        nullable=False,
        index=True,
    )
    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    interaction_type = Column(
        SQLEnum(
            InteractionType,
            values_callable=lambda x: [e.value for e in x],
            name="interactiontype",
        ),
        nullable=False,
    )
    subject = Column(String(255), nullable=False)
    content = Column(Text, nullable=True)
    follow_up_date = Column(DateTime(timezone=True), nullable=True)
    is_completed = Column(Boolean, default=False)

    customer = relationship("Customer", backref="interactions", lazy="joined")
    user = relationship("User", lazy="joined")


class CustomerMetrics(BaseModel):
    """Pre-computed customer metrics for quick access."""

    __tablename__ = "customer_metrics"

    customer_id = Column(
        UUID(as_uuid=True),
        ForeignKey("customers.id"),
        nullable=False,
        unique=True,
        index=True,
    )
    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    total_orders = Column(Integer, default=0)
    total_spent = Column(Numeric(12, 2), default=0)
    average_order_value = Column(Numeric(12, 2), default=0)
    last_order_date = Column(DateTime(timezone=True), nullable=True)
    first_order_date = Column(DateTime(timezone=True), nullable=True)
    days_since_last_order = Column(Integer, nullable=True)

    customer = relationship("Customer", backref="metrics", lazy="joined")
