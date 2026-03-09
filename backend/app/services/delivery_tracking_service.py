"""Service layer for delivery tracking, driver shifts, and proof-of-delivery.

Extends the base delivery module with operational/real-time concerns:
shift scheduling, GPS tracking, and proof capture.

Why a separate service from delivery_service?
The existing delivery_service handles order-level delivery CRUD (zone
assignment, fee calculation).  This service handles the operational
layer: where is the driver right now, when did they start their shift,
and did the customer sign for the package.
"""

import uuid
from datetime import datetime, timezone, date, time
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.delivery_tracking import (
    DriverShift,
    DriverShiftStatus,
    DeliveryTracking,
    DeliveryProof,
)


class DeliveryTrackingService:
    """Business logic for delivery tracking operations."""

    def __init__(self, db: Session) -> None:
        self.db = db

    # -----------------------------------------------------------------------
    # Driver Shifts
    # -----------------------------------------------------------------------

    def create_shift(
        self,
        driver_id: uuid.UUID,
        *,
        shift_date: date,
        start_time: time,
        end_time: time,
    ) -> DriverShift:
        """Schedule a new shift for a driver.

        Why validate start < end?
        A shift where end <= start is meaningless and breaks duration
        calculations.  Overnight shifts (crossing midnight) would need
        separate handling not covered here.
        """
        if end_time <= start_time:
            raise ValueError("Shift end_time must be after start_time")

        shift = DriverShift(
            id=uuid.uuid4(),
            driver_id=driver_id,
            shift_date=shift_date,
            start_time=start_time,
            end_time=end_time,
            status=DriverShiftStatus.SCHEDULED.value,
        )
        self.db.add(shift)
        self.db.commit()
        self.db.refresh(shift)
        return shift

    def start_shift(self, shift_id: uuid.UUID) -> Optional[DriverShift]:
        """Mark a shift as started with actual start timestamp."""
        shift = self.db.query(DriverShift).filter(DriverShift.id == shift_id).first()
        if not shift:
            return None
        shift.status = DriverShiftStatus.STARTED.value
        shift.actual_start = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(shift)
        return shift

    def end_shift(self, shift_id: uuid.UUID) -> Optional[DriverShift]:
        """Mark a shift as completed with actual end timestamp."""
        shift = self.db.query(DriverShift).filter(DriverShift.id == shift_id).first()
        if not shift:
            return None
        shift.status = DriverShiftStatus.COMPLETED.value
        shift.actual_end = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(shift)
        return shift

    def list_shifts(
        self,
        driver_id: uuid.UUID,
        *,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> tuple[list[DriverShift], int]:
        """List shifts for a driver, optionally filtered by date range."""
        query = self.db.query(DriverShift).filter(
            DriverShift.driver_id == driver_id,
            DriverShift.deleted_at.is_(None),
        )
        if from_date:
            query = query.filter(DriverShift.shift_date >= from_date)
        if to_date:
            query = query.filter(DriverShift.shift_date <= to_date)

        total = query.count()
        items = (
            query.order_by(DriverShift.shift_date.desc(), DriverShift.start_time)
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    # -----------------------------------------------------------------------
    # Delivery Tracking
    # -----------------------------------------------------------------------

    def add_tracking_update(
        self,
        delivery_id: uuid.UUID,
        *,
        status: str,
        location: Optional[dict] = None,
        eta_minutes: Optional[int] = None,
        notes: Optional[str] = None,
    ) -> DeliveryTracking:
        """Record a tracking point (location/status) for a delivery.

        Why append-only?
        We never update existing tracking rows.  Each row is an immutable
        event in the delivery timeline, enabling accurate playback and
        dispute resolution.
        """
        tracking = DeliveryTracking(
            id=uuid.uuid4(),
            delivery_id=delivery_id,
            status=status,
            location=location,
            eta_minutes=eta_minutes,
            notes=notes,
            recorded_at=datetime.now(timezone.utc),
        )
        self.db.add(tracking)
        self.db.commit()
        self.db.refresh(tracking)
        return tracking

    def get_tracking_history(
        self,
        delivery_id: uuid.UUID,
    ) -> list[DeliveryTracking]:
        """Get full tracking history for a delivery, ordered by time."""
        return (
            self.db.query(DeliveryTracking)
            .filter(DeliveryTracking.delivery_id == delivery_id)
            .order_by(DeliveryTracking.recorded_at)
            .all()
        )

    def get_latest_tracking(
        self,
        delivery_id: uuid.UUID,
    ) -> Optional[DeliveryTracking]:
        """Get the most recent tracking update for a delivery."""
        return (
            self.db.query(DeliveryTracking)
            .filter(DeliveryTracking.delivery_id == delivery_id)
            .order_by(DeliveryTracking.recorded_at.desc())
            .first()
        )

    # -----------------------------------------------------------------------
    # Delivery Proofs
    # -----------------------------------------------------------------------

    def add_proof(
        self,
        delivery_id: uuid.UUID,
        *,
        proof_type: str,
        signature_url: Optional[str] = None,
        photo_url: Optional[str] = None,
        recipient_name: Optional[str] = None,
    ) -> DeliveryProof:
        """Record proof of delivery (signature, photo, or both).

        Why require at least one evidence field?
        A proof record with no signature and no photo is meaningless.
        We validate that at least one is provided.
        """
        if proof_type == "signature" and not signature_url:
            raise ValueError("signature_url required for signature proof")
        if proof_type == "photo" and not photo_url:
            raise ValueError("photo_url required for photo proof")
        if proof_type == "both" and not (signature_url and photo_url):
            raise ValueError("Both signature_url and photo_url required")

        proof = DeliveryProof(
            id=uuid.uuid4(),
            delivery_id=delivery_id,
            proof_type=proof_type,
            signature_url=signature_url,
            photo_url=photo_url,
            recipient_name=recipient_name,
        )
        self.db.add(proof)
        self.db.commit()
        self.db.refresh(proof)
        return proof

    def get_proof(self, delivery_id: uuid.UUID) -> Optional[DeliveryProof]:
        """Get proof of delivery for a specific delivery."""
        return (
            self.db.query(DeliveryProof)
            .filter(DeliveryProof.delivery_id == delivery_id)
            .first()
        )

    # -----------------------------------------------------------------------
    # ETA Calculation
    # -----------------------------------------------------------------------

    @staticmethod
    def estimate_eta_minutes(
        distance_km: float,
        avg_speed_kmh: float = 30.0,
        prep_minutes: int = 10,
    ) -> int:
        """Estimate delivery time in minutes.

        Combines preparation time with travel estimate at average speed.
        Default 30 km/h accounts for urban stop-start driving.
        """
        if distance_km <= 0:
            return prep_minutes
        travel_minutes = (distance_km / avg_speed_kmh) * 60
        return prep_minutes + round(travel_minutes)
