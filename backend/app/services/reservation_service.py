"""Reservation service for managing guest bookings.

Why a dedicated service instead of adding to TableService?
Reservations have their own lifecycle (create → confirm → seat → complete)
that is independent of table CRUD.  Separating concerns keeps each service
focused and testable.  The reservation service calls into table status
updates when a guest is seated, but doesn't manage table positioning or
floor plan logic.
"""

import math
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple, List

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.models.restaurant_table import (
    Reservation,
    ReservationStatus,
    RestaurantTable,
    TableStatus,
)


class ReservationService:
    """Handles reservation CRUD and status transitions."""

    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------

    def create_reservation(
        self,
        business_id: str,
        guest_name: str,
        party_size: int,
        date_time: datetime,
        duration: int = 90,
        phone: Optional[str] = None,
        email: Optional[str] = None,
        table_id: Optional[str] = None,
        notes: Optional[str] = None,
        customer_id: Optional[str] = None,
        created_by_id: Optional[str] = None,
    ) -> Reservation:
        """Create a new reservation.

        If table_id is provided, validates the table exists and belongs
        to the business.  Does NOT check for time conflicts automatically
        — use check_conflicts() before calling this if needed.
        """
        if table_id:
            table = (
                self.db.query(RestaurantTable)
                .filter(
                    RestaurantTable.id == table_id,
                    RestaurantTable.business_id == business_id,
                )
                .first()
            )
            if not table:
                raise ValueError("Table not found")

        reservation = Reservation(
            id=uuid.uuid4(),
            business_id=business_id,
            guest_name=guest_name,
            party_size=party_size,
            date_time=date_time,
            duration=duration,
            phone=phone,
            email=email,
            table_id=table_id,
            notes=notes,
            customer_id=customer_id,
            created_by_id=created_by_id,
            status=ReservationStatus.CONFIRMED.value,
        )
        self.db.add(reservation)
        self.db.commit()
        self.db.refresh(reservation)
        return reservation

    def get_reservation(self, reservation_id: str, business_id: str) -> Optional[Reservation]:
        """Fetch a single reservation by ID."""
        return (
            self.db.query(Reservation)
            .filter(
                Reservation.id == reservation_id,
                Reservation.business_id == business_id,
                Reservation.deleted_at.is_(None),
            )
            .first()
        )

    def list_reservations(
        self,
        business_id: str,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        status: Optional[str] = None,
        table_id: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[Reservation], int]:
        """List reservations with filters and pagination."""
        query = self.db.query(Reservation).filter(
            Reservation.business_id == business_id,
            Reservation.deleted_at.is_(None),
        )

        if date_from:
            query = query.filter(Reservation.date_time >= date_from)
        if date_to:
            query = query.filter(Reservation.date_time <= date_to)
        if status:
            query = query.filter(Reservation.status == status)
        if table_id:
            query = query.filter(Reservation.table_id == table_id)

        total = query.count()
        items = (
            query.order_by(Reservation.date_time.asc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def update_reservation(
        self,
        reservation_id: str,
        business_id: str,
        **kwargs,
    ) -> Optional[Reservation]:
        """Update reservation fields.  Only non-None kwargs are applied."""
        reservation = self.get_reservation(reservation_id, business_id)
        if not reservation:
            return None

        allowed_fields = {
            "guest_name", "phone", "email", "party_size",
            "date_time", "duration", "table_id", "notes", "status",
        }
        for field, value in kwargs.items():
            if field in allowed_fields and value is not None:
                setattr(reservation, field, value)

        self.db.commit()
        self.db.refresh(reservation)
        return reservation

    def cancel_reservation(self, reservation_id: str, business_id: str) -> Optional[Reservation]:
        """Cancel a reservation.  Only confirmed reservations can be cancelled."""
        reservation = self.get_reservation(reservation_id, business_id)
        if not reservation:
            return None
        if reservation.status not in (ReservationStatus.CONFIRMED.value,):
            raise ValueError(f"Cannot cancel reservation with status '{reservation.status}'")

        reservation.status = ReservationStatus.CANCELLED.value
        self.db.commit()
        self.db.refresh(reservation)
        return reservation

    def seat_reservation(self, reservation_id: str, business_id: str) -> Optional[Reservation]:
        """Mark a reservation as seated and update the table status."""
        reservation = self.get_reservation(reservation_id, business_id)
        if not reservation:
            return None
        if reservation.status != ReservationStatus.CONFIRMED.value:
            raise ValueError(f"Cannot seat reservation with status '{reservation.status}'")

        reservation.status = ReservationStatus.SEATED.value

        # Update table status to OCCUPIED if a table is assigned
        if reservation.table_id:
            table = self.db.query(RestaurantTable).get(reservation.table_id)
            if table:
                table.status = TableStatus.OCCUPIED

        self.db.commit()
        self.db.refresh(reservation)
        return reservation

    def mark_no_show(self, reservation_id: str, business_id: str) -> Optional[Reservation]:
        """Mark a confirmed reservation as a no-show."""
        reservation = self.get_reservation(reservation_id, business_id)
        if not reservation:
            return None
        if reservation.status != ReservationStatus.CONFIRMED.value:
            raise ValueError("Only confirmed reservations can be marked as no-show")

        reservation.status = ReservationStatus.NO_SHOW.value
        self.db.commit()
        self.db.refresh(reservation)
        return reservation

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------

    def check_conflicts(
        self,
        business_id: str,
        table_id: str,
        date_time: datetime,
        duration: int,
        exclude_id: Optional[str] = None,
    ) -> List[Reservation]:
        """Find overlapping reservations for a specific table.

        Two reservations overlap when:
          existing.start < proposed.end AND proposed.start < existing.end
        """
        proposed_end = date_time + timedelta(minutes=duration)

        query = self.db.query(Reservation).filter(
            Reservation.business_id == business_id,
            Reservation.table_id == table_id,
            Reservation.status.in_([
                ReservationStatus.CONFIRMED.value,
                ReservationStatus.SEATED.value,
            ]),
            Reservation.deleted_at.is_(None),
            # Overlap condition
            Reservation.date_time < proposed_end,
            (Reservation.date_time + timedelta(minutes=1)) > date_time,
            # Note: exact overlap check using duration is complex in SQL;
            # we over-match here and filter precisely in Python below.
        )

        if exclude_id:
            query = query.filter(Reservation.id != exclude_id)

        candidates = query.all()

        # Precise overlap check in Python (since SQL can't easily add
        # duration column to datetime for comparison)
        conflicts = []
        for r in candidates:
            existing_end = r.date_time + timedelta(minutes=r.duration)
            if r.date_time < proposed_end and date_time < existing_end:
                conflicts.append(r)

        return conflicts

    def get_upcoming(self, business_id: str, hours: int = 24) -> List[Reservation]:
        """Get confirmed reservations within the next N hours."""
        now = datetime.now(timezone.utc)
        cutoff = now + timedelta(hours=hours)
        return (
            self.db.query(Reservation)
            .filter(
                Reservation.business_id == business_id,
                Reservation.status == ReservationStatus.CONFIRMED.value,
                Reservation.date_time >= now,
                Reservation.date_time <= cutoff,
                Reservation.deleted_at.is_(None),
            )
            .order_by(Reservation.date_time.asc())
            .all()
        )
