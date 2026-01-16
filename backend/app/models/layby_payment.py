"""LaybyPayment model for tracking all payments made on laybys.

This model stores payment records including deposits, installments, final payments,
and overpayments. It also supports refund tracking.

Validates: Requirements 3.1-3.8
"""

import enum
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, utc_now


class PaymentType(str, enum.Enum):
    """Payment type enum for layby payments.
    
    Represents the type of payment being made:
    - DEPOSIT: Initial deposit payment
    - INSTALLMENT: Regular scheduled payment
    - FINAL: Final payment completing the layby
    - OVERPAYMENT: Payment exceeding the scheduled amount
    """

    DEPOSIT = "deposit"
    INSTALLMENT = "installment"
    FINAL = "final"
    OVERPAYMENT = "overpayment"


class PaymentStatus(str, enum.Enum):
    """Payment status enum for layby payments.
    
    Represents the status of a payment:
    - PENDING: Payment initiated but not completed
    - COMPLETED: Payment successfully processed
    - FAILED: Payment failed to process
    - REFUNDED: Payment has been refunded
    """

    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"


class LaybyPayment(Base):
    """LaybyPayment model for tracking payments on laybys.
    
    This model records all payments made toward a layby including deposits,
    installments, final payments, and overpayments. It also tracks refund
    information when payments are refunded.
    
    Attributes:
        id: Unique identifier for the payment
        layby_id: Reference to the parent layby (CASCADE delete)
        schedule_id: Optional reference to a specific schedule installment
        payment_type: Type of payment (deposit, installment, final, overpayment)
        amount: Payment amount
        payment_method: Method used for payment (cash, card, etc.)
        payment_reference: External reference number
        status: Current status of the payment
        refund_amount: Amount refunded (if applicable)
        refund_reason: Reason for refund
        refunded_at: Timestamp of refund
        refunded_by: User who processed the refund
        notes: Optional notes about the payment
        processed_by: User who processed the payment
        terminal_id: Terminal where payment was processed
        created_at: Timestamp when payment was created
        synced_at: Last sync timestamp for offline support
        is_dirty: Flag for offline sync status
    
    Validates: Requirements 3.1-3.8
    """

    __tablename__ = "layby_payments"

    # Primary key
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default="gen_random_uuid()",
    )

    # Foreign key to laybys table
    layby_id = Column(
        UUID(as_uuid=True),
        ForeignKey("laybys.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Optional foreign key to layby_schedules
    schedule_id = Column(
        UUID(as_uuid=True),
        ForeignKey("layby_schedules.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Payment type (Requirement 3.3, 3.4 - support various payment types)
    payment_type = Column(
        SQLEnum(
            PaymentType,
            values_callable=lambda x: [e.value for e in x],
            name="laybypaymenttype",
        ),
        nullable=False,
    )

    # Payment details (Requirement 3.1 - record payment amount, method)
    amount = Column(
        Numeric(10, 2),
        nullable=False,
    )
    payment_method = Column(
        String(50),
        nullable=False,
    )
    payment_reference = Column(
        String(100),
        nullable=True,
    )

    # Payment status (Requirement 3.7 - log payment failures)
    status = Column(
        SQLEnum(
            PaymentStatus,
            values_callable=lambda x: [e.value for e in x],
            name="laybypaymentstatus",
        ),
        nullable=False,
        default=PaymentStatus.COMPLETED,
    )

    # Refund information
    refund_amount = Column(
        Numeric(10, 2),
        nullable=True,
    )
    refund_reason = Column(
        Text,
        nullable=True,
    )
    refunded_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )
    refunded_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Metadata
    notes = Column(
        Text,
        nullable=True,
    )

    # Operator who processed the payment (Requirement 3.1 - record operator)
    processed_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # Terminal ID - nullable without FK since terminals table may not exist
    terminal_id = Column(
        UUID(as_uuid=True),
        nullable=True,
    )

    # Timestamp (Requirement 3.1 - record timestamp)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )

    # Sync fields (Requirement 3.8 - queue offline payments for sync)
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
    layby = relationship(
        "Layby",
        back_populates="payments",
    )
    schedule = relationship(
        "LaybySchedule",
        back_populates="payments",
    )
    processor = relationship(
        "User",
        foreign_keys=[processed_by],
        backref="processed_layby_payments",
        lazy="joined",
    )
    refunder = relationship(
        "User",
        foreign_keys=[refunded_by],
        backref="refunded_layby_payments",
        lazy="joined",
    )

    def __repr__(self) -> str:
        return f"<LaybyPayment {self.payment_type.value} ${self.amount} ({self.status.value})>"

    @property
    def amount_float(self) -> float:
        """Return amount as a float for calculations."""
        return float(self.amount)

    @property
    def refund_amount_float(self) -> float:
        """Return refund_amount as a float for calculations."""
        return float(self.refund_amount) if self.refund_amount else 0.0

    @property
    def is_completed(self) -> bool:
        """Check if payment is completed."""
        return self.status == PaymentStatus.COMPLETED

    @property
    def is_refunded(self) -> bool:
        """Check if payment has been refunded."""
        return self.status == PaymentStatus.REFUNDED

    @property
    def is_failed(self) -> bool:
        """Check if payment failed."""
        return self.status == PaymentStatus.FAILED

    @property
    def net_amount(self) -> Decimal:
        """Calculate net amount after any refunds."""
        if self.refund_amount:
            return self.amount - self.refund_amount
        return self.amount
