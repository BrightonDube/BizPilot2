"""Petty cash schemas for API validation."""

from typing import Optional, List
from decimal import Decimal
from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.petty_cash import FundStatus, ExpenseStatus


# --- Fund schemas ---

class FundCreate(BaseModel):
    name: str = Field(..., max_length=255)
    initial_amount: Decimal = Field(..., gt=0)
    custodian_id: Optional[UUID] = None


class FundResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    name: str
    initial_amount: Decimal
    current_balance: Decimal
    custodian_id: Optional[UUID] = None
    status: FundStatus
    created_at: datetime
    updated_at: datetime


class FundListResponse(BaseModel):
    items: List[FundResponse]
    total: int
    page: int
    per_page: int
    pages: int


# --- Category schemas ---

class CategoryCreate(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    gl_account_code: Optional[str] = Field(None, max_length=50)


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    name: str
    description: Optional[str] = None
    gl_account_code: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


# --- Expense schemas ---

class ExpenseCreate(BaseModel):
    amount: Decimal = Field(..., gt=0)
    description: str
    category_id: Optional[UUID] = None
    vendor: Optional[str] = Field(None, max_length=255)
    receipt_number: Optional[str] = Field(None, max_length=100)


class ExpenseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    fund_id: UUID
    business_id: UUID
    category_id: Optional[UUID] = None
    requested_by_id: UUID
    approved_by_id: Optional[UUID] = None
    amount: Decimal
    description: str
    vendor: Optional[str] = None
    receipt_number: Optional[str] = None
    expense_date: Optional[datetime] = None
    status: ExpenseStatus
    rejection_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ExpenseListResponse(BaseModel):
    items: List[ExpenseResponse]
    total: int
    page: int
    per_page: int
    pages: int


class RejectRequest(BaseModel):
    reason: str


# --- Replenishment schemas ---

class ReplenishRequest(BaseModel):
    amount: Decimal = Field(..., gt=0)
    notes: Optional[str] = None


class ReplenishmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    fund_id: UUID
    business_id: UUID
    amount: Decimal
    replenished_by_id: Optional[UUID] = None
    notes: Optional[str] = None
    created_at: datetime


# --- Summary / Report schemas ---

class FundSummary(BaseModel):
    fund_id: UUID
    fund_name: str
    initial_amount: Decimal
    current_balance: Decimal
    total_expenses: Decimal
    total_replenishments: Decimal
    pending_expenses: int
    approved_expenses: int


class CategoryExpenseTotal(BaseModel):
    category_id: Optional[UUID] = None
    category_name: str
    total: Decimal
    count: int


class ExpenseReport(BaseModel):
    business_id: UUID
    date_from: datetime
    date_to: datetime
    total_expenses: Decimal
    by_category: List[CategoryExpenseTotal]
