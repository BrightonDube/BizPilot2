"""Cash register schemas for API validation."""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.cash_register import RegisterStatus


# --- Register schemas ---


class RegisterCreate(BaseModel):
    name: str = Field(..., max_length=255)
    location_id: Optional[UUID] = None


class RegisterUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    location_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class RegisterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    name: str
    location_id: Optional[UUID] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


# --- Session schemas ---


class OpenSessionRequest(BaseModel):
    opening_float: Decimal = Field(default=Decimal("0"), ge=0)


class CloseSessionRequest(BaseModel):
    actual_cash: Decimal
    notes: Optional[str] = None


class CashMovementRequest(BaseModel):
    movement_type: str = Field(..., pattern=r"^(cash_in|cash_out|pay_in|pay_out)$")
    amount: Decimal = Field(..., gt=0)
    reason: str = Field(..., max_length=255)


class RecordSaleRequest(BaseModel):
    amount: Decimal = Field(..., gt=0)
    payment_method: str  # cash, card, etc.


class CashMovementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: UUID
    business_id: UUID
    movement_type: str
    amount: Decimal
    reason: str
    performed_by: UUID
    created_at: datetime


class SessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    register_id: UUID
    business_id: UUID
    opened_by: UUID
    closed_by: Optional[UUID] = None
    status: RegisterStatus
    opening_float: Decimal
    closing_float: Optional[Decimal] = None
    expected_cash: Optional[Decimal] = None
    actual_cash: Optional[Decimal] = None
    cash_difference: Optional[Decimal] = None
    total_sales: Decimal
    total_refunds: Decimal
    total_cash_payments: Decimal
    total_card_payments: Decimal
    transaction_count: int
    opened_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    notes: Optional[str] = None
    movements: List[CashMovementResponse] = []
    created_at: datetime
    updated_at: datetime


class SessionListResponse(BaseModel):
    items: List[SessionResponse]
    total: int
    page: int
    per_page: int
    pages: int


# --- Report schemas ---


class RegisterReport(BaseModel):
    business_id: UUID
    total_sessions: int
    total_sales: Decimal
    avg_cash_difference: Decimal
    sessions_with_discrepancy: int
