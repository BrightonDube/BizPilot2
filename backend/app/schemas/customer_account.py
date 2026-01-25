"""Customer Account schemas for API validation."""

from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field, field_validator
from datetime import datetime, date
from uuid import UUID

from app.models.customer_account import AccountStatus, TransactionType, ActivityType


# ============================================================================
# Account Schemas
# ============================================================================

class AccountBase(BaseModel):
    """Base schema for customer account."""
    
    credit_limit: Decimal = Field(default=Decimal('0'), ge=0, description="Maximum credit limit for the account")
    payment_terms: int = Field(default=30, ge=0, le=365, description="Payment terms in days (e.g., Net 30)")
    notes: Optional[str] = Field(None, description="Additional notes about the account")


class AccountCreate(AccountBase):
    """Schema for creating a customer account."""
    
    customer_id: UUID = Field(..., description="ID of the customer this account belongs to")
    account_pin: Optional[str] = Field(None, min_length=4, max_length=6, description="Optional PIN for account verification")
    
    @field_validator('account_pin')
    @classmethod
    def validate_pin(cls, v: Optional[str]) -> Optional[str]:
        """Validate PIN is numeric if provided."""
        if v is not None and not v.isdigit():
            raise ValueError('PIN must contain only digits')
        return v


class AccountUpdate(BaseModel):
    """Schema for updating a customer account."""
    
    credit_limit: Optional[Decimal] = Field(None, ge=0, description="Maximum credit limit for the account")
    payment_terms: Optional[int] = Field(None, ge=0, le=365, description="Payment terms in days")
    account_pin: Optional[str] = Field(None, min_length=4, max_length=6, description="Account PIN")
    notes: Optional[str] = Field(None, description="Additional notes")
    
    @field_validator('account_pin')
    @classmethod
    def validate_pin(cls, v: Optional[str]) -> Optional[str]:
        """Validate PIN is numeric if provided."""
        if v is not None and not v.isdigit():
            raise ValueError('PIN must contain only digits')
        return v


class AccountResponse(AccountBase):
    """Schema for customer account response."""
    
    id: UUID
    customer_id: UUID
    business_id: UUID
    account_number: str
    status: AccountStatus
    current_balance: Decimal
    available_credit: Decimal
    opened_at: Optional[datetime] = None
    suspended_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    # Computed properties
    is_active: bool
    is_suspended: bool
    is_closed: bool
    is_over_limit: bool
    credit_utilization: float
    
    model_config = {"from_attributes": True}


class AccountListResponse(BaseModel):
    """Schema for paginated account list."""
    
    items: List[AccountResponse]
    total: int
    page: int
    per_page: int
    pages: int


class AccountStatusUpdate(BaseModel):
    """Schema for updating account status."""
    
    status: AccountStatus = Field(..., description="New account status")
    reason: Optional[str] = Field(None, description="Reason for status change")


class AccountBalance(BaseModel):
    """Schema for account balance information."""
    
    account_id: UUID
    current_balance: Decimal
    available_credit: Decimal
    credit_limit: Decimal
    credit_utilization: float
    is_over_limit: bool


class CreditValidation(BaseModel):
    """Schema for credit validation result."""
    
    is_valid: bool
    available_credit: Decimal
    requested_amount: Decimal
    message: str


# ============================================================================
# Transaction Schemas
# ============================================================================

class TransactionBase(BaseModel):
    """Base schema for account transaction."""
    
    amount: Decimal = Field(..., description="Transaction amount")
    description: Optional[str] = Field(None, description="Transaction description")


class ChargeCreate(TransactionBase):
    """Schema for creating a charge to account."""
    
    reference_type: Optional[str] = Field(None, max_length=20, description="Type of reference (e.g., 'order', 'invoice')")
    reference_id: Optional[UUID] = Field(None, description="ID of the referenced entity")
    due_date: Optional[date] = Field(None, description="Payment due date")
    
    @field_validator('amount')
    @classmethod
    def validate_charge_amount(cls, v: Decimal) -> Decimal:
        """Validate charge amount is positive."""
        if v <= 0:
            raise ValueError('Charge amount must be positive')
        return v


class AdjustmentCreate(TransactionBase):
    """Schema for creating a balance adjustment."""
    
    reason: str = Field(..., min_length=1, description="Reason for adjustment")
    
    @field_validator('amount')
    @classmethod
    def validate_adjustment_amount(cls, v: Decimal) -> Decimal:
        """Validate adjustment amount is not zero."""
        if v == 0:
            raise ValueError('Adjustment amount cannot be zero')
        return v


class TransactionResponse(BaseModel):
    """Schema for transaction response."""
    
    id: UUID
    account_id: UUID
    transaction_type: TransactionType
    reference_type: Optional[str] = None
    reference_id: Optional[UUID] = None
    amount: Decimal
    balance_after: Decimal
    description: Optional[str] = None
    due_date: Optional[date] = None
    created_by: Optional[UUID] = None
    created_at: datetime
    
    # Computed properties
    is_charge: bool
    is_payment: bool
    
    model_config = {"from_attributes": True}


class TransactionListResponse(BaseModel):
    """Schema for paginated transaction list."""
    
    items: List[TransactionResponse]
    total: int
    page: int
    per_page: int
    pages: int


class TransactionSummary(BaseModel):
    """Schema for transaction summary in statements."""
    
    date: datetime
    transaction_type: TransactionType
    description: Optional[str] = None
    amount: Decimal
    balance: Decimal


# ============================================================================
# Payment Schemas
# ============================================================================

class PaymentBase(BaseModel):
    """Base schema for account payment."""
    
    amount: Decimal = Field(..., gt=0, description="Payment amount (must be positive)")
    payment_method: str = Field(..., min_length=1, max_length=50, description="Payment method (e.g., 'cash', 'card', 'bank_transfer')")
    reference_number: Optional[str] = Field(None, max_length=100, description="Payment reference number")
    notes: Optional[str] = Field(None, description="Additional payment notes")


class PaymentCreate(PaymentBase):
    """Schema for creating a payment."""
    pass


class PaymentResponse(PaymentBase):
    """Schema for payment response."""
    
    id: UUID
    account_id: UUID
    received_by: Optional[UUID] = None
    created_at: datetime
    
    # Computed properties
    allocated_amount: Decimal
    unallocated_amount: Decimal
    
    model_config = {"from_attributes": True}


class PaymentListResponse(BaseModel):
    """Schema for paginated payment list."""
    
    items: List[PaymentResponse]
    total: int
    page: int
    per_page: int
    pages: int


class PaymentAllocationResponse(BaseModel):
    """Schema for payment allocation response."""
    
    id: UUID
    payment_id: UUID
    transaction_id: UUID
    amount: Decimal
    created_at: datetime
    
    model_config = {"from_attributes": True}


# ============================================================================
# Statement Schemas
# ============================================================================

class AgingBreakdown(BaseModel):
    """Schema for aging breakdown."""
    
    current: Decimal = Field(default=Decimal('0'), description="Current balance (not overdue)")
    days_30: Decimal = Field(default=Decimal('0'), description="Balance 1-30 days overdue")
    days_60: Decimal = Field(default=Decimal('0'), description="Balance 31-60 days overdue")
    days_90_plus: Decimal = Field(default=Decimal('0'), description="Balance 90+ days overdue")
    total: Decimal = Field(default=Decimal('0'), description="Total aged balance")


class StatementResponse(BaseModel):
    """Schema for account statement response."""
    
    id: UUID
    account_id: UUID
    statement_date: date
    period_start: date
    period_end: date
    opening_balance: Decimal
    total_charges: Decimal
    total_payments: Decimal
    closing_balance: Decimal
    aging: AgingBreakdown
    sent_at: Optional[datetime] = None
    created_at: datetime
    
    # Computed properties
    is_sent: bool
    
    model_config = {"from_attributes": True}


class StatementListResponse(BaseModel):
    """Schema for paginated statement list."""
    
    items: List[StatementResponse]
    total: int
    page: int
    per_page: int
    pages: int


class StatementGenerate(BaseModel):
    """Schema for generating a statement."""
    
    period_end: date = Field(..., description="End date for the statement period")
    period_start: Optional[date] = Field(None, description="Start date for the statement period (defaults to last statement)")


class StatementSend(BaseModel):
    """Schema for sending a statement."""
    
    email: Optional[str] = Field(None, description="Email address to send to (defaults to customer email)")


# ============================================================================
# Collection Activity Schemas
# ============================================================================

class ActivityBase(BaseModel):
    """Base schema for collection activity."""
    
    activity_type: ActivityType = Field(..., description="Type of collection activity")
    notes: Optional[str] = Field(None, description="Activity notes")
    outcome: Optional[str] = Field(None, max_length=50, description="Activity outcome")


class ActivityCreate(ActivityBase):
    """Schema for creating a collection activity."""
    
    promise_date: Optional[date] = Field(None, description="Date customer promised to pay")
    promise_amount: Optional[Decimal] = Field(None, gt=0, description="Amount customer promised to pay")
    
    @field_validator('promise_amount')
    @classmethod
    def validate_promise_with_date(cls, v: Optional[Decimal], info) -> Optional[Decimal]:
        """Validate that promise_date is provided if promise_amount is set."""
        if v is not None and info.data.get('promise_date') is None:
            raise ValueError('promise_date is required when promise_amount is provided')
        return v


class ActivityResponse(ActivityBase):
    """Schema for collection activity response."""
    
    id: UUID
    account_id: UUID
    promise_date: Optional[date] = None
    promise_amount: Optional[Decimal] = None
    performed_by: Optional[UUID] = None
    created_at: datetime
    
    # Computed properties
    has_promise: bool
    
    model_config = {"from_attributes": True}


class ActivityListResponse(BaseModel):
    """Schema for paginated activity list."""
    
    items: List[ActivityResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ============================================================================
# Write-off Schemas
# ============================================================================

class WriteOffCreate(BaseModel):
    """Schema for creating a write-off."""
    
    amount: Decimal = Field(..., gt=0, description="Amount to write off")
    reason: str = Field(..., min_length=1, description="Reason for write-off")


class WriteOffResponse(BaseModel):
    """Schema for write-off response."""
    
    id: UUID
    account_id: UUID
    amount: Decimal
    reason: str
    approved_by: Optional[UUID] = None
    created_at: datetime
    
    model_config = {"from_attributes": True}


class WriteOffListResponse(BaseModel):
    """Schema for paginated write-off list."""
    
    items: List[WriteOffResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ============================================================================
# Report Schemas
# ============================================================================

class OverdueAccount(BaseModel):
    """Schema for overdue account information."""
    
    account_id: UUID
    customer_id: UUID
    customer_name: str
    account_number: str
    current_balance: Decimal
    days_overdue: int
    oldest_invoice_date: Optional[date] = None
    aging: AgingBreakdown


class OverdueAccountsResponse(BaseModel):
    """Schema for overdue accounts report."""
    
    accounts: List[OverdueAccount]
    total_overdue: Decimal
    total_accounts: int


class ARSummary(BaseModel):
    """Schema for accounts receivable summary."""
    
    total_receivable: Decimal
    total_accounts: int
    active_accounts: int
    overdue_accounts: int
    total_overdue: Decimal
    average_days_overdue: float
    aging_breakdown: AgingBreakdown


class DSOReport(BaseModel):
    """Schema for Days Sales Outstanding report."""
    
    dso: float
    period_days: int
    total_credit_sales: Decimal
    average_receivables: Decimal
    calculation_date: date


class CustomerAccountMetrics(BaseModel):
    """Schema for customer account metrics."""
    
    account_id: UUID
    total_charges: Decimal
    total_payments: Decimal
    current_balance: Decimal
    payment_history_count: int
    average_payment_days: Optional[float] = None
    last_payment_date: Optional[datetime] = None
    last_charge_date: Optional[datetime] = None
