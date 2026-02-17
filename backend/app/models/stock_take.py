"""Stock take models for month-end stock management."""

import enum

from sqlalchemy import Column, String, Text, Numeric, Integer, ForeignKey, Enum as SQLEnum, DateTime
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import BaseModel, utc_now


class StockTakeStatus(str, enum.Enum):
    """Stock take session status."""

    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class StockTakeSession(BaseModel):
    """A stock take session for month-end counting."""

    __tablename__ = "stock_take_sessions"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    reference = Column(String(50), nullable=False, unique=True)
    status = Column(
        SQLEnum(StockTakeStatus, values_callable=lambda x: [e.value for e in x], name="stocktakestatus"),
        nullable=False,
        default=StockTakeStatus.DRAFT,
    )
    started_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    completed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<StockTakeSession {self.reference} status={self.status}>"


class StockCount(BaseModel):
    """Individual product count within a stock take session."""

    __tablename__ = "stock_counts"

    session_id = Column(UUID(as_uuid=True), ForeignKey("stock_take_sessions.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    system_quantity = Column(Integer, nullable=False, default=0)
    counted_quantity = Column(Integer, nullable=True)
    variance = Column(Integer, nullable=True)
    unit_cost = Column(Numeric(12, 2), nullable=True)
    variance_value = Column(Numeric(12, 2), nullable=True)
    counted_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<StockCount product={self.product_id} variance={self.variance}>"


class InventoryAdjustment(BaseModel):
    """Inventory adjustment record from stock takes or manual corrections."""

    __tablename__ = "inventory_adjustments"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    session_id = Column(UUID(as_uuid=True), ForeignKey("stock_take_sessions.id"), nullable=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True)
    adjustment_type = Column(String(50), nullable=False)
    quantity_change = Column(Integer, nullable=False)
    reason = Column(Text, nullable=True)
    approved_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    adjustment_date = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    def __repr__(self) -> str:
        return f"<InventoryAdjustment type={self.adjustment_type} qty={self.quantity_change}>"
