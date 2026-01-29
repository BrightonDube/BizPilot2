"""Customer Account models for accounts receivable management."""

from sqlalchemy import Column, String, Text, Numeric, Integer, ForeignKey, Enum as SQLEnum, DateTime, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.ext.hybrid import hybrid_property
from decimal import Decimal
import enum

from app.models.base import BaseModel


class AccountStatus(str, enum.Enum):
    """Customer account status."""

    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    CLOSED = "closed"


class TransactionType(str, enum.Enum):
    """Account transaction type."""

    CHARGE = "charge"
    PAYMENT = "payment"
    ADJUSTMENT = "adjustment"
    WRITE_OFF = "write_off"


class ActivityType(str, enum.Enum):
    """Collection activity type."""

    PHONE_CALL = "phone_call"
    EMAIL = "email"
    LETTER = "letter"
    VISIT = "visit"
    PROMISE = "promise"
    NOTE = "note"


class CustomerAccount(BaseModel):
    """Customer account model for accounts receivable."""

    __tablename__ = "customer_accounts"

    # Foreign keys
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)

    # Account details
    account_number = Column(String(50), nullable=False, unique=True, index=True)
    status: Column[AccountStatus] = Column(
        SQLEnum(AccountStatus, values_callable=lambda x: [e.value for e in x], name='accountstatus'),
        default=AccountStatus.PENDING,
        nullable=False,
        index=True
    )

    # Credit management
    credit_limit = Column(Numeric(12, 2), nullable=False, default=0)
    current_balance = Column(Numeric(12, 2), nullable=False, default=0)
    payment_terms = Column(Integer, nullable=False, default=30)  # Days

    # Security
    account_pin = Column(String(100), nullable=True)  # Hashed PIN for verification

    # Status dates
    opened_at = Column(DateTime(timezone=True), nullable=True)
    suspended_at = Column(DateTime(timezone=True), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)

    # Additional info
    notes = Column(Text, nullable=True)

    # Relationships
    customer = relationship("Customer", backref="accounts", lazy="joined")
    business = relationship("Business", backref="customer_accounts", lazy="joined")
    transactions = relationship(
        "AccountTransaction",
        back_populates="account",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="AccountTransaction.created_at.desc()"
    )
    payments = relationship(
        "AccountPayment",
        back_populates="account",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="AccountPayment.created_at.desc()"
    )
    statements = relationship(
        "AccountStatement",
        back_populates="account",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="AccountStatement.statement_date.desc()"
    )
    collection_activities = relationship(
        "CollectionActivity",
        back_populates="account",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="CollectionActivity.created_at.desc()"
    )
    write_offs = relationship(
        "AccountWriteOff",
        back_populates="account",
        lazy="selectin",
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<CustomerAccount {self.account_number}>"

    @hybrid_property
    def available_credit(self) -> Decimal:
        """Calculate available credit (limit - balance)."""
        return Decimal(str(self.credit_limit)) - Decimal(str(self.current_balance))

    @property
    def is_active(self) -> bool:
        """Check if account is active."""
        return self.status == AccountStatus.ACTIVE  # type: ignore[comparison-overlap]

    @property
    def is_suspended(self) -> bool:
        """Check if account is suspended."""
        return self.status == AccountStatus.SUSPENDED  # type: ignore[comparison-overlap]

    @property
    def is_closed(self) -> bool:
        """Check if account is closed."""
        return self.status == AccountStatus.CLOSED  # type: ignore[comparison-overlap]

    @property
    def is_over_limit(self) -> bool:
        """Check if current balance exceeds credit limit."""
        return Decimal(str(self.current_balance)) > Decimal(str(self.credit_limit))

    @property
    def credit_utilization(self) -> float:
        """Calculate credit utilization percentage."""
        if self.credit_limit == 0:
            return 0.0
        return float((Decimal(str(self.current_balance)) / Decimal(str(self.credit_limit))) * 100)



class AccountTransaction(BaseModel):
    """Account transaction model for tracking charges, payments, and adjustments."""

    __tablename__ = "account_transactions"

    # Foreign keys
    account_id = Column(UUID(as_uuid=True), ForeignKey("customer_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Transaction details
    transaction_type: Column[TransactionType] = Column(
        SQLEnum(TransactionType, values_callable=lambda x: [e.value for e in x], name='transactiontype'),
        nullable=False,
        index=True
    )
    reference_type = Column(String(20), nullable=True)  # 'order', 'invoice', 'manual'
    reference_id = Column(UUID(as_uuid=True), nullable=True)

    # Amounts
    amount = Column(Numeric(12, 2), nullable=False)
    balance_after = Column(Numeric(12, 2), nullable=False)

    # Details
    description = Column(Text, nullable=True)
    due_date = Column(Date, nullable=True)

    # Relationships
    account = relationship("CustomerAccount", back_populates="transactions")
    created_by_user = relationship("User", foreign_keys=[created_by])

    def __repr__(self) -> str:
        return f"<AccountTransaction {self.transaction_type} {self.amount}>"

    @property
    def is_charge(self) -> bool:
        """Check if transaction is a charge."""
        return self.transaction_type == TransactionType.CHARGE  # type: ignore[comparison-overlap]

    @property
    def is_payment(self) -> bool:
        """Check if transaction is a payment."""
        return self.transaction_type == TransactionType.PAYMENT  # type: ignore[comparison-overlap]


class AccountPayment(BaseModel):
    """Account payment model for tracking customer payments."""

    __tablename__ = "account_payments"

    # Foreign keys
    account_id = Column(UUID(as_uuid=True), ForeignKey("customer_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    received_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Payment details
    amount = Column(Numeric(12, 2), nullable=False)
    payment_method = Column(String(50), nullable=False)  # 'cash', 'card', 'bank_transfer', etc.
    reference_number = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)

    # Relationships
    account = relationship("CustomerAccount", back_populates="payments")
    received_by_user = relationship("User", foreign_keys=[received_by])
    allocations = relationship(
        "PaymentAllocation",
        back_populates="payment",
        lazy="selectin",
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<AccountPayment {self.amount} via {self.payment_method}>"

    @property
    def allocated_amount(self) -> Decimal:
        """Calculate total allocated amount."""
        if not self.allocations:
            return Decimal('0')
        return sum(Decimal(str(alloc.amount)) for alloc in self.allocations)  # type: ignore[return-value]

    @property
    def unallocated_amount(self) -> Decimal:
        """Calculate unallocated amount."""
        return Decimal(str(self.amount)) - self.allocated_amount


class PaymentAllocation(BaseModel):
    """Payment allocation model for tracking how payments are applied to transactions."""

    __tablename__ = "payment_allocations"

    # Foreign keys
    payment_id = Column(UUID(as_uuid=True), ForeignKey("account_payments.id", ondelete="CASCADE"), nullable=False, index=True)
    transaction_id = Column(UUID(as_uuid=True), ForeignKey("account_transactions.id", ondelete="CASCADE"), nullable=False, index=True)

    # Allocation details
    amount = Column(Numeric(12, 2), nullable=False)

    # Relationships
    payment = relationship("AccountPayment", back_populates="allocations")
    transaction = relationship("AccountTransaction")

    def __repr__(self) -> str:
        return f"<PaymentAllocation {self.amount}>"


class AccountStatement(BaseModel):
    """Account statement model for periodic account summaries."""

    __tablename__ = "account_statements"

    # Foreign keys
    account_id = Column(UUID(as_uuid=True), ForeignKey("customer_accounts.id", ondelete="CASCADE"), nullable=False, index=True)

    # Statement period
    statement_date = Column(Date, nullable=False, index=True)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)

    # Balances
    opening_balance = Column(Numeric(12, 2), nullable=False)
    total_charges = Column(Numeric(12, 2), nullable=False)
    total_payments = Column(Numeric(12, 2), nullable=False)
    closing_balance = Column(Numeric(12, 2), nullable=False)

    # Aging breakdown
    current_amount = Column(Numeric(12, 2), default=0)
    days_30_amount = Column(Numeric(12, 2), default=0)
    days_60_amount = Column(Numeric(12, 2), default=0)
    days_90_plus_amount = Column(Numeric(12, 2), default=0)

    # Delivery
    sent_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    account = relationship("CustomerAccount", back_populates="statements")

    def __repr__(self) -> str:
        return f"<AccountStatement {self.statement_date} - {self.closing_balance}>"

    @property
    def is_sent(self) -> bool:
        """Check if statement has been sent."""
        return self.sent_at is not None

    @property
    def total_aging(self) -> Decimal:
        """Calculate total aging amount."""
        return (
            Decimal(str(self.current_amount)) +
            Decimal(str(self.days_30_amount)) +
            Decimal(str(self.days_60_amount)) +
            Decimal(str(self.days_90_plus_amount))
        )


class CollectionActivity(BaseModel):
    """Collection activity model for tracking collection efforts."""

    __tablename__ = "collection_activities"

    # Foreign keys
    account_id = Column(UUID(as_uuid=True), ForeignKey("customer_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    performed_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Activity details
    activity_type: Column[ActivityType] = Column(
        SQLEnum(ActivityType, values_callable=lambda x: [e.value for e in x], name='activitytype'),
        nullable=False,
        index=True
    )
    notes = Column(Text, nullable=True)

    # Promise tracking
    promise_date = Column(Date, nullable=True)
    promise_amount = Column(Numeric(12, 2), nullable=True)

    # Outcome
    outcome = Column(String(50), nullable=True)  # 'successful', 'no_answer', 'promised', 'disputed', etc.

    # Relationships
    account = relationship("CustomerAccount", back_populates="collection_activities")
    performed_by_user = relationship("User", foreign_keys=[performed_by])

    def __repr__(self) -> str:
        return f"<CollectionActivity {self.activity_type}>"

    @property
    def has_promise(self) -> bool:
        """Check if activity includes a payment promise."""
        return self.promise_date is not None and self.promise_amount is not None


class AccountWriteOff(BaseModel):
    """Account write-off model for bad debt management."""

    __tablename__ = "account_write_offs"

    # Foreign keys
    account_id = Column(UUID(as_uuid=True), ForeignKey("customer_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Write-off details
    amount = Column(Numeric(12, 2), nullable=False)
    reason = Column(Text, nullable=False)

    # Relationships
    account = relationship("CustomerAccount", back_populates="write_offs")
    approved_by_user = relationship("User", foreign_keys=[approved_by])

    def __repr__(self) -> str:
        return f"<AccountWriteOff {self.amount}>"
