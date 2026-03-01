"""Delivery management models."""

import enum
from sqlalchemy import (
    Column,
    String,
    Text,
    Numeric,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import BaseModel


class DeliveryStatus(str, enum.Enum):
    """Status of a delivery."""

    PENDING = "pending"
    ASSIGNED = "assigned"
    PICKED_UP = "picked_up"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    FAILED = "failed"
    RETURNED = "returned"


class DeliveryZone(BaseModel):
    """Delivery zone with fee and time estimates."""

    __tablename__ = "delivery_zones"

    business_id = Column(
        UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True
    )
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    delivery_fee = Column(Numeric(12, 2), nullable=False)
    estimated_minutes = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)


class Driver(BaseModel):
    """Driver available for deliveries."""

    __tablename__ = "drivers"

    business_id = Column(
        UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True
    )
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=False)
    vehicle_type = Column(String(50), nullable=True)
    license_plate = Column(String(20), nullable=True)
    is_available = Column(Boolean, default=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)


class Delivery(BaseModel):
    """Individual delivery linked to an order."""

    __tablename__ = "deliveries"

    business_id = Column(
        UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True
    )
    order_id = Column(
        UUID(as_uuid=True), ForeignKey("orders.id"), nullable=False, index=True
    )
    driver_id = Column(
        UUID(as_uuid=True), ForeignKey("drivers.id"), nullable=True, index=True
    )
    zone_id = Column(
        UUID(as_uuid=True), ForeignKey("delivery_zones.id"), nullable=True
    )
    status = Column(
        SQLEnum(DeliveryStatus, name="deliverystatus", create_constraint=False, native_enum=False),
        default=DeliveryStatus.PENDING,
        nullable=False,
    )
    delivery_address = Column(Text, nullable=False)
    customer_phone = Column(String(50), nullable=False)
    delivery_fee = Column(Numeric(12, 2), default=0, nullable=False)
    estimated_delivery_time = Column(DateTime, nullable=True)
    actual_delivery_time = Column(DateTime, nullable=True)
    delivery_notes = Column(Text, nullable=True)
    proof_of_delivery = Column(Text, nullable=True)
