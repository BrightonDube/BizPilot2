"""Pydantic schemas for integrated payment processing.

Covers payment method configuration and payment transaction audit trail.
"""

from datetime import datetime
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Payment Method schemas
# ---------------------------------------------------------------------------


class PaymentMethodCreate(BaseModel):
    """Configure a new payment method for a business."""

    name: str = Field(..., max_length=100)
    method_type: str = Field(
        ...,
        description="cash | card | eft | snapscan | mobile | gift_card | account",
    )
    provider: Optional[str] = None
    config: Optional[dict[str, Any]] = None
    is_active: bool = True
    sort_order: int = 0


class PaymentMethodUpdate(BaseModel):
    """Update an existing payment method."""

    name: Optional[str] = None
    method_type: Optional[str] = None
    provider: Optional[str] = None
    config: Optional[dict[str, Any]] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class PaymentMethodResponse(BaseModel):
    """Response schema for a payment method."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    name: str
    method_type: str
    provider: Optional[str] = None
    config: Optional[dict[str, Any]] = None
    is_active: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime


class PaymentMethodListResponse(BaseModel):
    """Paginated list of payment methods."""

    items: list[PaymentMethodResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ---------------------------------------------------------------------------
# Payment Transaction schemas
# ---------------------------------------------------------------------------


class PaymentTransactionCreate(BaseModel):
    """Create a new payment transaction for an order."""

    order_id: UUID
    payment_method_id: Optional[UUID] = None
    amount: Decimal = Field(..., gt=0)
    tip_amount: Decimal = Field(default=Decimal("0"), ge=0)


class PaymentTransactionResponse(BaseModel):
    """Response schema for a payment transaction."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    order_id: UUID
    payment_method_id: Optional[UUID] = None
    amount: Decimal
    tip_amount: Decimal
    status: str
    gateway_reference: Optional[str] = None
    gateway_response: Optional[dict[str, Any]] = None
    refund_of_id: Optional[UUID] = None
    processed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class PaymentTransactionListResponse(BaseModel):
    """Paginated list of payment transactions."""

    items: list[PaymentTransactionResponse]
    total: int
    page: int
    per_page: int
    pages: int
