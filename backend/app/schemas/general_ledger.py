"""General ledger schemas for API validation."""

from typing import Optional, List
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, Field


# --- Chart of Accounts ---

class AccountCreate(BaseModel):
    """Schema for creating an account."""
    account_code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=1, max_length=255)
    account_type: str = Field(..., pattern="^(asset|liability|equity|revenue|expense)$")
    parent_id: Optional[str] = None
    description: Optional[str] = None
    normal_balance: str = Field("debit", pattern="^(debit|credit)$")


class AccountResponse(BaseModel):
    """Schema for account response."""
    id: str
    business_id: str
    account_code: str
    name: str
    account_type: str
    parent_id: Optional[str] = None
    description: Optional[str] = None
    is_active: bool
    normal_balance: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AccountBalanceSummary(BaseModel):
    """Schema for account balance response."""
    account_id: str
    account_code: str
    account_name: str
    account_type: str
    debit_total: Decimal
    credit_total: Decimal
    balance: Decimal


class AccountListResponse(BaseModel):
    """Schema for account list response."""
    items: List[AccountResponse]
    total: int


# --- Journal Entry ---

class JournalLineCreate(BaseModel):
    """Schema for creating a journal line."""
    account_id: str
    debit: Decimal = Decimal("0")
    credit: Decimal = Decimal("0")
    description: Optional[str] = None


class JournalEntryCreate(BaseModel):
    """Schema for creating a journal entry."""
    description: str = Field(..., min_length=1)
    reference: Optional[str] = Field(None, max_length=100)
    lines: List[JournalLineCreate] = Field(..., min_length=2)
    is_auto: bool = False


class JournalLineResponse(BaseModel):
    """Schema for journal line response."""
    id: str
    account_id: str
    account_code: Optional[str] = None
    account_name: Optional[str] = None
    debit: Decimal
    credit: Decimal
    description: Optional[str] = None

    model_config = {"from_attributes": True}


class JournalEntryResponse(BaseModel):
    """Schema for journal entry response."""
    id: str
    business_id: str
    entry_number: str
    entry_date: datetime
    description: str
    reference: Optional[str] = None
    status: str
    is_auto: bool
    created_by_id: Optional[str] = None
    posted_by_id: Optional[str] = None
    posted_at: Optional[datetime] = None
    lines: List[JournalLineResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class JournalEntryListResponse(BaseModel):
    """Schema for paginated journal entry list."""
    items: List[JournalEntryResponse]
    total: int
    page: int
    per_page: int
    pages: int


# --- Reports ---

class TrialBalanceRow(BaseModel):
    """Single row in trial balance."""
    account_id: str
    account_code: str
    account_name: str
    account_type: str
    debit: Decimal
    credit: Decimal


class TrialBalanceResponse(BaseModel):
    """Trial balance report."""
    as_of: datetime
    rows: List[TrialBalanceRow]
    total_debit: Decimal
    total_credit: Decimal


class IncomeStatementRow(BaseModel):
    """Single row in income statement."""
    account_id: str
    account_code: str
    account_name: str
    balance: Decimal


class IncomeStatementResponse(BaseModel):
    """Income statement / P&L report."""
    start_date: datetime
    end_date: datetime
    revenue: List[IncomeStatementRow]
    expenses: List[IncomeStatementRow]
    total_revenue: Decimal
    total_expenses: Decimal
    net_income: Decimal


class BalanceSheetRow(BaseModel):
    """Single row in balance sheet."""
    account_id: str
    account_code: str
    account_name: str
    balance: Decimal


class BalanceSheetResponse(BaseModel):
    """Balance sheet report."""
    as_of: datetime
    assets: List[BalanceSheetRow]
    liabilities: List[BalanceSheetRow]
    equity: List[BalanceSheetRow]
    total_assets: Decimal
    total_liabilities: Decimal
    total_equity: Decimal


# --- Account Balances (period cache) ---

class AccountBalanceResponse(BaseModel):
    """Pre-aggregated balance for a single account-period."""
    id: str
    business_id: str
    account_id: str
    period_year: int
    period_month: int
    opening_balance: Decimal
    debit_total: Decimal
    credit_total: Decimal
    closing_balance: Decimal
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AccountBalanceListResponse(BaseModel):
    """Paginated list of account balances."""
    items: List[AccountBalanceResponse]
    total: int
    page: int
    per_page: int
    pages: int


# --- Recurring Entries ---

class RecurringEntryCreate(BaseModel):
    """Schema for creating a recurring journal entry template."""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    frequency: str = Field(..., pattern="^(daily|weekly|monthly|quarterly|yearly)$")
    next_date: str  # ISO date string
    end_date: Optional[str] = None
    template: dict  # {"lines": [{"account_id": "...", "debit": 100, "credit": 0}]}
    is_active: bool = True


class RecurringEntryUpdate(BaseModel):
    """Schema for updating a recurring entry template."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    frequency: Optional[str] = Field(None, pattern="^(daily|weekly|monthly|quarterly|yearly)$")
    next_date: Optional[str] = None
    end_date: Optional[str] = None
    template: Optional[dict] = None
    is_active: Optional[bool] = None


class RecurringEntryResponse(BaseModel):
    """Response schema for a recurring entry template."""
    id: str
    business_id: str
    name: str
    description: Optional[str] = None
    frequency: str
    next_date: str
    end_date: Optional[str] = None
    template: dict
    is_active: bool
    last_generated_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RecurringEntryListResponse(BaseModel):
    """Paginated list of recurring entry templates."""
    items: List[RecurringEntryResponse]
    total: int
    page: int
    per_page: int
    pages: int


# --- GL Audit Log ---

class GLAuditLogResponse(BaseModel):
    """Single audit log entry for a GL mutation."""
    id: str
    business_id: str
    entity_type: str
    entity_id: str
    action: str
    old_value: Optional[dict] = None
    new_value: Optional[dict] = None
    performed_by: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class GLAuditLogListResponse(BaseModel):
    """Paginated list of GL audit log entries."""
    items: List[GLAuditLogResponse]
    total: int
    page: int
    per_page: int
    pages: int
