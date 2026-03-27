"""Stock take models for month-end stock management."""

import enum

from sqlalchemy import Column, String, Text, Numeric, Integer, ForeignKey, Enum as SQLEnum, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, utc_now


class StockTakeStatus(str, enum.Enum):
    """Stock take session status."""

    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    PENDING_APPROVAL = "pending_approval"
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
    submitted_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    completed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
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


class StockTakeScope(BaseModel):
    """Scoping record that limits a stock take session to specific entities.

    Why a scope table?
    Large businesses cannot count every product in one session.  This table
    lets a session target only specific categories, locations, or products
    (scope_type + scope_id).  Multiple rows per session support combined
    scopes like "all products in categories A and B at location X".
    """

    __tablename__ = "stock_take_scope"

    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stock_take_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scope_type = Column(String(20), nullable=False)  # "category", "location", "product"
    scope_id = Column(UUID(as_uuid=True), nullable=False)

    session = relationship("StockTakeSession", lazy="joined")


class StockTakeCounter(BaseModel):
    """Tracks which user is assigned to count in a stock take session.

    Why track counters?
    Accountability — if two staff members are assigned to count different
    aisles, this table records who counted what.  The unique constraint
    prevents accidental duplicate assignments.
    """

    __tablename__ = "stock_take_counters"
    __table_args__ = (
        UniqueConstraint("session_id", "user_id", name="uq_stock_take_counter"),
    )

    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stock_take_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    assigned_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    session = relationship("StockTakeSession", lazy="joined")
    user = relationship("User", lazy="joined")


class InventoryPeriodStatus(str, enum.Enum):
    """Status lifecycle for inventory periods."""
    OPEN = "open"
    CLOSED = "closed"
    REOPENED = "reopened"


class InventoryPeriod(BaseModel):
    """Month-end inventory period for valuation and COGS tracking.

    Why a period table?
    Month-end close is a critical accounting event.  This table provides
    the lifecycle (open → closed → reopened) and stores aggregate values
    so period reports don't re-scan all transactions.
    """

    __tablename__ = "inventory_periods"
    __table_args__ = (
        UniqueConstraint("business_id", "period_year", "period_month",
                         name="uq_inventory_period"),
    )

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    period_year = Column(Integer, nullable=False)
    period_month = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False, default="open")
    opening_value = Column(Numeric(14, 2), default=0)
    closing_value = Column(Numeric(14, 2), nullable=True)
    cogs = Column(Numeric(14, 2), nullable=True)
    adjustments_value = Column(Numeric(14, 2), default=0)
    closed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    reopened_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reopened_at = Column(DateTime(timezone=True), nullable=True)


class PeriodSnapshot(BaseModel):
    """Frozen product-level inventory snapshot at period close.

    Why snapshot instead of recalculating?
    Once a period is closed, the quantities and costs must be immutable
    for audit.  Snapshots guarantee COGS and valuation reports remain
    stable even if later transactions modify current stock levels.
    """

    __tablename__ = "period_snapshots"
    __table_args__ = (
        UniqueConstraint("period_id", "product_id",
                         name="uq_period_snapshot_product"),
    )

    period_id = Column(UUID(as_uuid=True), ForeignKey("inventory_periods.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=0)
    unit_cost = Column(Numeric(12, 2), nullable=False, default=0)
    total_value = Column(Numeric(14, 2), nullable=False, default=0)


class ABCClassification(str, enum.Enum):
    """Pareto-based ABC inventory classification."""
    A = "A"  # ~20% of products, ~80% of value
    B = "B"  # ~30% of products, ~15% of value
    C = "C"  # ~50% of products, ~5% of value


class ProductABCClassification(BaseModel):
    """ABC classification for counting frequency optimization.

    Why ABC analysis?
    Counting every product equally is wasteful.  A-class items (high value,
    high movement) should be counted weekly/monthly.  C-class items can be
    counted quarterly.  This table stores the computed classification so
    stock take scheduling can prioritize expensive/fast-moving products.
    """

    __tablename__ = "product_abc_classifications"
    __table_args__ = (
        UniqueConstraint("business_id", "product_id",
                         name="uq_abc_classification_product"),
    )

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    classification = Column(String(1), nullable=False)  # A, B, C
    annual_value = Column(Numeric(14, 2), nullable=False, default=0)
    count_frequency_days = Column(Integer, nullable=False, default=90)
    last_counted_at = Column(DateTime(timezone=True), nullable=True)


class StockCountHistory(BaseModel):
    """Append-only recount log for blind-count auditing.

    Why append-only?
    In blind counts, counters don't see the system quantity.  Recording
    every recount attempt (without overwriting) provides an audit trail
    that proves the counting process was fair and unbiased.
    """

    __tablename__ = "stock_count_history"

    count_id = Column(UUID(as_uuid=True), ForeignKey("stock_counts.id"), nullable=False, index=True)
    counted_quantity = Column(Integer, nullable=False)
    counted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    counted_at = Column(DateTime(timezone=True), default=utc_now)
    notes = Column(Text, nullable=True)
