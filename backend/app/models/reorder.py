"""Automated reorder models."""

import enum
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, Enum as SQLEnum, Boolean, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class ReorderRuleStatus(str, enum.Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    DISABLED = "disabled"


class PurchaseOrderStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    ORDERED = "ordered"
    PARTIALLY_RECEIVED = "partially_received"
    RECEIVED = "received"
    CANCELLED = "cancelled"


class ReorderRule(BaseModel):
    """Automated reorder rule per product."""
    __tablename__ = "reorder_rules"

    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=True)
    min_stock_level = Column(Integer, nullable=False)
    reorder_quantity = Column(Integer, nullable=False)
    max_stock_level = Column(Integer, nullable=True)
    lead_time_days = Column(Integer, default=7)
    status = Column(
        SQLEnum(ReorderRuleStatus, values_callable=lambda x: [e.value for e in x], name='reorderrulestatus'),
        default=ReorderRuleStatus.ACTIVE,
    )
    auto_approve = Column(Boolean, default=False)
    last_triggered_at = Column(DateTime(timezone=True), nullable=True)

    product = relationship("Product", lazy="joined")
    supplier = relationship("Supplier", lazy="joined")


class PurchaseRequest(BaseModel):
    """Purchase request generated from reorder rules."""
    __tablename__ = "purchase_requests"

    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    reference = Column(String(50), nullable=False, unique=True)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=True, index=True)
    status = Column(
        SQLEnum(PurchaseOrderStatus, values_callable=lambda x: [e.value for e in x], name='purchaseorderstatus'),
        default=PurchaseOrderStatus.DRAFT,
    )
    total_amount = Column(Numeric(12, 2), default=0)
    notes = Column(Text, nullable=True)
    requested_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    expected_delivery = Column(DateTime(timezone=True), nullable=True)
    is_auto_generated = Column(Boolean, default=False)

    supplier = relationship("Supplier", lazy="joined")
    requested_by = relationship("User", foreign_keys=[requested_by_id], lazy="joined")
    items = relationship("PurchaseRequestItem", back_populates="request", lazy="selectin")


class PurchaseRequestItem(BaseModel):
    """Line item in a purchase request."""
    __tablename__ = "purchase_request_items"

    request_id = Column(UUID(as_uuid=True), ForeignKey("purchase_requests.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_cost = Column(Numeric(12, 2), nullable=False)
    total = Column(Numeric(12, 2), nullable=False)
    received_quantity = Column(Integer, default=0)

    request = relationship("PurchaseRequest", back_populates="items")
    product = relationship("Product", lazy="joined")
