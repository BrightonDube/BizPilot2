"""Time Entry API endpoints for time tracking and payroll."""

import io
import math
from typing import Optional
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict

# Import openpyxl at module level for efficiency
import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side

from app.core.database import get_db
from app.api.deps import get_current_active_user, get_current_business_id
from app.core.rbac import has_permission
from app.models.user import User
from app.models.time_entry import TimeEntry, TimeEntryStatus
from app.services.time_entry_service import TimeEntryService

router = APIRouter(prefix="/time-entries", tags=["Time Tracking"])


# --- Schemas ---

class TimeEntryCreate(BaseModel):
    """Schema for creating a time entry via clock in."""
    device_id: Optional[str] = None
    ip_address: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None


class TimeEntryManualCreate(BaseModel):
    """Schema for creating a manual time entry."""
    user_id: str
    clock_in: datetime
    clock_out: datetime
    notes: Optional[str] = None


class TimeEntryUpdate(BaseModel):
    """Schema for updating a time entry."""
    notes: Optional[str] = None


class TimeEntryApproval(BaseModel):
    """Schema for approving/rejecting a time entry."""
    approved: bool
    rejection_reason: Optional[str] = None


class TimeEntryResponse(BaseModel):
    """Response schema for a time entry."""
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    user_id: str
    user_name: Optional[str] = None
    business_id: str
    entry_type: str
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None
    break_start: Optional[datetime] = None
    break_end: Optional[datetime] = None
    hours_worked: Optional[float] = None
    break_duration: Optional[float] = None
    status: str
    device_id: Optional[str] = None
    ip_address: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    approved_by_id: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class TimeEntryListResponse(BaseModel):
    """Response schema for a list of time entries."""
    items: list[TimeEntryResponse]
    total: int
    page: int
    per_page: int
    pages: int


class UserTimeSummary(BaseModel):
    """Summary of user's time for a period."""
    user_id: str
    date_from: str
    date_to: str
    total_hours: float
    total_break_hours: float
    days_worked: int
    entries_count: int
    average_hours_per_day: float


class PayrollReportItem(BaseModel):
    """Individual user's payroll data."""
    user_id: str
    user_name: str
    email: str
    total_hours: float
    total_break_hours: float
    entries_count: int


class PayrollReport(BaseModel):
    """Payroll report for all users."""
    date_from: str
    date_to: str
    items: list[PayrollReportItem]
    total_hours: float


class ClockStatus(BaseModel):
    """Current clock status for a user."""
    is_clocked_in: bool
    entry_id: Optional[str] = None
    clock_in: Optional[datetime] = None
    is_on_break: bool = False
    break_start: Optional[datetime] = None


def _entry_to_response(entry: TimeEntry, user: Optional[User] = None) -> TimeEntryResponse:
    """Convert time entry to response."""
    return TimeEntryResponse(
        id=str(entry.id),
        user_id=str(entry.user_id),
        user_name=user.full_name if user else None,
        business_id=str(entry.business_id),
        entry_type=entry.entry_type.value if entry.entry_type else None,
        clock_in=entry.clock_in,
        clock_out=entry.clock_out,
        break_start=entry.break_start,
        break_end=entry.break_end,
        hours_worked=float(entry.hours_worked) if entry.hours_worked else None,
        break_duration=float(entry.break_duration) if entry.break_duration else None,
        status=entry.status.value if entry.status else None,
        device_id=entry.device_id,
        ip_address=entry.ip_address,
        location=entry.location,
        notes=entry.notes,
        approved_by_id=str(entry.approved_by_id) if entry.approved_by_id else None,
        approved_at=entry.approved_at,
        rejection_reason=entry.rejection_reason,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


# --- Endpoints ---

@router.get("/status", response_model=ClockStatus)
async def get_clock_status(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Get current clock status for the authenticated user."""
    service = TimeEntryService(db)
    entry = service.get_active_entry(str(current_user.id), business_id)
    
    if entry:
        is_on_break = entry.break_start is not None and entry.break_end is None
        return ClockStatus(
            is_clocked_in=True,
            entry_id=str(entry.id),
            clock_in=entry.clock_in,
            is_on_break=is_on_break,
            break_start=entry.break_start if is_on_break else None,
        )
    
    return ClockStatus(is_clocked_in=False)


@router.post("/clock-in", response_model=TimeEntryResponse)
async def clock_in(
    data: TimeEntryCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Clock in for the current user."""
    service = TimeEntryService(db)
    
    try:
        entry = service.clock_in(
            user_id=str(current_user.id),
            business_id=business_id,
            device_id=data.device_id,
            ip_address=data.ip_address,
            location=data.location,
            notes=data.notes,
        )
        return _entry_to_response(entry, current_user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/clock-out", response_model=TimeEntryResponse)
async def clock_out(
    data: TimeEntryUpdate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Clock out for the current user."""
    service = TimeEntryService(db)
    
    try:
        entry = service.clock_out(
            user_id=str(current_user.id),
            business_id=business_id,
            notes=data.notes,
        )
        return _entry_to_response(entry, current_user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/break/start", response_model=TimeEntryResponse)
async def start_break(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Start a break for the current user."""
    service = TimeEntryService(db)
    
    try:
        entry = service.start_break(str(current_user.id), business_id)
        return _entry_to_response(entry, current_user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/break/end", response_model=TimeEntryResponse)
async def end_break(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """End a break for the current user."""
    service = TimeEntryService(db)
    
    try:
        entry = service.end_break(str(current_user.id), business_id)
        return _entry_to_response(entry, current_user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=TimeEntryListResponse)
async def list_time_entries(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    user_id: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """List time entries with filtering."""
    service = TimeEntryService(db)
    
    # Parse status filter
    entry_status = None
    if status_filter:
        try:
            entry_status = TimeEntryStatus(status_filter)
        except ValueError:
            # Invalid status filter provided; ignore and treat as no status filter
            pass
    
    entries, total = service.get_entries(
        business_id=business_id,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
        status=entry_status,
        page=page,
        per_page=per_page,
    )
    
    # Get users for names
    user_map = {}
    for entry in entries:
        if entry.user_id not in user_map:
            user = db.query(User).filter(User.id == entry.user_id).first()
            user_map[entry.user_id] = user
    
    return TimeEntryListResponse(
        items=[_entry_to_response(e, user_map.get(e.user_id)) for e in entries],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.get("/summary/me", response_model=UserTimeSummary)
async def get_my_time_summary(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Get time summary for the current user."""
    service = TimeEntryService(db)
    
    # Default to current week
    if not date_to:
        date_to = date.today()
    if not date_from:
        date_from = date_to - timedelta(days=7)
    
    summary = service.get_user_summary(
        user_id=str(current_user.id),
        business_id=business_id,
        date_from=date_from,
        date_to=date_to,
    )
    
    return UserTimeSummary(**summary)


@router.get("/summary/{user_id}", response_model=UserTimeSummary)
async def get_user_time_summary(
    user_id: str,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    current_user: User = Depends(has_permission("reports:view")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Get time summary for a specific user (requires reports:view permission)."""
    service = TimeEntryService(db)
    
    # Default to current week
    if not date_to:
        date_to = date.today()
    if not date_from:
        date_from = date_to - timedelta(days=7)
    
    summary = service.get_user_summary(
        user_id=user_id,
        business_id=business_id,
        date_from=date_from,
        date_to=date_to,
    )
    
    return UserTimeSummary(**summary)


@router.get("/payroll-report", response_model=PayrollReport)
async def get_payroll_report(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    current_user: User = Depends(has_permission("reports:view")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Get payroll report for all users (requires reports:view permission)."""
    service = TimeEntryService(db)
    
    # Default to current pay period (2 weeks)
    if not date_to:
        date_to = date.today()
    if not date_from:
        date_from = date_to - timedelta(days=14)
    
    report = service.get_payroll_report(
        business_id=business_id,
        date_from=date_from,
        date_to=date_to,
    )
    
    total_hours = sum(item["total_hours"] for item in report)
    
    return PayrollReport(
        date_from=date_from.isoformat(),
        date_to=date_to.isoformat(),
        items=[PayrollReportItem(**item) for item in report],
        total_hours=total_hours,
    )


@router.get("/payroll-report/export")
async def export_payroll_report(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    current_user: User = Depends(has_permission("reports:view")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Export payroll report to Excel (requires reports:view permission)."""
    # openpyxl imported at module level for efficiency
    
    service = TimeEntryService(db)
    
    # Default to current pay period
    if not date_to:
        date_to = date.today()
    if not date_from:
        date_from = date_to - timedelta(days=14)
    
    report = service.get_payroll_report(
        business_id=business_id,
        date_from=date_from,
        date_to=date_to,
    )
    
    # Create workbook
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Payroll Report"
    
    # Styling
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="4A5568", end_color="4A5568", fill_type="solid")
    header_alignment = Alignment(horizontal="center", vertical="center")
    thin_border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    
    # Title row
    ws.merge_cells('A1:F1')
    ws['A1'] = f"Payroll Report: {date_from.isoformat()} to {date_to.isoformat()}"
    ws['A1'].font = Font(bold=True, size=14)
    ws['A1'].alignment = Alignment(horizontal="center")
    
    # Headers
    headers = ["Employee Name", "Email", "Total Hours", "Break Hours", "Net Hours", "Entries"]
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=3, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
        cell.border = thin_border
    
    # Data rows
    for row_idx, item in enumerate(report, 4):
        net_hours = item["total_hours"] - item["total_break_hours"]
        row_data = [
            item["user_name"],
            item["email"],
            round(item["total_hours"], 2),
            round(item["total_break_hours"], 2),
            round(net_hours, 2),
            item["entries_count"],
        ]
        for col_idx, value in enumerate(row_data, 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            cell.border = thin_border
    
    # Total row
    total_row = len(report) + 4
    total_hours = sum(item["total_hours"] for item in report)
    total_breaks = sum(item["total_break_hours"] for item in report)
    ws.cell(row=total_row, column=1, value="TOTAL").font = Font(bold=True)
    ws.cell(row=total_row, column=3, value=round(total_hours, 2)).font = Font(bold=True)
    ws.cell(row=total_row, column=4, value=round(total_breaks, 2)).font = Font(bold=True)
    ws.cell(row=total_row, column=5, value=round(total_hours - total_breaks, 2)).font = Font(bold=True)
    
    # Adjust column widths
    ws.column_dimensions['A'].width = 25
    ws.column_dimensions['B'].width = 30
    ws.column_dimensions['C'].width = 12
    ws.column_dimensions['D'].width = 12
    ws.column_dimensions['E'].width = 12
    ws.column_dimensions['F'].width = 10
    
    # Save to bytes
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    filename = f"payroll_report_{date_from.isoformat()}_{date_to.isoformat()}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/manual", response_model=TimeEntryResponse)
async def create_manual_entry(
    data: TimeEntryManualCreate,
    current_user: User = Depends(has_permission("users:manage")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Create a manual time entry (requires users:manage permission)."""
    service = TimeEntryService(db)
    
    try:
        entry = service.create_manual_entry(
            user_id=data.user_id,
            business_id=business_id,
            clock_in=data.clock_in,
            clock_out=data.clock_out,
            notes=data.notes,
            created_by_id=str(current_user.id),
        )
        return _entry_to_response(entry)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/{entry_id}/approve", response_model=TimeEntryResponse)
async def approve_time_entry(
    entry_id: str,
    data: TimeEntryApproval,
    current_user: User = Depends(has_permission("users:manage")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Approve or reject a time entry (requires users:manage permission)."""
    service = TimeEntryService(db)
    
    try:
        if data.approved:
            entry = service.approve_entry(entry_id, business_id, str(current_user.id))
        else:
            if not data.rejection_reason:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Rejection reason is required"
                )
            entry = service.reject_entry(entry_id, business_id, data.rejection_reason)
        
        return _entry_to_response(entry)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
