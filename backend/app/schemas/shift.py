"""Shift management schemas for API validation."""

from typing import Optional, List
from datetime import date, time, datetime
from pydantic import BaseModel, Field

from app.models.shift import ShiftStatus, LeaveType, LeaveStatus


# ── Shift schemas ──────────────────────────────────────────────

class ShiftCreate(BaseModel):
    """Schema for creating a shift."""
    user_id: str
    shift_date: date
    start_time: time
    end_time: time
    break_minutes: int = Field(0, ge=0)
    role: Optional[str] = Field(None, max_length=100)
    location_id: Optional[str] = None
    notes: Optional[str] = None


class ShiftUpdate(BaseModel):
    """Schema for updating a shift."""
    user_id: Optional[str] = None
    shift_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    break_minutes: Optional[int] = Field(None, ge=0)
    role: Optional[str] = Field(None, max_length=100)
    location_id: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[ShiftStatus] = None


class ShiftResponse(BaseModel):
    """Schema for shift response."""
    id: str
    business_id: str
    user_id: str
    user_name: Optional[str] = None
    location_id: Optional[str] = None
    shift_date: date
    start_time: time
    end_time: time
    break_minutes: int
    role: Optional[str] = None
    notes: Optional[str] = None
    status: ShiftStatus
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ShiftListResponse(BaseModel):
    """Paginated list of shifts."""
    items: List[ShiftResponse]
    total: int
    page: int
    per_page: int
    pages: int


class WeeklyScheduleResponse(BaseModel):
    """Weekly schedule grouped by date."""
    week_start: date
    schedule: dict[str, List[ShiftResponse]]


# ── Leave schemas ──────────────────────────────────────────────

class LeaveRequestCreate(BaseModel):
    """Schema for creating a leave request."""
    user_id: str
    leave_type: LeaveType
    start_date: date
    end_date: date
    reason: Optional[str] = None


class LeaveRequestResponse(BaseModel):
    """Schema for leave request response."""
    id: str
    business_id: str
    user_id: str
    user_name: Optional[str] = None
    leave_type: LeaveType
    start_date: date
    end_date: date
    reason: Optional[str] = None
    status: LeaveStatus
    approved_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LeaveRequestListResponse(BaseModel):
    """Paginated list of leave requests."""
    items: List[LeaveRequestResponse]
    total: int
    page: int
    per_page: int
    pages: int
