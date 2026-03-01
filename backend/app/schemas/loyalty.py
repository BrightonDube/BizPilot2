"""Loyalty program schemas for API validation."""

from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field
from datetime import datetime

from app.models.loyalty import LoyaltyTier, PointsTransactionType


class LoyaltyProgramResponse(BaseModel):
    """Schema for loyalty program config response."""

    id: str
    business_id: str
    name: str
    points_per_rand: Decimal
    redemption_rate: Decimal
    min_redemption_points: int
    points_expiry_days: int
    is_active: bool
    silver_threshold: int
    gold_threshold: int
    platinum_threshold: int
    silver_multiplier: Decimal
    gold_multiplier: Decimal
    platinum_multiplier: Decimal
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LoyaltyProgramUpdate(BaseModel):
    """Schema for updating loyalty program settings."""

    name: Optional[str] = Field(None, max_length=255)
    points_per_rand: Optional[Decimal] = None
    redemption_rate: Optional[Decimal] = None
    min_redemption_points: Optional[int] = None
    points_expiry_days: Optional[int] = None
    is_active: Optional[bool] = None
    silver_threshold: Optional[int] = None
    gold_threshold: Optional[int] = None
    platinum_threshold: Optional[int] = None
    silver_multiplier: Optional[Decimal] = None
    gold_multiplier: Optional[Decimal] = None
    platinum_multiplier: Optional[Decimal] = None


class CustomerLoyaltyResponse(BaseModel):
    """Schema for customer loyalty status response."""

    id: str
    customer_id: str
    business_id: str
    points_balance: int
    lifetime_points: int
    tier: LoyaltyTier
    tier_updated_at: Optional[datetime] = None
    customer_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CustomerLoyaltyListResponse(BaseModel):
    """Schema for paginated loyalty members list."""

    items: List[CustomerLoyaltyResponse]
    total: int
    page: int
    per_page: int
    pages: int


class PointsTransactionResponse(BaseModel):
    """Schema for points transaction response."""

    id: str
    customer_id: str
    business_id: str
    transaction_type: PointsTransactionType
    points: int
    balance_after: int
    order_id: Optional[str] = None
    description: Optional[str] = None
    expires_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PointsHistoryResponse(BaseModel):
    """Schema for paginated points history."""

    items: List[PointsTransactionResponse]
    total: int
    page: int
    per_page: int
    pages: int


class EarnPointsRequest(BaseModel):
    """Schema for earning points."""

    customer_id: str
    amount_spent: Decimal = Field(..., gt=0)
    order_id: Optional[str] = None


class RedeemPointsRequest(BaseModel):
    """Schema for redeeming points."""

    customer_id: str
    points: int = Field(..., gt=0)
    order_id: Optional[str] = None


class RedeemPointsResponse(BaseModel):
    """Schema for redeem points response."""

    points_redeemed: int
    discount_value: Decimal
    remaining_balance: int


class ProgramStatsResponse(BaseModel):
    """Schema for program statistics."""

    total_members: int
    active_members: int
    total_points_issued: int
    total_points_redeemed: int
    total_points_outstanding: int
    members_by_tier: dict
