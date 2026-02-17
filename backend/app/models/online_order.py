"""Online ordering models."""

import enum
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, Enum as SQLEnum, Boolean, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, JSONType


class OnlineOrderStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PREPARING = "preparing"
    READY = "ready"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    COLLECTED = "collected"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class FulfillmentType(str, enum.Enum):
    DELIVERY = "delivery"
    COLLECTION = "collection"


class OnlineStore(BaseModel):
    """Online store configuration per business."""
    __tablename__ = "online_stores"

    business_id = Column(UUID(as_uuid=True), nullable=False, unique=True, index=True)
    store_name = Column(String(255), nullable=False)
    store_url_slug = Column(String(100), nullable=True, unique=True)
    is_active = Column(Boolean, default=False)
    description = Column(Text, nullable=True)
    min_order_amount = Column(Numeric(12, 2), default=0)
    delivery_fee = Column(Numeric(12, 2), default=0)
    free_delivery_threshold = Column(Numeric(12, 2), nullable=True)
    estimated_prep_minutes = Column(Integer, default=30)
    accepts_delivery = Column(Boolean, default=True)
    accepts_collection = Column(Boolean, default=True)
    operating_hours = Column(JSONType, nullable=True)  # {mon: {open, close}, ...}


class OnlineOrder(BaseModel):
    """Online order."""
    __tablename__ = "online_orders"

    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    order_number = Column(String(50), nullable=False, unique=True, index=True)
    customer_name = Column(String(255), nullable=False)
    customer_email = Column(String(255), nullable=True)
    customer_phone = Column(String(50), nullable=False)
    fulfillment_type = Column(
        SQLEnum(FulfillmentType, values_callable=lambda x: [e.value for e in x], name='fulfillmenttype'),
        nullable=False,
    )
    delivery_address = Column(Text, nullable=True)
    status = Column(
        SQLEnum(OnlineOrderStatus, values_callable=lambda x: [e.value for e in x], name='onlineorderstatus'),
        default=OnlineOrderStatus.PENDING,
    )
    subtotal = Column(Numeric(12, 2), default=0)
    delivery_fee = Column(Numeric(12, 2), default=0)
    total = Column(Numeric(12, 2), default=0)
    notes = Column(Text, nullable=True)
    estimated_ready_at = Column(DateTime(timezone=True), nullable=True)
    payment_method = Column(String(50), nullable=True)
    is_paid = Column(Boolean, default=False)

    items = relationship("OnlineOrderItem", back_populates="order", lazy="selectin")


class OnlineOrderItem(BaseModel):
    """Online order line item."""
    __tablename__ = "online_order_items"

    order_id = Column(UUID(as_uuid=True), ForeignKey("online_orders.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=True)
    name = Column(String(255), nullable=False)
    quantity = Column(Integer, default=1)
    unit_price = Column(Numeric(12, 2), nullable=False)
    total = Column(Numeric(12, 2), nullable=False)
    modifiers = Column(Text, nullable=True)  # JSON string of modifiers
    notes = Column(Text, nullable=True)

    order = relationship("OnlineOrder", back_populates="items")
