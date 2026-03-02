"""General ledger models for accounting."""

import enum
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Enum as SQLEnum, Boolean, Numeric
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB
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


class GLAccountMapping(BaseModel):
    """Maps business events to GL debit/credit accounts for auto-journaling.

    Why a configurable mapping table?
    Different businesses may want the same event type (e.g. "sale") to post
    to different accounts.  Storing mappings in the DB (rather than hard-coding
    in the service layer) lets each business customise their chart of accounts
    integration without code changes.

    mapping_type examples: "sale", "purchase", "payment", "refund", "expense"
    source_id optionally narrows scope, e.g. a category UUID or payment method.
    """

    __tablename__ = "gl_account_mappings"

    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    mapping_type = Column(String(50), nullable=False)
    source_id = Column(String(100), nullable=True)
    debit_account_id = Column(
        UUID(as_uuid=True), ForeignKey("chart_of_accounts.id"), nullable=True
    )
    credit_account_id = Column(
        UUID(as_uuid=True), ForeignKey("chart_of_accounts.id"), nullable=True
    )

    # Relationships
    debit_account = relationship(
        "ChartOfAccount", foreign_keys=[debit_account_id], lazy="joined"
    )
    credit_account = relationship(
        "ChartOfAccount", foreign_keys=[credit_account_id], lazy="joined"
    )


class RecurringEntryFrequency(str, enum.Enum):
    """How often a recurring journal entry should be generated."""
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


class GLAccountBalance(BaseModel):
    """Pre-aggregated account balance for a specific period (year/month).

    Why a separate cache table instead of always aggregating journal lines?
    Financial statements (trial balance, income statement, balance sheet) need
    fast reads.  With thousands of journal lines per month, aggregating on the
    fly is too slow.  This table is updated whenever a journal entry is posted
    or voided, keeping reads O(1) per account-period.
    """

    __tablename__ = "gl_account_balances"

    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    account_id = Column(
        UUID(as_uuid=True),
        ForeignKey("chart_of_accounts.id"),
        nullable=False,
    )
    period_year = Column(sa.Integer, nullable=False)
    period_month = Column(sa.Integer, nullable=False)
    opening_balance = Column(Numeric(14, 2), default=0)
    debit_total = Column(Numeric(14, 2), default=0)
    credit_total = Column(Numeric(14, 2), default=0)
    closing_balance = Column(Numeric(14, 2), default=0)

    # Relationships
    account = relationship("ChartOfAccount", lazy="joined")

    __table_args__ = (
        sa.UniqueConstraint("account_id", "period_year", "period_month",
                            name="uq_gl_account_balances_account_period"),
    )


class GLRecurringEntry(BaseModel):
    """Template for automatically generated journal entries.

    Why JSONB template column?
    Recurring entries need to store a variable number of lines with different
    accounts and amounts.  JSONB gives schema flexibility without a separate
    junction table, and PostgreSQL can index inside it if needed later.
    Template format: {"lines": [{"account_id": "...", "debit": 100, "credit": 0, "memo": "..."}]}
    """

    __tablename__ = "gl_recurring_entries"

    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    frequency = Column(String(20), nullable=False)  # See RecurringEntryFrequency
    next_date = Column(sa.Date, nullable=False)
    end_date = Column(sa.Date, nullable=True)
    template = Column(JSONB, nullable=False)
    is_active = Column(Boolean, default=True)
    last_generated_at = Column(DateTime(timezone=True), nullable=True)


class GLAuditAction(str, enum.Enum):
    """Possible audit actions on GL entities."""
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    POST = "post"
    REVERSE = "reverse"
    CLOSE_PERIOD = "close_period"


class GLAuditLog(BaseModel):
    """Immutable audit trail for all general ledger mutations.

    Why separate from app-wide audit_logs?
    Accounting regulations (GAAP/IFRS) require a dedicated, immutable audit
    trail for financial records.  Mixing with application-level auditing
    would make compliance exports harder and risk accidental purging.
    """

    __tablename__ = "gl_audit_log"

    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    entity_type = Column(String(50), nullable=False)  # journal_entry, account, mapping
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    action = Column(String(50), nullable=False)  # See GLAuditAction
    old_value = Column(JSONB, nullable=True)
    new_value = Column(JSONB, nullable=True)
    performed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    performer = relationship("User", foreign_keys=[performed_by], lazy="joined")
