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


class AccountBalanceResponse(BaseModel):
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
