"""Petty cash models."""

import enum
from sqlalchemy import Column, String, Numeric, Boolean, DateTime, ForeignKey, Enum as SQLEnum, Text
from sqlalchemy.dialects.postgresql import UUID
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
