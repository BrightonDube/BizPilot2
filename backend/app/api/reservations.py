"""Reservation API endpoints.

Provides CRUD for reservations, plus status transitions (seat, cancel, no-show)
and conflict checking.
"""

import math
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.database import get_sync_db
from app.api.deps import get_current_active_user, get_current_business_id
from app.models.user import User
from app.schemas.reservation import (
    ReservationCreate,
    ReservationUpdate,
    ReservationResponse,
    ReservationListResponse,
)
from app.services.reservation_service import ReservationService


router = APIRouter(prefix="/reservations", tags=["Reservations"])


def _to_response(r) -> ReservationResponse:
    """Convert a Reservation ORM object to a response schema."""
    return ReservationResponse(
        id=str(r.id),
        business_id=str(r.business_id),
        table_id=str(r.table_id) if r.table_id else None,
        guest_name=r.guest_name,
        phone=r.phone,
        email=r.email,
        party_size=r.party_size,
        date_time=r.date_time,
        duration=r.duration,
        status=r.status,
        notes=r.notes,
        customer_id=str(r.customer_id) if r.customer_id else None,
        created_by_id=str(r.created_by_id) if r.created_by_id else None,
        created_at=r.created_at,
        updated_at=r.updated_at,
    )


@router.post("", response_model=ReservationResponse, status_code=status.HTTP_201_CREATED)
async def create_reservation(
    data: ReservationCreate,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Create a new reservation."""
    service = ReservationService(db)
    try:
        reservation = service.create_reservation(
            business_id=business_id,
            guest_name=data.guest_name,
            party_size=data.party_size,
            date_time=data.date_time,
            duration=data.duration,
            phone=data.phone,
            email=data.email,
            table_id=data.table_id,
            notes=data.notes,
            customer_id=data.customer_id,
            created_by_id=str(current_user.id),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return _to_response(reservation)


@router.get("", response_model=ReservationListResponse)
async def list_reservations(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    reservation_status: Optional[str] = Query(None, alias="status"),
    table_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """List reservations with optional filters."""
    service = ReservationService(db)
    items, total = service.list_reservations(
        business_id=business_id,
        date_from=date_from,
        date_to=date_to,
        status=reservation_status,
        table_id=table_id,
        page=page,
        per_page=per_page,
    )
    return ReservationListResponse(
        items=[_to_response(r) for r in items],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.get("/{reservation_id}", response_model=ReservationResponse)
async def get_reservation(
    reservation_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get a single reservation by ID."""
    service = ReservationService(db)
    reservation = service.get_reservation(reservation_id, business_id)
    if not reservation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found")
    return _to_response(reservation)


@router.put("/{reservation_id}", response_model=ReservationResponse)
async def update_reservation(
    reservation_id: str,
    data: ReservationUpdate,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Update a reservation."""
    service = ReservationService(db)
    reservation = service.update_reservation(
        reservation_id,
        business_id,
        **data.model_dump(exclude_unset=True),
    )
    if not reservation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found")
    return _to_response(reservation)


@router.patch("/{reservation_id}/seat", response_model=ReservationResponse)
async def seat_reservation(
    reservation_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Mark a reservation as seated (guest arrived)."""
    service = ReservationService(db)
    try:
        reservation = service.seat_reservation(reservation_id, business_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not reservation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found")
    return _to_response(reservation)


@router.patch("/{reservation_id}/cancel", response_model=ReservationResponse)
async def cancel_reservation(
    reservation_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Cancel a reservation."""
    service = ReservationService(db)
    try:
        reservation = service.cancel_reservation(reservation_id, business_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not reservation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found")
    return _to_response(reservation)


@router.patch("/{reservation_id}/no-show", response_model=ReservationResponse)
async def mark_no_show(
    reservation_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Mark a reservation as no-show."""
    service = ReservationService(db)
    try:
        reservation = service.mark_no_show(reservation_id, business_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not reservation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found")
    return _to_response(reservation)


@router.get("/upcoming/today", response_model=list[ReservationResponse])
async def get_upcoming_reservations(
    hours: int = Query(24, ge=1, le=168),
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get upcoming confirmed reservations within the next N hours."""
    service = ReservationService(db)
    reservations = service.get_upcoming(business_id, hours=hours)
    return [_to_response(r) for r in reservations]
