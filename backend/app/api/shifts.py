"""Shift management API endpoints."""

import math
from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.core.database import get_sync_db
from app.api.deps import get_current_business_id, get_current_active_user
from app.models.user import User
from app.models.shift import Shift, ShiftStatus, LeaveRequest, LeaveStatus
from app.schemas.shift import (
    ShiftCreate,
    ShiftUpdate,
    ShiftResponse,
    ShiftListResponse,
    WeeklyScheduleResponse,
    LeaveRequestCreate,
    LeaveRequestResponse,
    LeaveRequestListResponse,
)
from app.services.shift_service import ShiftService

router = APIRouter(prefix="/shifts", tags=["Shifts"])


def _shift_to_response(shift: Shift) -> ShiftResponse:
    """Convert a Shift model to ShiftResponse schema."""
    user_name = None
    if shift.user:
        user_name = f"{shift.user.first_name or ''} {shift.user.last_name or ''}".strip() or None
    return ShiftResponse(
        id=str(shift.id),
        business_id=str(shift.business_id),
        user_id=str(shift.user_id),
        user_name=user_name,
        location_id=str(shift.location_id) if shift.location_id else None,
        shift_date=shift.shift_date,
        start_time=shift.start_time,
        end_time=shift.end_time,
        break_minutes=shift.break_minutes or 0,
        role=shift.role,
        notes=shift.notes,
        status=shift.status,
        actual_start=shift.actual_start,
        actual_end=shift.actual_end,
        created_at=shift.created_at,
        updated_at=shift.updated_at,
    )


def _leave_to_response(leave: LeaveRequest) -> LeaveRequestResponse:
    """Convert a LeaveRequest model to LeaveRequestResponse schema."""
    user_name = None
    if leave.user:
        user_name = f"{leave.user.first_name or ''} {leave.user.last_name or ''}".strip() or None
    return LeaveRequestResponse(
        id=str(leave.id),
        business_id=str(leave.business_id),
        user_id=str(leave.user_id),
        user_name=user_name,
        leave_type=leave.leave_type,
        start_date=leave.start_date,
        end_date=leave.end_date,
        reason=leave.reason,
        status=leave.status,
        approved_by=str(leave.approved_by) if leave.approved_by else None,
        created_at=leave.created_at,
        updated_at=leave.updated_at,
    )


# ── Shift endpoints ───────────────────────────────────────────


@router.post("", response_model=ShiftResponse, status_code=status.HTTP_201_CREATED)
async def create_shift(
    data: ShiftCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Create a new shift."""
    service = ShiftService(db)
    shift = service.create_shift(
        business_id=business_id,
        user_id=data.user_id,
        shift_date=data.shift_date,
        start_time=data.start_time,
        end_time=data.end_time,
        break_minutes=data.break_minutes,
        role=data.role,
        location_id=data.location_id,
        notes=data.notes,
    )
    return _shift_to_response(shift)


@router.get("/leave", response_model=LeaveRequestListResponse)
async def list_leave_requests(
    user_id: Optional[str] = None,
    leave_status: Optional[LeaveStatus] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List leave requests with optional filters."""
    service = ShiftService(db)
    items, total = service.list_leave_requests(
        business_id=business_id,
        user_id=user_id,
        leave_status=leave_status,
        page=page,
        per_page=per_page,
    )
    return LeaveRequestListResponse(
        items=[_leave_to_response(lr) for lr in items],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.get("/schedule", response_model=WeeklyScheduleResponse)
async def get_weekly_schedule(
    week_start: date = Query(..., description="Start date of the week (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get the weekly schedule grouped by date."""
    service = ShiftService(db)
    schedule_raw = service.get_schedule(business_id, week_start)
    schedule = {
        k: [_shift_to_response(s) for s in v]
        for k, v in schedule_raw.items()
    }
    return WeeklyScheduleResponse(week_start=week_start, schedule=schedule)


@router.get("", response_model=ShiftListResponse)
async def list_shifts(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    user_id: Optional[str] = None,
    shift_status: Optional[ShiftStatus] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List shifts with optional filters and pagination."""
    service = ShiftService(db)
    items, total = service.list_shifts(
        business_id=business_id,
        start_date=start_date,
        end_date=end_date,
        user_id=user_id,
        shift_status=shift_status,
        page=page,
        per_page=per_page,
    )
    return ShiftListResponse(
        items=[_shift_to_response(s) for s in items],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.get("/{shift_id}", response_model=ShiftResponse)
async def get_shift(
    shift_id: str,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get a single shift by ID."""
    service = ShiftService(db)
    shift = service.get_shift(shift_id, business_id)
    if not shift:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shift not found")
    return _shift_to_response(shift)


@router.put("/{shift_id}", response_model=ShiftResponse)
async def update_shift(
    shift_id: str,
    data: ShiftUpdate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Update a shift."""
    service = ShiftService(db)
    update_data = data.model_dump(exclude_unset=True)
    shift = service.update_shift(shift_id, business_id, **update_data)
    if not shift:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shift not found")
    return _shift_to_response(shift)


@router.delete("/{shift_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shift(
    shift_id: str,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Soft-delete a shift."""
    service = ShiftService(db)
    deleted = service.delete_shift(shift_id, business_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shift not found")


@router.post("/{shift_id}/clock-in", response_model=ShiftResponse)
async def clock_in(
    shift_id: str,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Clock in to a shift."""
    service = ShiftService(db)
    shift = service.clock_in(shift_id, business_id)
    if not shift:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shift not found")
    return _shift_to_response(shift)


@router.post("/{shift_id}/clock-out", response_model=ShiftResponse)
async def clock_out(
    shift_id: str,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Clock out of a shift."""
    service = ShiftService(db)
    shift = service.clock_out(shift_id, business_id)
    if not shift:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shift not found")
    return _shift_to_response(shift)


# ── Leave endpoints ───────────────────────────────────────────


@router.post("/leave", response_model=LeaveRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_leave_request(
    data: LeaveRequestCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Create a leave request."""
    service = ShiftService(db)
    leave = service.create_leave_request(
        business_id=business_id,
        user_id=data.user_id,
        leave_type=data.leave_type,
        start_date=data.start_date,
        end_date=data.end_date,
        reason=data.reason,
    )
    return _leave_to_response(leave)


@router.patch("/leave/{leave_id}/approve", response_model=LeaveRequestResponse)
async def approve_leave(
    leave_id: str,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Approve a leave request."""
    service = ShiftService(db)
    leave = service.approve_leave(leave_id, business_id, str(current_user.id))
    if not leave:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")
    return _leave_to_response(leave)


@router.patch("/leave/{leave_id}/reject", response_model=LeaveRequestResponse)
async def reject_leave(
    leave_id: str,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Reject a leave request."""
    service = ShiftService(db)
    leave = service.reject_leave(leave_id, business_id)
    if not leave:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Leave request not found")
    return _leave_to_response(leave)
