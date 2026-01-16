"""LaybySchedule model for tracking payment installments.

This model stores the payment schedule for each layby, with individual
installments that track due dates, amounts due, amounts paid, and status.

Validates: Requirements 2.1-2.7
"""

import enum
from decimal import Decimal

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, utc_now


class ScheduleStatus(str, enum.Enum):
    """Schedule installment status enum.
    
    Represents the payment status of a scheduled installment:
    - PENDING: Payment not yet due or not started
    - PARTIAL: Partial payment made
    - PAID: Full payment received
    - OVERDUE: Payment is past due date
    """

    PENDING = "pending"
    PARTIAL = "partial"
    PAID = "paid"
    OVERDUE = "overdue"


class LaybySchedule(Base):
    """LaybySchedule model for payment installment tracking.
    
    This model represents individual payment installments within a layby's
    payment schedule. Each layby can have multiple scheduled installments
    based on the payment frequency (weekly, bi-weekly, monthly).
    
    Attributes:
        id: Unique identifier for the schedule entry
        layby_id: Reference to the parent layby (CASCADE delete)
        installment_number: Sequential number of this installment
        due_date: Date when payment is due
        amount_due: Amount expected for this installment
        amount_paid: Amount actually paid toward this installment
        status: Current status of this installment
        paid_at: Timestamp when payment was completed
        created_at: Timestamp when the schedule entry was created
        updated_at: Timestamp when the schedule entry was last updated
    
    Validates: Requirements 2.1-2.7
    """

    __tablename__ = "layby_schedules"
    __table_args__ = (
        UniqueConstraint("layby_id", "installment_number", name="uq_layby_schedules_layby_installment"),
    )

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

    # Installment tracking (Requirement 2.4 - generate due dates for each scheduled payment)
    installment_number = Column(
        Integer,
        nullable=False,
    )
    due_date = Column(
        Date,
        nullable=False,
        index=True,
    )

    # Amount tracking (Requirement 2.2 - calculate equal installment amounts)
    amount_due = Column(
        Numeric(10, 2),
        nullable=False,
    )
    amount_paid = Column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0.00"),
    )

    # Status tracking (Requirement 2.5 - allow custom payment amounts / partial payments)
    status = Column(
        SQLEnum(
            ScheduleStatus,
            values_callable=lambda x: [e.value for e in x],
            name="schedulestatus",
        ),
        nullable=False,
        default=ScheduleStatus.PENDING,
    )

    # Payment completion timestamp
    paid_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Timestamps
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )

    # Relationships
    layby = relationship(
        "Layby",
        back_populates="schedules",
    )
    payments = relationship(
        "LaybyPayment",
        back_populates="schedule",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<LaybySchedule #{self.installment_number} due={self.due_date} ({self.status.value})>"

    @property
    def amount_due_float(self) -> float:
        """Return amount_due as a float for calculations."""
        return float(self.amount_due)

    @property
    def amount_paid_float(self) -> float:
        """Return amount_paid as a float for calculations."""
        return float(self.amount_paid)

    @property
    def remaining_amount(self) -> Decimal:
        """Calculate remaining amount to be paid for this installment."""
        return self.amount_due - self.amount_paid

    @property
    def remaining_amount_float(self) -> float:
        """Return remaining_amount as a float for calculations."""
        return float(self.remaining_amount)

    @property
    def is_fully_paid(self) -> bool:
        """Check if this installment is fully paid."""
        return self.amount_paid >= self.amount_due

    @property
    def is_overdue(self) -> bool:
        """Check if this installment is overdue based on status."""
        return self.status == ScheduleStatus.OVERDUE
