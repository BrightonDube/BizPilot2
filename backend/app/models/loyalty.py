"""Loyalty program models."""

import enum
from sqlalchemy import Column, String, Integer, Numeric, Boolean, DateTime, ForeignKey, Enum as SQLEnum, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class LoyaltyTier(str, enum.Enum):
    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"
    PLATINUM = "platinum"


class PointsTransactionType(str, enum.Enum):
    EARN = "earn"
    REDEEM = "redeem"
    EXPIRE = "expire"
    ADJUST = "adjust"
    BONUS = "bonus"


class LoyaltyProgram(BaseModel):
    """Loyalty program configuration per business."""
    __tablename__ = "loyalty_programs"

    business_id = Column(UUID(as_uuid=True), nullable=False, unique=True, index=True)
    name = Column(String(255), default="Rewards Program")
    points_per_rand = Column(Numeric(8, 2), default=1)  # Points earned per R1 spent
    redemption_rate = Column(Numeric(8, 2), default=100)  # Points needed per R1 discount
    min_redemption_points = Column(Integer, default=100)
    points_expiry_days = Column(Integer, default=365)
    is_active = Column(Boolean, default=True)

    # Tier thresholds (cumulative points)
    silver_threshold = Column(Integer, default=1000)
    gold_threshold = Column(Integer, default=5000)
    platinum_threshold = Column(Integer, default=15000)

    # Tier multipliers
    silver_multiplier = Column(Numeric(4, 2), default=1.5)
    gold_multiplier = Column(Numeric(4, 2), default=2.0)
    platinum_multiplier = Column(Numeric(4, 2), default=3.0)


class CustomerLoyalty(BaseModel):
    """Customer loyalty status."""
    __tablename__ = "customer_loyalty"

    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False, unique=True, index=True)
    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    points_balance = Column(Integer, default=0)
    lifetime_points = Column(Integer, default=0)
    tier = Column(
        SQLEnum(LoyaltyTier, values_callable=lambda x: [e.value for e in x], name='loyaltytier'),
        default=LoyaltyTier.BRONZE,
    )
    tier_updated_at = Column(DateTime(timezone=True), nullable=True)

    customer = relationship("Customer", backref="loyalty", lazy="joined")


class PointsTransaction(BaseModel):
    """Points transaction record."""
    __tablename__ = "points_transactions"

    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False, index=True)
    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    transaction_type = Column(
        SQLEnum(PointsTransactionType, values_callable=lambda x: [e.value for e in x], name='pointstransactiontype'),
        nullable=False,
    )
    points = Column(Integer, nullable=False)
    balance_after = Column(Integer, nullable=False)
    order_id = Column(UUID(as_uuid=True), nullable=True)
    description = Column(Text, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
