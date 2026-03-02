"""API endpoints for delivery tracking, driver shifts, and proof-of-delivery.

Extends the base deliveries router with operational/real-time endpoints.
"""

import math
from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user
from app.core.database import get_sync_db
from app.schemas.delivery_tracking import (
    DriverShiftCreate,
    DriverShiftUpdate,
    DriverShiftResponse,
    DriverShiftListResponse,
    DeliveryTrackingCreate,
    DeliveryTrackingResponse,
    DeliveryProofCreate,
    DeliveryProofResponse,
)
from app.services.delivery_tracking_service import DeliveryTrackingService

router = APIRouter(prefix="/delivery-tracking", tags=["Delivery Tracking"])


# ---------------------------------------------------------------------------
# Driver Shifts
# ---------------------------------------------------------------------------


@router.post("/shifts", response_model=DriverShiftResponse, status_code=201)
def create_shift(
    payload: DriverShiftCreate,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Schedule a new driver shift."""
    svc = DeliveryTrackingService(db)
    try:
        return svc.create_shift(
            payload.driver_id,
            shift_date=payload.shift_date,
            start_time=payload.start_time,
            end_time=payload.end_time,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/shifts/{driver_id}", response_model=DriverShiftListResponse)
def list_shifts(
    driver_id: UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """List shifts for a driver."""
    svc = DeliveryTrackingService(db)
    items, total = svc.list_shifts(
        driver_id, from_date=from_date, to_date=to_date, page=page, per_page=per_page
    )
    return DriverShiftListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total else 0,
    )


@router.post("/shifts/{shift_id}/start", response_model=DriverShiftResponse)
def start_shift(
    shift_id: UUID,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Mark a shift as started."""
    svc = DeliveryTrackingService(db)
    shift = svc.start_shift(shift_id)
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    return shift


@router.post("/shifts/{shift_id}/end", response_model=DriverShiftResponse)
def end_shift(
    shift_id: UUID,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Mark a shift as completed."""
    svc = DeliveryTrackingService(db)
    shift = svc.end_shift(shift_id)
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    return shift


# ---------------------------------------------------------------------------
# Tracking Updates
# ---------------------------------------------------------------------------


@router.post("/updates", response_model=DeliveryTrackingResponse, status_code=201)
def add_tracking_update(
    payload: DeliveryTrackingCreate,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Add a tracking point for a delivery."""
    svc = DeliveryTrackingService(db)
    return svc.add_tracking_update(
        payload.delivery_id,
        status=payload.status,
        location=payload.location,
        eta_minutes=payload.eta_minutes,
        notes=payload.notes,
    )


@router.get("/history/{delivery_id}", response_model=list[DeliveryTrackingResponse])
def get_tracking_history(
    delivery_id: UUID,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Get full tracking history for a delivery."""
    svc = DeliveryTrackingService(db)
    return svc.get_tracking_history(delivery_id)


@router.get("/latest/{delivery_id}", response_model=DeliveryTrackingResponse)
def get_latest_tracking(
    delivery_id: UUID,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Get the most recent tracking update."""
    svc = DeliveryTrackingService(db)
    tracking = svc.get_latest_tracking(delivery_id)
    if not tracking:
        raise HTTPException(status_code=404, detail="No tracking data found")
    return tracking


# ---------------------------------------------------------------------------
# Delivery Proofs
# ---------------------------------------------------------------------------


@router.post("/proofs", response_model=DeliveryProofResponse, status_code=201)
def add_proof(
    payload: DeliveryProofCreate,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Record proof of delivery."""
    svc = DeliveryTrackingService(db)
    try:
        return svc.add_proof(
            payload.delivery_id,
            proof_type=payload.proof_type,
            signature_url=payload.signature_url,
            photo_url=payload.photo_url,
            recipient_name=payload.recipient_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/proofs/{delivery_id}", response_model=DeliveryProofResponse)
def get_proof(
    delivery_id: UUID,
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Get proof of delivery for a specific delivery."""
    svc = DeliveryTrackingService(db)
    proof = svc.get_proof(delivery_id)
    if not proof:
        raise HTTPException(status_code=404, detail="No proof found")
    return proof
