"""Time Entry service for user time tracking."""

from typing import List, Optional, Tuple
from datetime import datetime, date, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, extract

from app.models.time_entry import TimeEntry, TimeEntryType, TimeEntryStatus
from app.models.user import User


class TimeEntryService:
    """Service for time tracking operations."""

    def __init__(self, db: Session):
        self.db = db

    def get_active_entry(self, user_id: str, business_id: str) -> Optional[TimeEntry]:
        """Get active (clocked in) entry for a user."""
        return self.db.query(TimeEntry).filter(
            TimeEntry.user_id == user_id,
            TimeEntry.business_id == business_id,
            TimeEntry.status == TimeEntryStatus.ACTIVE,
            TimeEntry.clock_out.is_(None),
            TimeEntry.deleted_at.is_(None),
        ).first()

    def clock_in(
        self,
        user_id: str,
        business_id: str,
        device_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        location: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> TimeEntry:
        """Clock in a user."""
        # Check if already clocked in
        active = self.get_active_entry(user_id, business_id)
        if active:
            raise ValueError("Already clocked in. Please clock out first.")
        
        entry = TimeEntry(
            user_id=user_id,
            business_id=business_id,
            entry_type=TimeEntryType.CLOCK_IN,
            clock_in=datetime.utcnow(),
            status=TimeEntryStatus.ACTIVE,
            device_id=device_id,
            ip_address=ip_address,
            location=location,
            notes=notes,
        )
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def clock_out(
        self,
        user_id: str,
        business_id: str,
        notes: Optional[str] = None,
    ) -> TimeEntry:
        """Clock out a user."""
        entry = self.get_active_entry(user_id, business_id)
        if not entry:
            raise ValueError("Not currently clocked in.")
        
        clock_out_time = datetime.utcnow()
        entry.clock_out = clock_out_time
        entry.status = TimeEntryStatus.COMPLETED
        entry.hours_worked = entry.calculate_hours(current_time=clock_out_time)
        
        if notes:
            existing_notes = entry.notes or ""
            entry.notes = f"{existing_notes}\n[Clock Out] {notes}".strip()
        
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def start_break(self, user_id: str, business_id: str) -> TimeEntry:
        """Start a break for a clocked-in user."""
        entry = self.get_active_entry(user_id, business_id)
        if not entry:
            raise ValueError("Not currently clocked in.")
        
        if entry.break_start and not entry.break_end:
            raise ValueError("Already on break.")
        
        entry.break_start = datetime.utcnow()
        entry.break_end = None
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def end_break(self, user_id: str, business_id: str) -> TimeEntry:
        """End a break for a user."""
        entry = self.get_active_entry(user_id, business_id)
        if not entry:
            raise ValueError("Not currently clocked in.")
        
        if not entry.break_start:
            raise ValueError("Not currently on break.")
        
        if entry.break_end:
            raise ValueError("Break already ended.")
        
        entry.break_end = datetime.utcnow()
        
        # Calculate break duration
        break_seconds = (entry.break_end - entry.break_start).total_seconds()
        break_hours = Decimal(str(break_seconds)) / Decimal("3600")
        entry.break_duration = (entry.break_duration or Decimal("0")) + break_hours.quantize(Decimal("0.01"))
        
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def get_entries(
        self,
        business_id: str,
        user_id: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        status: Optional[TimeEntryStatus] = None,
        page: int = 1,
        per_page: int = 50,
    ) -> Tuple[List[TimeEntry], int]:
        """Get time entries with filtering."""
        query = self.db.query(TimeEntry).filter(
            TimeEntry.business_id == business_id,
            TimeEntry.deleted_at.is_(None),
        )
        
        if user_id:
            query = query.filter(TimeEntry.user_id == user_id)
        
        if date_from:
            query = query.filter(TimeEntry.clock_in >= datetime.combine(date_from, datetime.min.time()))
        
        if date_to:
            query = query.filter(TimeEntry.clock_in <= datetime.combine(date_to, datetime.max.time()))
        
        if status:
            query = query.filter(TimeEntry.status == status)
        
        total = query.count()
        query = query.order_by(TimeEntry.clock_in.desc())
        offset = (page - 1) * per_page
        entries = query.offset(offset).limit(per_page).all()
        
        return entries, total

    def get_user_summary(
        self,
        user_id: str,
        business_id: str,
        date_from: date,
        date_to: date,
    ) -> dict:
        """Get time summary for a user in a date range."""
        entries = self.db.query(TimeEntry).filter(
            TimeEntry.user_id == user_id,
            TimeEntry.business_id == business_id,
            TimeEntry.status == TimeEntryStatus.COMPLETED,
            TimeEntry.clock_in >= datetime.combine(date_from, datetime.min.time()),
            TimeEntry.clock_in <= datetime.combine(date_to, datetime.max.time()),
            TimeEntry.deleted_at.is_(None),
        ).all()
        
        total_hours = sum(e.hours_worked or Decimal("0") for e in entries)
        total_breaks = sum(e.break_duration or Decimal("0") for e in entries)
        days_worked = len(set(e.clock_in.date() for e in entries if e.clock_in))
        
        return {
            "user_id": user_id,
            "date_from": date_from.isoformat(),
            "date_to": date_to.isoformat(),
            "total_hours": float(total_hours),
            "total_break_hours": float(total_breaks),
            "days_worked": days_worked,
            "entries_count": len(entries),
            "average_hours_per_day": float(total_hours / days_worked) if days_worked > 0 else 0,
        }

    def get_payroll_report(
        self,
        business_id: str,
        date_from: date,
        date_to: date,
    ) -> List[dict]:
        """Get payroll report for all users in a date range."""
        # Get all users with time entries in the date range
        user_entries = self.db.query(
            TimeEntry.user_id,
            func.sum(TimeEntry.hours_worked).label('total_hours'),
            func.sum(TimeEntry.break_duration).label('total_breaks'),
            func.count(TimeEntry.id).label('entries_count'),
        ).filter(
            TimeEntry.business_id == business_id,
            TimeEntry.status == TimeEntryStatus.COMPLETED,
            TimeEntry.clock_in >= datetime.combine(date_from, datetime.min.time()),
            TimeEntry.clock_in <= datetime.combine(date_to, datetime.max.time()),
            TimeEntry.deleted_at.is_(None),
        ).group_by(TimeEntry.user_id).all()
        
        report = []
        for entry in user_entries:
            user = self.db.query(User).filter(User.id == entry.user_id).first()
            report.append({
                "user_id": str(entry.user_id),
                "user_name": user.full_name if user else "Unknown",
                "email": user.email if user else "",
                "total_hours": float(entry.total_hours or 0),
                "total_break_hours": float(entry.total_breaks or 0),
                "entries_count": entry.entries_count,
            })
        
        return report

    def approve_entry(
        self,
        entry_id: str,
        business_id: str,
        approved_by_id: str,
    ) -> TimeEntry:
        """Approve a time entry."""
        entry = self.db.query(TimeEntry).filter(
            TimeEntry.id == entry_id,
            TimeEntry.business_id == business_id,
            TimeEntry.deleted_at.is_(None),
        ).first()
        
        if not entry:
            raise ValueError("Time entry not found.")
        
        entry.status = TimeEntryStatus.APPROVED
        entry.approved_by_id = approved_by_id
        entry.approved_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def reject_entry(
        self,
        entry_id: str,
        business_id: str,
        reason: str,
    ) -> TimeEntry:
        """Reject a time entry."""
        entry = self.db.query(TimeEntry).filter(
            TimeEntry.id == entry_id,
            TimeEntry.business_id == business_id,
            TimeEntry.deleted_at.is_(None),
        ).first()
        
        if not entry:
            raise ValueError("Time entry not found.")
        
        entry.status = TimeEntryStatus.REJECTED
        entry.rejection_reason = reason
        
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def create_manual_entry(
        self,
        user_id: str,
        business_id: str,
        clock_in: datetime,
        clock_out: datetime,
        notes: Optional[str] = None,
        created_by_id: Optional[str] = None,
    ) -> TimeEntry:
        """Create a manual time entry (for adjustments)."""
        if clock_out < clock_in:
            raise ValueError("Clock out time must be after clock in time.")
        
        total_seconds = (clock_out - clock_in).total_seconds()
        hours_worked = Decimal(str(total_seconds)) / Decimal("3600")
        
        entry = TimeEntry(
            user_id=user_id,
            business_id=business_id,
            entry_type=TimeEntryType.MANUAL_ADJUSTMENT,
            clock_in=clock_in,
            clock_out=clock_out,
            hours_worked=hours_worked.quantize(Decimal("0.01")),
            status=TimeEntryStatus.PENDING_APPROVAL,
            notes=f"[Manual Entry] {notes}" if notes else "[Manual Entry]",
        )
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry
