"""Gift card schemas for API validation."""

from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field
from datetime import datetime

from app.models.gift_card import GiftCardStatus


class GiftCardCreate(BaseModel):
    """Schema for issuing a new gift card."""

    initial_value: Decimal = Field(..., gt=0)
    customer_name: Optional[str] = Field(None, max_length=255)
    customer_email: Optional[str] = Field(None, max_length=255)
    customer_id: Optional[str] = None
    expires_at: Optional[datetime] = None
    notes: Optional[str] = None


class GiftCardTransactionResponse(BaseModel):
    """Schema for gift card transaction response."""

    id: str
    gift_card_id: str
    transaction_type: str
    amount: Decimal
    balance_after: Decimal
    reference: Optional[str] = None
    notes: Optional[str] = None
    performed_by: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class GiftCardResponse(BaseModel):
    """Schema for gift card response."""

    id: str
    business_id: str
    code: str
    initial_value: Decimal
    current_balance: Decimal
    status: GiftCardStatus
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    expires_at: Optional[datetime] = None
    notes: Optional[str] = None
    transactions: List[GiftCardTransactionResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GiftCardListResponse(BaseModel):
    """Schema for paginated gift card list."""

    items: List[GiftCardResponse]
    total: int
    page: int
    per_page: int
    pages: int


class GiftCardBalanceResponse(BaseModel):
    """Schema for balance check response."""

    code: str
    current_balance: Decimal
    status: GiftCardStatus
    expires_at: Optional[datetime] = None


class RedeemRequest(BaseModel):
    """Schema for redeeming from a gift card."""

    amount: Decimal = Field(..., gt=0)
    reference: Optional[str] = Field(None, max_length=100)


class TopUpRequest(BaseModel):
    """Schema for topping up a gift card."""

    amount: Decimal = Field(..., gt=0)


class GiftCardStatsResponse(BaseModel):
    """Schema for gift card statistics."""

    total_issued: Decimal
    total_redeemed: Decimal
    outstanding_balance: Decimal
    active_count: int
