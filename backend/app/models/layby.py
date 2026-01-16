"""Layby model for layby (lay-away) purchase management.

This model stores layby purchase arrangements where customers pay a deposit
and make scheduled payments over time before collecting their goods.

Validates: Requirements 1.1-1.8
"""

import enum
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class LaybyStatus(str, enum.Enum):
    """Layby status enum.
    
    Represents the lifecycle states of a layby:
    - DRAFT: Initial state before deposit is paid
    - ACTIVE: Deposit paid, customer making scheduled payments
    - READY_FOR_COLLECTION: Fully paid, awaiting customer collection
    - COMPLETED: Customer has collected their items
    - CANCELLED: Layby was cancelled (with potential refund)
    - OVERDUE: One or more payments are past due
    """

    DRAFT = "draft"
    ACTIVE = "active"
    READY_FOR_COLLECTION = "ready_for_collection"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    OVERDUE = "overdue"


class PaymentFrequency(str, enum.Enum):
    """Payment frequency enum for layby payment schedules.
    
    Validates: Requirements 2.1
    """

    WEEKLY = "weekly"
    BI_WEEKLY = "bi_weekly"
    MONTHLY = "monthly"


class Layby(BaseModel):
    """Layby model for layby (lay-away) purchase arrangements.
    
    A layby allows customers to reserve products by paying a deposit and
    making scheduled payments over time until the full amount is paid,
    at which point they can collect their items.
    
    Attributes:
        reference_number: Unique identifier for the layby (Requirement 1.5)
        business_id: Reference to the business
        location_id: Optional reference to specific location
        customer_id: Reference to the customer (Requirement 1.1)
        status: Current status of the layby
        subtotal: Sum of item prices before tax
        tax_amount: Total tax amount
        total_amount: Final total including tax
        deposit_amount: Initial deposit paid (Requirement 1.3, 1.4)
        amount_paid: Total amount paid so far
        balance_due: Remaining amount to be paid
        payment_frequency: How often payments are due (Requirement 2.1)
        start_date: When the layby started
        end_date: When the layby should be completed
        next_payment_date: Date of next scheduled payment
        next_payment_amount: Amount of next scheduled payment
        extension_count: Number of times layby has been extended
        original_end_date: Original end date before any extensions
        notes: Optional notes about the layby
        created_by: User who created the layby (Requirement 1.6)
        collected_at: When items were collected
        collected_by: User who processed the collection
        cancelled_at: When layby was cancelled
        cancelled_by: User who processed the cancellation
        cancellation_reason: Reason for cancellation
        synced_at: Last sync timestamp for offline support
        is_dirty: Flag for offline sync status
    
    Validates: Requirements 1.1-1.8
    """

    __tablename__ = "laybys"

    # Reference number - unique identifier for the layby (Requirement 1.5)
    reference_number = Column(
        String(50),
        nullable=False,
        unique=True,
        index=True,
    )

    # Business and location references
    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    location_id = Column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
    )  # Optional: for location-specific tracking

    # Customer reference (Requirement 1.1)
    customer_id = Column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Status tracking
    status = Column(
        SQLEnum(
            LaybyStatus,
            values_callable=lambda x: [e.value for e in x],
            name="laybystatus",
        ),
        nullable=False,
        default=LaybyStatus.ACTIVE,
        index=True,
    )

    # Financial fields (Requirements 1.3, 1.4)
    subtotal = Column(
        Numeric(10, 2),
        nullable=False,
    )
    tax_amount = Column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    total_amount = Column(
        Numeric(10, 2),
        nullable=False,
    )
    deposit_amount = Column(
        Numeric(10, 2),
        nullable=False,
    )
    amount_paid = Column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    balance_due = Column(
        Numeric(10, 2),
        nullable=False,
    )

    # Payment schedule fields (Requirement 2.1)
    payment_frequency = Column(
        SQLEnum(
            PaymentFrequency,
            values_callable=lambda x: [e.value for e in x],
            name="paymentfrequency",
        ),
        nullable=False,
    )
    start_date = Column(
        Date,
        nullable=False,
    )
    end_date = Column(
        Date,
        nullable=False,
    )
    next_payment_date = Column(
        Date,
        nullable=True,
    )
    next_payment_amount = Column(
        Numeric(10, 2),
        nullable=True,
    )

    # Extension tracking (Requirement 6.1-6.6)
    extension_count = Column(
        Integer,
        nullable=False,
        default=0,
    )
    original_end_date = Column(
        Date,
        nullable=True,
    )

    # Metadata
    notes = Column(
        Text,
        nullable=True,
    )

    # Creation tracking (Requirement 1.6)
    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # Collection tracking (Requirement 4.1-4.7)
    collected_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )
    collected_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Cancellation tracking (Requirement 5.1-5.8)
    cancelled_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )
    cancelled_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    cancellation_reason = Column(
        Text,
        nullable=True,
    )

    # Sync fields for offline support (Requirement 10.1-10.7)
    synced_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )
    is_dirty = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    # Relationships
    business = relationship(
        "Business",
        backref="laybys",
        lazy="joined",
    )
    customer = relationship(
        "Customer",
        backref="laybys",
        lazy="joined",
    )
    
    # User relationships - using foreign_keys to disambiguate multiple FKs to same table
    creator = relationship(
        "User",
        foreign_keys=[created_by],
        backref="created_laybys",
        lazy="joined",
    )
    collector = relationship(
        "User",
        foreign_keys=[collected_by],
        backref="collected_laybys",
        lazy="joined",
    )
    canceller = relationship(
        "User",
        foreign_keys=[cancelled_by],
        backref="cancelled_laybys",
        lazy="joined",
    )

    # Related items, payments, schedules, and audit records
    # These will be defined in their respective models with back_populates
    items = relationship(
        "LaybyItem",
        back_populates="layby",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    payments = relationship(
        "LaybyPayment",
        back_populates="layby",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    schedules = relationship(
        "LaybySchedule",
        back_populates="layby",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    audit_records = relationship(
        "LaybyAudit",
        back_populates="layby",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    notifications = relationship(
        "LaybyNotification",
        back_populates="layby",
        lazy="selectin",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Layby {self.reference_number} ({self.status.value})>"

    @property
    def is_fully_paid(self) -> bool:
        """Check if the layby is fully paid.
        
        Returns:
            True if balance_due is zero or less.
        """
        return self.balance_due <= Decimal("0.00")

    @property
    def is_active(self) -> bool:
        """Check if the layby is in an active state.
        
        Returns:
            True if status is ACTIVE or OVERDUE.
        """
        return self.status in (LaybyStatus.ACTIVE, LaybyStatus.OVERDUE)

    @property
    def can_make_payment(self) -> bool:
        """Check if payments can be made on this layby.
        
        Returns:
            True if layby is active and has balance due.
        """
        return self.is_active and self.balance_due > Decimal("0.00")

    @property
    def can_be_collected(self) -> bool:
        """Check if the layby can be collected.
        
        Returns:
            True if status is READY_FOR_COLLECTION.
        """
        return self.status == LaybyStatus.READY_FOR_COLLECTION

    @property
    def can_be_cancelled(self) -> bool:
        """Check if the layby can be cancelled.
        
        Returns:
            True if layby is not already completed or cancelled.
        """
        return self.status not in (LaybyStatus.COMPLETED, LaybyStatus.CANCELLED)

    @property
    def can_be_extended(self) -> bool:
        """Check if the layby can be extended.
        
        Returns:
            True if layby is active and not completed/cancelled.
        """
        return self.status in (LaybyStatus.ACTIVE, LaybyStatus.OVERDUE)

    @property
    def total_amount_float(self) -> float:
        """Return total_amount as a float for calculations."""
        return float(self.total_amount)

    @property
    def balance_due_float(self) -> float:
        """Return balance_due as a float for calculations."""
        return float(self.balance_due)

    @property
    def amount_paid_float(self) -> float:
        """Return amount_paid as a float for calculations."""
        return float(self.amount_paid)

    @property
    def deposit_amount_float(self) -> float:
        """Return deposit_amount as a float for calculations."""
        return float(self.deposit_amount)

    @property
    def item_count(self) -> int:
        """Get total item count from layby items relationship."""
        if self.items:
            return sum(item.quantity for item in self.items)
        return 0
