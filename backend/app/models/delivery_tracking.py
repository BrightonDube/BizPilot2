"""Models for delivery tracking, driver shifts, and delivery proofs.

These extend the base delivery module (delivery.py) which already provides
DeliveryZone, Driver, and Delivery models.

Why separate from delivery.py?
These models represent operational/real-time concerns (GPS tracking,
shift scheduling, proof-of-delivery) that change frequently, while
the core delivery models are transactional.  Keeping them in a
separate file avoids bloating the original module.
"""

import enum

from sqlalchemy import (
    Column,
    String,
    Text,
    Integer,
    Date,
    Time,
    DateTime,
    ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.models.base import BaseModel


class DriverShiftStatus(str, enum.Enum):
    """Lifecycle of a driver shift."""

    SCHEDULED = "scheduled"
    STARTED = "started"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class DriverShift(BaseModel):
    """Scheduled shift for a delivery driver.

    Why track shifts separately?
    Driver availability (is_available flag on Driver) only captures the
    current moment.  Shifts let managers plan future capacity, compute
    labour cost, and monitor attendance.
    """

    __tablename__ = "driver_shifts"

    driver_id = Column(
        UUID(as_uuid=True),
        ForeignKey("drivers.id"),
        nullable=False,
        index=True,
    )
    shift_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    actual_start = Column(DateTime(timezone=True), nullable=True)
    actual_end = Column(DateTime(timezone=True), nullable=True)
    status = Column(
        String(30),
        default=DriverShiftStatus.SCHEDULED.value,
        nullable=False,
    )


class DeliveryTracking(BaseModel):
    """Time-series location/status update for a delivery.

    Why a separate tracking table instead of updating the delivery row?
    We need the full history of status transitions and GPS pings for
    customer-facing ETA updates and post-delivery analytics.  Overwriting
    a single row would lose that history.
    """

    __tablename__ = "delivery_tracking"

    delivery_id = Column(
        UUID(as_uuid=True),
        ForeignKey("deliveries.id"),
        nullable=False,
        index=True,
    )
    status = Column(String(30), nullable=False)
    location = Column(JSONB, nullable=True, comment='{"lat": float, "lng": float}')
    eta_minutes = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    recorded_at = Column(DateTime(timezone=True), nullable=False)


class DeliveryProof(BaseModel):
    """Proof of delivery (signature / photo / recipient name).

    Why store proof separately?
    Proof blobs (URLs to S3) and metadata don't need to be loaded on
    every delivery list query.  Keeping them separate reduces payload
    and allows independent retention policies.
    """

    __tablename__ = "delivery_proofs"

    delivery_id = Column(
        UUID(as_uuid=True),
        ForeignKey("deliveries.id"),
        nullable=False,
        index=True,
    )
    proof_type = Column(
        String(30),
        nullable=False,
        comment="signature | photo | both",
    )
    signature_url = Column(Text, nullable=True)
    photo_url = Column(Text, nullable=True)
    recipient_name = Column(String(255), nullable=True)
