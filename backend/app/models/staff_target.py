"""Staff targets and performance models."""

import enum
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


# ── Enums ────────────────────────────────────────────────────────────────────


class TargetType(str, enum.Enum):
    SALES_AMOUNT = "sales_amount"
    TRANSACTION_COUNT = "transaction_count"
    ITEMS_SOLD = "items_sold"
    CUSTOMERS_SERVED = "customers_served"
    HOURS_WORKED = "hours_worked"


class PeriodType(str, enum.Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class TargetStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    MISSED = "missed"
    CANCELLED = "cancelled"


class CommissionRuleType(str, enum.Enum):
    PERCENTAGE = "percentage"
    TIERED = "tiered"
    FLAT = "flat"


class CommissionStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    PAID = "paid"


class IncentiveType(str, enum.Enum):
    BONUS = "bonus"
    GIFT = "gift"
    TIME_OFF = "time_off"
    RECOGNITION = "recognition"


class RewardType(str, enum.Enum):
    CASH = "cash"
    PERCENTAGE = "percentage"
    FIXED = "fixed"


class AchievementStatus(str, enum.Enum):
    PENDING = "pending"
    AWARDED = "awarded"
    PAID = "paid"


# ── Models ───────────────────────────────────────────────────────────────────


class StaffTarget(BaseModel):
    """Individual or team performance target."""

    __tablename__ = "staff_targets"

    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    team_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    target_type = Column(
        String(30),
        nullable=False,
    )
    period_type = Column(
        String(20),
        nullable=False,
    )
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    target_value = Column(Numeric(12, 2), nullable=False)
    achieved_value = Column(Numeric(12, 2), default=Decimal("0.00"))
    status = Column(String(20), default=TargetStatus.ACTIVE.value)

    user = relationship("User", lazy="joined")


class TargetTemplate(BaseModel):
    """Reusable target templates for roles."""

    __tablename__ = "target_templates"

    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    role_id = Column(UUID(as_uuid=True), nullable=True)
    target_type = Column(String(30), nullable=False)
    period_type = Column(String(20), nullable=False)
    default_value = Column(Numeric(12, 2), nullable=False)
    is_active = Column(Boolean, default=True)


class CommissionRule(BaseModel):
    """Commission calculation rule."""

    __tablename__ = "commission_rules"

    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    rule_type = Column(String(20), nullable=False)
    rate = Column(Numeric(5, 2), nullable=False)
    min_threshold = Column(Numeric(12, 2), nullable=True)
    max_threshold = Column(Numeric(12, 2), nullable=True)
    cap_amount = Column(Numeric(12, 2), nullable=True)
    product_category_id = Column(UUID(as_uuid=True), nullable=True)
    is_active = Column(Boolean, default=True)

    tiers = relationship("CommissionTier", back_populates="rule", lazy="joined")


class CommissionTier(BaseModel):
    """Tier within a tiered commission rule."""

    __tablename__ = "commission_tiers"

    rule_id = Column(UUID(as_uuid=True), ForeignKey("commission_rules.id", ondelete="CASCADE"), nullable=False, index=True)
    tier_order = Column(Integer, nullable=False)
    min_value = Column(Numeric(12, 2), nullable=False)
    max_value = Column(Numeric(12, 2), nullable=True)
    rate = Column(Numeric(5, 2), nullable=False)

    rule = relationship("CommissionRule", back_populates="tiers")


class StaffCommission(BaseModel):
    """Commission record for a staff member over a period."""

    __tablename__ = "staff_commissions"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    total_sales = Column(Numeric(12, 2), nullable=False)
    commission_amount = Column(Numeric(12, 2), nullable=False)
    status = Column(String(20), default=CommissionStatus.PENDING.value)
    paid_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", lazy="joined")
    details = relationship("CommissionDetail", back_populates="commission", lazy="dynamic")


class CommissionDetail(BaseModel):
    """Per-order commission detail line."""

    __tablename__ = "commission_details"

    commission_id = Column(UUID(as_uuid=True), ForeignKey("staff_commissions.id", ondelete="CASCADE"), nullable=False, index=True)
    order_id = Column(UUID(as_uuid=True), nullable=False)
    sale_amount = Column(Numeric(12, 2), nullable=False)
    commission_amount = Column(Numeric(12, 2), nullable=False)
    rule_id = Column(UUID(as_uuid=True), ForeignKey("commission_rules.id"), nullable=True)

    commission = relationship("StaffCommission", back_populates="details")


class IncentiveProgram(BaseModel):
    """Incentive program definition."""

    __tablename__ = "incentive_programs"

    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    incentive_type = Column(String(20), nullable=False)
    target_type = Column(String(30), nullable=False)
    target_value = Column(Numeric(12, 2), nullable=False)
    reward_type = Column(String(20), nullable=False)
    reward_value = Column(Numeric(12, 2), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    is_team = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    achievements = relationship("IncentiveAchievement", back_populates="program", lazy="dynamic")


class IncentiveAchievement(BaseModel):
    """Record of incentive achievement."""

    __tablename__ = "incentive_achievements"

    incentive_id = Column(UUID(as_uuid=True), ForeignKey("incentive_programs.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    team_id = Column(UUID(as_uuid=True), nullable=True)
    achieved_at = Column(DateTime(timezone=True), nullable=False)
    reward_amount = Column(Numeric(12, 2), nullable=False)
    status = Column(String(20), default=AchievementStatus.PENDING.value)

    program = relationship("IncentiveProgram", back_populates="achievements")
    user = relationship("User", lazy="joined")


class PerformanceSnapshot(BaseModel):
    """Daily performance snapshot per staff member."""

    __tablename__ = "performance_snapshots"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    snapshot_date = Column(Date, nullable=False, index=True)
    total_sales = Column(Numeric(12, 2), default=Decimal("0.00"))
    transaction_count = Column(Integer, default=0)
    item_count = Column(Integer, default=0)
    customer_count = Column(Integer, default=0)
    avg_transaction = Column(Numeric(12, 2), default=Decimal("0.00"))
    hours_worked = Column(Numeric(5, 2), nullable=True)

    user = relationship("User", lazy="joined")

    __table_args__ = (
        UniqueConstraint("user_id", "business_id", "snapshot_date", name="uq_perf_snapshot_user_biz_date"),
    )
