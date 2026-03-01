"""General ledger models for accounting."""

import enum
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Enum as SQLEnum, Boolean, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, utc_now


class AccountType(str, enum.Enum):
    ASSET = "asset"
    LIABILITY = "liability"
    EQUITY = "equity"
    REVENUE = "revenue"
    EXPENSE = "expense"


class JournalEntryStatus(str, enum.Enum):
    DRAFT = "draft"
    POSTED = "posted"
    VOIDED = "voided"


class ChartOfAccount(BaseModel):
    """Chart of accounts."""
    __tablename__ = "chart_of_accounts"

    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    account_code = Column(String(20), nullable=False)
    name = Column(String(255), nullable=False)
    account_type = Column(
        SQLEnum(AccountType, values_callable=lambda x: [e.value for e in x], name='glaccounttype'),
        nullable=False,
    )
    parent_id = Column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id"), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    normal_balance = Column(String(10), default="debit")  # debit or credit

    parent = relationship("ChartOfAccount", remote_side="ChartOfAccount.id", lazy="joined")


class JournalEntry(BaseModel):
    """Journal entry header."""
    __tablename__ = "journal_entries"

    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    entry_number = Column(String(50), nullable=False, unique=True)
    entry_date = Column(DateTime(timezone=True), default=utc_now)
    description = Column(Text, nullable=False)
    reference = Column(String(100), nullable=True)
    status = Column(
        SQLEnum(JournalEntryStatus, values_callable=lambda x: [e.value for e in x], name='journalentrystatus'),
        default=JournalEntryStatus.DRAFT,
    )
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    posted_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    posted_at = Column(DateTime(timezone=True), nullable=True)
    is_auto = Column(Boolean, default=False)  # Auto-generated from transactions

    created_by = relationship("User", foreign_keys=[created_by_id], lazy="joined")
    lines = relationship("JournalLine", back_populates="entry", lazy="selectin")


class JournalLine(BaseModel):
    """Journal entry line item."""
    __tablename__ = "journal_lines"

    entry_id = Column(UUID(as_uuid=True), ForeignKey("journal_entries.id"), nullable=False, index=True)
    account_id = Column(UUID(as_uuid=True), ForeignKey("chart_of_accounts.id"), nullable=False, index=True)
    debit = Column(Numeric(12, 2), default=0)
    credit = Column(Numeric(12, 2), default=0)
    description = Column(Text, nullable=True)

    entry = relationship("JournalEntry", back_populates="lines")
    account = relationship("ChartOfAccount", lazy="joined")


class FiscalPeriod(BaseModel):
    """Fiscal period for period closing."""
    __tablename__ = "fiscal_periods"

    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    name = Column(String(50), nullable=False)  # e.g. "2024-01", "FY2024 Q1"
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    is_closed = Column(Boolean, default=False)
    closed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
