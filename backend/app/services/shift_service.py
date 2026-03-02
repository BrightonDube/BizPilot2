"""Shift management service."""

from typing import List, Optional, Tuple
from datetime import date, time, datetime, timedelta
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.shift import Shift, ShiftStatus, LeaveRequest, LeaveType, LeaveStatus


class ShiftService:
    """Service for shift and leave management operations."""

    def __init__(self, db: Session):
        self.db = db

    # ── Shift CRUD ─────────────────────────────────────────────

    def create_shift(
        self,
        business_id: str,
        user_id: str,
        shift_date: date,
        start_time: time,
        end_time: time,
        break_minutes: int = 0,
        role: Optional[str] = None,
        location_id: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> Shift:
        """Create a new shift."""
        shift = Shift(
            business_id=business_id,
            user_id=user_id,
            shift_date=shift_date,
            start_time=start_time,
            end_time=end_time,
            break_minutes=break_minutes,
            role=role,
            location_id=location_id,
            notes=notes,
            status=ShiftStatus.SCHEDULED,
        )
        self.db.add(shift)
        self.db.commit()
        self.db.refresh(shift)
        return shift

    def list_shifts(
        self,
        business_id: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        user_id: Optional[str] = None,
        shift_status: Optional[ShiftStatus] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[Shift], int]:
        """List shifts with filters and pagination."""
        query = self.db.query(Shift).filter(
            Shift.business_id == business_id,
            Shift.deleted_at.is_(None),
        )

        if start_date:
            query = query.filter(Shift.shift_date >= start_date)
        if end_date:
            query = query.filter(Shift.shift_date <= end_date)
        if user_id:
            query = query.filter(Shift.user_id == user_id)
        if shift_status:
            query = query.filter(Shift.status == shift_status)

        total = query.count()
        query = query.order_by(Shift.shift_date.asc(), Shift.start_time.asc())
        offset = (page - 1) * per_page
        items = query.offset(offset).limit(per_page).all()
        return items, total

    def get_shift(self, shift_id: str, business_id: str) -> Optional[Shift]:
        """Get a single shift by ID."""
        return self.db.query(Shift).filter(
            Shift.id == shift_id,
            Shift.business_id == business_id,
            Shift.deleted_at.is_(None),
        ).first()

    def update_shift(self, shift_id: str, business_id: str, **kwargs) -> Optional[Shift]:
        """Update a shift."""
        shift = self.get_shift(shift_id, business_id)
        if not shift:
            return None
        for key, value in kwargs.items():
            if value is not None and hasattr(shift, key):
                setattr(shift, key, value)
        self.db.commit()
        self.db.refresh(shift)
        return shift

    def delete_shift(self, shift_id: str, business_id: str) -> bool:
        """Soft-delete a shift."""
        shift = self.get_shift(shift_id, business_id)
        if not shift:
            return False
        shift.deleted_at = datetime.utcnow()
        self.db.commit()
        return True

    def clock_in(self, shift_id: str, business_id: str) -> Optional[Shift]:
        """Clock in: set actual_start and mark in-progress."""
        shift = self.get_shift(shift_id, business_id)
        if not shift:
            return None
        if shift.status != ShiftStatus.SCHEDULED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Shift must be in SCHEDULED status to clock in",
            )
        shift.actual_start = datetime.utcnow()
        shift.status = ShiftStatus.IN_PROGRESS
        self.db.commit()
        self.db.refresh(shift)
        return shift

    def clock_out(self, shift_id: str, business_id: str) -> Optional[Shift]:
        """Clock out: set actual_end and mark completed."""
        shift = self.get_shift(shift_id, business_id)
        if not shift:
            return None
        if shift.status != ShiftStatus.IN_PROGRESS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Shift must be IN_PROGRESS to clock out",
            )
        shift.actual_end = datetime.utcnow()
        shift.status = ShiftStatus.COMPLETED
        self.db.commit()
        self.db.refresh(shift)
        return shift

    def get_schedule(
        self, business_id: str, week_start_date: date
    ) -> dict[str, List[Shift]]:
        """Get a week's shifts grouped by date."""
        week_end = week_start_date + timedelta(days=6)
        shifts, _ = self.list_shifts(
            business_id=business_id,
            start_date=week_start_date,
            end_date=week_end,
            per_page=1000,
        )
        schedule: dict[str, List[Shift]] = {}
        for shift in shifts:
            key = shift.shift_date.isoformat()
            schedule.setdefault(key, []).append(shift)
        return schedule

    # ── Leave Requests ─────────────────────────────────────────

    def create_leave_request(
        self,
        business_id: str,
        user_id: str,
        leave_type: LeaveType,
        start_date: date,
        end_date: date,
        reason: Optional[str] = None,
    ) -> LeaveRequest:
        """Create a leave request."""
        leave = LeaveRequest(
            business_id=business_id,
            user_id=user_id,
            leave_type=leave_type,
            start_date=start_date,
            end_date=end_date,
            reason=reason,
            status=LeaveStatus.PENDING,
        )
        self.db.add(leave)
        self.db.commit()
        self.db.refresh(leave)
        return leave

    def list_leave_requests(
        self,
        business_id: str,
        user_id: Optional[str] = None,
        leave_status: Optional[LeaveStatus] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[LeaveRequest], int]:
        """List leave requests with filters and pagination."""
        query = self.db.query(LeaveRequest).filter(
            LeaveRequest.business_id == business_id,
            LeaveRequest.deleted_at.is_(None),
        )
        if user_id:
            query = query.filter(LeaveRequest.user_id == user_id)
        if leave_status:
            query = query.filter(LeaveRequest.status == leave_status)

        total = query.count()
        query = query.order_by(LeaveRequest.created_at.desc())
        offset = (page - 1) * per_page
        items = query.offset(offset).limit(per_page).all()
        return items, total

    def approve_leave(
        self, leave_id: str, business_id: str, approved_by: str
    ) -> Optional[LeaveRequest]:
        """Approve a leave request."""
        leave = self.db.query(LeaveRequest).filter(
            LeaveRequest.id == leave_id,
            LeaveRequest.business_id == business_id,
            LeaveRequest.deleted_at.is_(None),
        ).first()
        if not leave:
            return None
        if leave.status != LeaveStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PENDING leave requests can be approved",
            )
        leave.status = LeaveStatus.APPROVED
        leave.approved_by = approved_by
        self.db.commit()
        self.db.refresh(leave)
        return leave

    def reject_leave(
        self, leave_id: str, business_id: str
    ) -> Optional[LeaveRequest]:
        """Reject a leave request."""
        leave = self.db.query(LeaveRequest).filter(
            LeaveRequest.id == leave_id,
            LeaveRequest.business_id == business_id,
            LeaveRequest.deleted_at.is_(None),
        ).first()
        if not leave:
            return None
        if leave.status != LeaveStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PENDING leave requests can be rejected",
            )
        leave.status = LeaveStatus.REJECTED
        self.db.commit()
        self.db.refresh(leave)
        return leave
