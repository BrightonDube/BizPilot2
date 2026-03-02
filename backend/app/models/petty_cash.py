"""Petty cash models."""

import enum
from sqlalchemy import Column, String, Numeric, Boolean, DateTime, ForeignKey, Enum as SQLEnum, Text, Integer, Date, ARRAY
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, utc_now


class FundStatus(str, enum.Enum):
    ACTIVE = "active"
    CLOSED = "closed"
    SUSPENDED = "suspended"


class ExpenseStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    DISBURSED = "disbursed"
    CANCELLED = "cancelled"


class PettyCashFund(BaseModel):
    """Petty cash fund per business."""
    __tablename__ = "petty_cash_funds"

    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    initial_amount = Column(Numeric(12, 2), nullable=False)
    current_balance = Column(Numeric(12, 2), nullable=False)
    custodian_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    status = Column(
        SQLEnum(FundStatus, values_callable=lambda x: [e.value for e in x], name='fundstatus'),
        default=FundStatus.ACTIVE,
    )

    custodian = relationship("User", lazy="joined")


class ExpenseCategory(BaseModel):
    """Expense categories for petty cash."""
    __tablename__ = "expense_categories"

    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    gl_account_code = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True)


class PettyCashExpense(BaseModel):
    """Petty cash expense record."""
    __tablename__ = "petty_cash_expenses"

    fund_id = Column(UUID(as_uuid=True), ForeignKey("petty_cash_funds.id"), nullable=False, index=True)
    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("expense_categories.id"), nullable=True)
    requested_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    approved_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    amount = Column(Numeric(12, 2), nullable=False)
    description = Column(Text, nullable=False)
    vendor = Column(String(255), nullable=True)
    receipt_number = Column(String(100), nullable=True)
    expense_date = Column(DateTime(timezone=True), default=utc_now)
    status = Column(
        SQLEnum(ExpenseStatus, values_callable=lambda x: [e.value for e in x], name='expensestatus'),
        default=ExpenseStatus.PENDING,
    )
    rejection_reason = Column(Text, nullable=True)

    fund = relationship("PettyCashFund", lazy="joined")
    category = relationship("ExpenseCategory", lazy="joined")
    requested_by = relationship("User", foreign_keys=[requested_by_id], lazy="joined")
    approved_by = relationship("User", foreign_keys=[approved_by_id], lazy="joined")


class FundReplenishment(BaseModel):
    """Fund replenishment record."""
    __tablename__ = "fund_replenishments"

    fund_id = Column(UUID(as_uuid=True), ForeignKey("petty_cash_funds.id"), nullable=False, index=True)
    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    replenished_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)

    fund = relationship("PettyCashFund", lazy="joined")
    replenished_by = relationship("User", lazy="joined")


class ApprovalStatus(str, enum.Enum):
    """Expense approval decision status."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    DELEGATED = "delegated"


class ApprovalPriority(str, enum.Enum):
    """Priority levels for expense approval requests."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class ExpenseApproval(BaseModel):
    """Multi-level expense approval record.

    Why a separate table instead of columns on PettyCashExpense?
    A request may need approvals at multiple organisational levels
    (e.g. manager then finance).  Each row represents one approver's
    decision for one level, with a unique constraint preventing
    duplicate decisions at the same tier.
    """

    __tablename__ = "expense_approvals"

    request_id = Column(
        UUID(as_uuid=True),
        ForeignKey("expense_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    approver_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    approval_level = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False, default=ApprovalStatus.PENDING.value)
    requested_date = Column(Date, nullable=True)
    required_by_date = Column(Date, nullable=True)
    approved_date = Column(DateTime(timezone=True), nullable=True)
    disbursed_date = Column(DateTime(timezone=True), nullable=True)
    completed_date = Column(DateTime(timezone=True), nullable=True)
    priority = Column(String(20), nullable=False, default=ApprovalPriority.NORMAL.value)
    tags = Column(ARRAY(Text), nullable=True)
    attachments = Column(JSONB, nullable=True)
    notes = Column(Text, nullable=True)

    # Relationships
    approver = relationship("User", foreign_keys=[approver_id], lazy="joined")


# ---------------------------------------------------------------------------
# New petty cash extension models (migration 097)
# ---------------------------------------------------------------------------

class DisbursementStatus(str, enum.Enum):
    """Status of a cash disbursement."""
    PENDING = "pending"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class CashDisbursement(BaseModel):
    """
    Tracks actual cash handover from fund custodian to requester.

    Why separate from ExpenseApproval?
    Approval is a workflow step; disbursement is the physical cash event.
    An expense can be approved but not yet disbursed (custodian absent),
    or disbursed without formal approval (emergency petty cash).
    """
    __tablename__ = "cash_disbursements"

    fund_id = Column(UUID(as_uuid=True), ForeignKey("petty_cash_funds.id"), nullable=False, index=True)
    expense_id = Column(UUID(as_uuid=True), ForeignKey("petty_cash_expenses.id"), nullable=True)
    disbursement_number = Column(String(50), unique=True, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    disbursed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    disbursed_at = Column(DateTime(timezone=True), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), nullable=False, default=DisbursementStatus.PENDING.value)
    notes = Column(Text, nullable=True)

    # Relationships
    fund = relationship("PettyCashFund", foreign_keys=[fund_id], lazy="joined")
    recipient = relationship("User", foreign_keys=[recipient_id], lazy="joined")


class ReceiptStatus(str, enum.Enum):
    """Status of receipt validation."""
    PENDING = "pending"
    VALIDATED = "validated"
    REJECTED = "rejected"


class ExpenseReceipt(BaseModel):
    """
    Receipt image and OCR data for expense verification.

    Why OCR data as JSONB?
    OCR output varies by provider (extracted text, line items, confidence
    scores). JSONB allows flexible storage without schema changes when
    switching OCR providers.
    """
    __tablename__ = "expense_receipts"

    expense_id = Column(UUID(as_uuid=True), ForeignKey("petty_cash_expenses.id"), nullable=False, index=True)
    disbursement_id = Column(UUID(as_uuid=True), ForeignKey("cash_disbursements.id"), nullable=True)
    receipt_number = Column(String(100), nullable=True)
    vendor_name = Column(String(255), nullable=True)
    receipt_date = Column(Date, nullable=True)
    receipt_amount = Column(Numeric(12, 2), nullable=True)
    tax_amount = Column(Numeric(12, 2), nullable=True)
    image_url = Column(Text, nullable=True)
    image_filename = Column(String(255), nullable=True)
    ocr_data = Column(JSONB, nullable=True)
    is_validated = Column(Boolean, nullable=False, default=False)
    validation_notes = Column(Text, nullable=True)
    validated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    validated_at = Column(DateTime(timezone=True), nullable=True)
    change_returned = Column(Numeric(12, 2), nullable=True)
    status = Column(String(20), nullable=False, default=ReceiptStatus.PENDING.value)
    notes = Column(Text, nullable=True)


class ReconciliationStatus(str, enum.Enum):
    """Status of fund reconciliation."""
    PENDING = "pending"
    APPROVED = "approved"
    DISCREPANCY = "discrepancy"


class FundReconciliation(BaseModel):
    """
    Periodic physical count and balance verification of a petty cash fund.

    Why track expected vs actual separately?
    The expected balance is computed from transactions; the actual balance
    is from physical counting. The variance reveals theft, miscounting,
    or unrecorded transactions — critical for audit compliance.
    """
    __tablename__ = "fund_reconciliations"

    fund_id = Column(UUID(as_uuid=True), ForeignKey("petty_cash_funds.id"), nullable=False, index=True)
    reconciliation_number = Column(String(50), unique=True, nullable=False)
    reconciliation_date = Column(Date, nullable=False)
    expected_balance = Column(Numeric(12, 2), nullable=False)
    actual_balance = Column(Numeric(12, 2), nullable=False)
    variance = Column(Numeric(12, 2), nullable=False)
    status = Column(String(20), nullable=False, default=ReconciliationStatus.PENDING.value)
    variance_reason = Column(Text, nullable=True)
    variance_approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    variance_approved_at = Column(DateTime(timezone=True), nullable=True)
    performed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    notes = Column(Text, nullable=True)

    # Relationships
    fund = relationship("PettyCashFund", foreign_keys=[fund_id], lazy="joined")
