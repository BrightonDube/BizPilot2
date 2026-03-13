"""Automated reorder models."""

import enum
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, Enum as SQLEnum, Boolean, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
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


class ProductReorderSettings(BaseModel):
    """Per-product reorder configuration.

    Why a separate table instead of adding columns to products?
    Not every product uses automated reordering.  A separate table keeps
    the products table lean and lets us enforce the unique constraint
    (product_id, business_id) cleanly.
    """

    __tablename__ = "product_reorder_settings"
    __table_args__ = (
        UniqueConstraint("product_id", "business_id", name="uq_reorder_product_business"),
    )

    product_id = Column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    business_id = Column(
        UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    reorder_point = Column(Integer, nullable=False, default=0)
    safety_stock = Column(Integer, nullable=False, default=0)
    par_level = Column(Integer, nullable=True)
    eoq = Column(Integer, nullable=True)
    auto_reorder = Column(Boolean, default=False)
    preferred_supplier_id = Column(
        UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="SET NULL"),
        nullable=True,
    )

    product = relationship("Product", lazy="joined")
    preferred_supplier = relationship("Supplier", lazy="joined")


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
    grns = relationship("GoodsReceivedNote", back_populates="purchase_order", lazy="selectin")


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


class GoodsReceivedNote(BaseModel):
    """Goods received note — formal record of receiving goods against a PO.

    Why a separate GRN table instead of just updating PO item quantities?
    Multiple partial deliveries can occur against a single PO.  Each
    delivery is its own GRN with its own receiving date, operator, and
    variance notes.  This gives full traceability per delivery event.
    """

    __tablename__ = "goods_received_notes"

    purchase_order_id = Column(
        UUID(as_uuid=True), ForeignKey("purchase_requests.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    business_id = Column(
        UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    grn_number = Column(String(50), nullable=False, unique=True)
    received_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    received_at = Column(DateTime(timezone=True))
    notes = Column(Text, nullable=True)

    purchase_order = relationship("PurchaseRequest", back_populates="grns")
    receiver = relationship("User", lazy="joined")
    items = relationship("GRNItem", back_populates="grn", lazy="selectin", cascade="all, delete-orphan")


class GRNItem(BaseModel):
    """Line item within a goods received note.

    Links back to the PO item so we can track how much of the ordered
    quantity has been received across multiple deliveries.
    """

    __tablename__ = "grn_items"

    grn_id = Column(
        UUID(as_uuid=True), ForeignKey("goods_received_notes.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    po_item_id = Column(
        UUID(as_uuid=True), ForeignKey("purchase_request_items.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    quantity_received = Column(Integer, nullable=False)
    variance = Column(Integer, default=0)
    variance_reason = Column(Text, nullable=True)

    grn = relationship("GoodsReceivedNote", back_populates="items")
    po_item = relationship("PurchaseRequestItem", lazy="joined")


class ReorderAuditLog(BaseModel):
    """Immutable audit log for all reorder-related actions.

    Why JSONB for details instead of typed columns?
    Each action type has different contextual data (rule thresholds,
    PO amounts, stock levels).  JSONB lets us store action-specific
    payloads without schema bloat while still supporting GIN indexing
    for queries.
    """

    __tablename__ = "reorder_audit_log"

    business_id = Column(
        UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    action = Column(String(50), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    details = Column(JSONB, nullable=True)
    performed_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_automated = Column(Boolean, default=False)
