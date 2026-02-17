"""Pydantic schemas for layby endpoints."""

from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime, date
from uuid import UUID
from decimal import Decimal


# ── Request Schemas ──────────────────────────────────────────────────────────


class LaybyItemCreate(BaseModel):
    product_id: UUID
    quantity: int
    unit_price: Decimal


class LaybyCreate(BaseModel):
    customer_id: UUID
    items: List[LaybyItemCreate]
    deposit_amount: Decimal
    payment_frequency: str  # weekly, bi_weekly, monthly
    notes: Optional[str] = None


class PaymentCreate(BaseModel):
    amount: Decimal
    payment_method: str  # cash, card, eft
    reference: Optional[str] = None


class LaybyExtendRequest(BaseModel):
    additional_days: int
    reason: Optional[str] = None


class LaybyCancelRequest(BaseModel):
    reason: Optional[str] = None


class LaybyConfigUpdate(BaseModel):
    min_deposit_percentage: Optional[Decimal] = None
    max_duration_days: Optional[int] = None
    cancellation_fee_percentage: Optional[Decimal] = None
    cancellation_fee_minimum: Optional[Decimal] = None
    restocking_fee_per_item: Optional[Decimal] = None
    extension_fee: Optional[Decimal] = None
    max_extensions: Optional[int] = None
    reminder_days_before: Optional[int] = None
    collection_grace_days: Optional[int] = None
    is_enabled: Optional[bool] = None


# ── Response Schemas ─────────────────────────────────────────────────────────


class LaybyItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product_id: UUID
    product_name: str
    product_sku: Optional[str] = None
    quantity: int
    unit_price: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal


class LaybyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    reference_number: str
    customer_id: UUID
    customer_name: Optional[str] = None
    status: str
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    deposit_amount: Decimal
    amount_paid: Decimal
    balance_due: Decimal
    payment_frequency: str
    start_date: date
    end_date: date
    next_payment_date: Optional[date] = None
    next_payment_amount: Optional[Decimal] = None
    extension_count: int
    notes: Optional[str] = None
    items: List[LaybyItemResponse] = []
    created_at: datetime
    updated_at: datetime


class LaybyListResponse(BaseModel):
    items: List[LaybyResponse]
    total: int
    page: int
    per_page: int
    pages: int


class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    amount: Decimal
    payment_method: str
    payment_type: str
    status: str
    payment_reference: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime


class ScheduleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    installment_number: int
    due_date: date
    amount_due: Decimal
    amount_paid: Decimal
    status: str


class LaybyConfigResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    min_deposit_percentage: Decimal
    max_duration_days: int
    cancellation_fee_percentage: Decimal
    cancellation_fee_minimum: Decimal
    restocking_fee_per_item: Decimal
    extension_fee: Decimal
    max_extensions: int
    reminder_days_before: int
    collection_grace_days: int
    is_enabled: bool
