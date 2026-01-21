"""Time tracking service for managing employee time entries and payroll."""

from datetime import datetime, date
from decimal import Decimal
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from app.models.time_entry import TimeEntry, TimeEntryStatus
from app.models.business_time_settings import BusinessTimeSettings
from app.models.business_user import BusinessUser


class TimeTrackingService:
    """Service for managing time tracking operations."""

    def __init__(self, db: Session):
        self.db = db

    def get_or_create_business_settings(self, business_id: str) -> BusinessTimeSettings:
        """Get or create business time settings."""
        settings = self.db.query(BusinessTimeSettings).filter(
            BusinessTimeSettings.business_id == business_id
        ).first()
        
        if not settings:
            settings = BusinessTimeSettings(business_id=business_id)
            self.db.add(settings)
            self.db.commit()
            self.db.refresh(settings)
        
        return settings

    def clock_in(self, business_id: str, user_id: str, device_id: str = None, location: str = None) -> TimeEntry:
        """Clock in a user."""
        # Check if user is already clocked in
        active_entry = self.db.query(TimeEntry).filter(
            and_(
                TimeEntry.business_id == business_id,
                TimeEntry.user_id == user_id,
                TimeEntry.clock_out.is_(None),
                TimeEntry.status == TimeEntryStatus.ACTIVE
            )
        ).first()
        
        if active_entry:
            raise ValueError("User is already clocked in")
        
        entry = TimeEntry(
            business_id=business_id,
            user_id=user_id,
            clock_in=datetime.now(),
            status=TimeEntryStatus.ACTIVE,
            device_id=device_id,
            location=location
        )
        
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def clock_out(self, business_id: str, user_id: str, auto_clock_out: bool = False, reason: str = None) -> TimeEntry:
        """Clock out a user."""
        active_entry = self.db.query(TimeEntry).filter(
            and_(
                TimeEntry.business_id == business_id,
                TimeEntry.user_id == user_id,
                TimeEntry.clock_out.is_(None),
                TimeEntry.status == TimeEntryStatus.ACTIVE
            )
        ).first()
        
        if not active_entry:
            raise ValueError("No active time entry found")
        
        now = datetime.now()
        active_entry.clock_out = now
        active_entry.status = TimeEntryStatus.COMPLETED
        
        if auto_clock_out:
            settings = self.get_or_create_business_settings(business_id)
            active_entry.is_auto_clocked_out = True
            active_entry.auto_clock_out_reason = reason or "Auto clocked out at day end"
            active_entry.hours_worked = settings.auto_clock_out_penalty_hours
            active_entry.net_hours = settings.auto_clock_out_penalty_hours
        else:
            # Calculate actual hours
            self._calculate_hours(active_entry)
        
        self.db.commit()
        self.db.refresh(active_entry)
        return active_entry

    def start_break(self, business_id: str, user_id: str) -> TimeEntry:
        """Start break for a user."""
        active_entry = self._get_active_entry(business_id, user_id)
        if not active_entry:
            raise ValueError("No active time entry found")
        
        if active_entry.break_start:
            raise ValueError("Break already started")
        
        active_entry.break_start = datetime.now()
        self.db.commit()
        self.db.refresh(active_entry)
        return active_entry

    def end_break(self, business_id: str, user_id: str) -> TimeEntry:
        """End break for a user."""
        active_entry = self._get_active_entry(business_id, user_id)
        if not active_entry:
            raise ValueError("No active time entry found")
        
        if not active_entry.break_start:
            raise ValueError("No active break found")
        
        if active_entry.break_end:
            raise ValueError("Break already ended")
        
        active_entry.break_end = datetime.now()
        self._calculate_break_duration(active_entry)
        self.db.commit()
        self.db.refresh(active_entry)
        return active_entry

    def update_time_entry(self, entry_id: str, clock_in: datetime = None, clock_out: datetime = None, 
                         break_start: datetime = None, break_end: datetime = None, 
                         break_duration: Decimal = None, notes: str = None) -> TimeEntry:
        """Update time entry (admin/manager only)."""
        entry = self.db.query(TimeEntry).filter(TimeEntry.id == entry_id).first()
        if not entry:
            raise ValueError("Time entry not found")
        
        if clock_in:
            entry.clock_in = clock_in
        if clock_out:
            entry.clock_out = clock_out
        if break_start:
            entry.break_start = break_start
        if break_end:
            entry.break_end = break_end
        if break_duration is not None:
            entry.break_duration = break_duration
        if notes is not None:
            entry.notes = notes
        
        # Recalculate hours
        self._calculate_hours(entry)
        
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def get_user_time_entries(self, business_id: str, user_id: str, start_date: date = None, 
                            end_date: date = None) -> List[TimeEntry]:
        """Get time entries for a user within date range."""
        query = self.db.query(TimeEntry).filter(
            and_(
                TimeEntry.business_id == business_id,
                TimeEntry.user_id == user_id
            )
        )
        
        if start_date:
            query = query.filter(func.date(TimeEntry.clock_in) >= start_date)
        if end_date:
            query = query.filter(func.date(TimeEntry.clock_in) <= end_date)
        
        return query.order_by(TimeEntry.clock_in.desc()).all()

    def get_team_time_entries(self, business_id: str, start_date: date = None, 
                            end_date: date = None) -> Dict[str, List[TimeEntry]]:
        """Get time entries for all team members."""
        query = self.db.query(TimeEntry).filter(TimeEntry.business_id == business_id)
        
        if start_date:
            query = query.filter(func.date(TimeEntry.clock_in) >= start_date)
        if end_date:
            query = query.filter(func.date(TimeEntry.clock_in) <= end_date)
        
        entries = query.order_by(TimeEntry.user_id, TimeEntry.clock_in.desc()).all()
        
        # Group by user
        result = {}
        for entry in entries:
            user_id = str(entry.user_id)
            if user_id not in result:
                result[user_id] = []
            result[user_id].append(entry)
        
        return result

    def get_payroll_report(self, business_id: str, start_date: date, end_date: date) -> List[Dict]:
        """Generate payroll report for date range."""
        # Get all business users
        business_users = self.db.query(BusinessUser).filter(
            BusinessUser.business_id == business_id
        ).all()
        
        report = []
        for bu in business_users:
            user = bu.user
            entries = self.get_user_time_entries(business_id, str(user.id), start_date, end_date)
            
            total_hours = sum(entry.net_hours or Decimal("0") for entry in entries)
            break_hours = sum(entry.break_duration or Decimal("0") for entry in entries)
            entry_count = len([e for e in entries if e.clock_out])  # Only completed entries
            
            report.append({
                "user_id": str(user.id),
                "employee": f"{user.first_name} {user.last_name}",
                "email": user.email,
                "total_hours": float(total_hours),
                "break_hours": float(break_hours),
                "net_hours": float(total_hours),  # Already calculated as net
                "entries": entry_count,
                "entries_data": entries
            })
        
        return report

    def run_day_end_process(self, business_id: str) -> Dict[str, int]:
        """Run day-end process to auto clock-out employees."""
        settings = self.get_or_create_business_settings(business_id)
        current_time = datetime.now().time()
        
        if not settings.should_auto_clock_out(current_time):
            return {"auto_clocked_out": 0, "message": "Not yet time for day-end process"}
        
        # Find all active entries
        active_entries = self.db.query(TimeEntry).filter(
            and_(
                TimeEntry.business_id == business_id,
                TimeEntry.clock_out.is_(None),
                TimeEntry.status == TimeEntryStatus.ACTIVE
            )
        ).all()
        
        auto_clocked_out = 0
        for entry in active_entries:
            try:
                self.clock_out(
                    business_id=business_id,
                    user_id=str(entry.user_id),
                    auto_clock_out=True,
                    reason=f"Auto clocked out at day end ({settings.day_end_time_str})"
                )
                auto_clocked_out += 1
            except Exception as e:
                print(f"Error auto-clocking out user {entry.user_id}: {e}")
        
        return {
            "auto_clocked_out": auto_clocked_out,
            "penalty_hours": float(settings.auto_clock_out_penalty_hours),
            "message": f"Auto clocked out {auto_clocked_out} employees with {settings.auto_clock_out_penalty_hours} hour penalty"
        }

    def get_currently_working_users(self, business_id: str) -> List[Dict]:
        """Get list of currently working users."""
        active_entries = self.db.query(TimeEntry).filter(
            and_(
                TimeEntry.business_id == business_id,
                TimeEntry.clock_out.is_(None),
                TimeEntry.status == TimeEntryStatus.ACTIVE
            )
        ).all()
        
        result = []
        for entry in active_entries:
            user = entry.user
            current_hours = self._calculate_current_hours(entry)
            
            result.append({
                "user_id": str(user.id),
                "name": f"{user.first_name} {user.last_name}",
                "email": user.email,
                "clock_in": entry.clock_in.isoformat(),
                "current_hours": float(current_hours),
                "on_break": entry.break_start is not None and entry.break_end is None,
                "break_start": entry.break_start.isoformat() if entry.break_start else None
            })
        
        return result

    def _get_active_entry(self, business_id: str, user_id: str) -> Optional[TimeEntry]:
        """Get active time entry for user."""
        return self.db.query(TimeEntry).filter(
            and_(
                TimeEntry.business_id == business_id,
                TimeEntry.user_id == user_id,
                TimeEntry.clock_out.is_(None),
                TimeEntry.status == TimeEntryStatus.ACTIVE
            )
        ).first()

    def _calculate_hours(self, entry: TimeEntry) -> None:
        """Calculate hours for a time entry."""
        if not entry.clock_in or not entry.clock_out:
            return
        
        # Calculate total hours
        total_seconds = (entry.clock_out - entry.clock_in).total_seconds()
        entry.hours_worked = Decimal(str(total_seconds)) / Decimal("3600")
        
        # Calculate break duration if not manually set
        if entry.break_start and entry.break_end and not entry.break_duration:
            self._calculate_break_duration(entry)
        
        # Calculate net hours
        entry.net_hours = entry.hours_worked - (entry.break_duration or Decimal("0"))
        
        # Round to 2 decimal places
        entry.hours_worked = entry.hours_worked.quantize(Decimal("0.01"))
        entry.net_hours = entry.net_hours.quantize(Decimal("0.01"))

    def _calculate_break_duration(self, entry: TimeEntry) -> None:
        """Calculate break duration for a time entry."""
        if entry.break_start and entry.break_end:
            break_seconds = (entry.break_end - entry.break_start).total_seconds()
            entry.break_duration = (Decimal(str(break_seconds)) / Decimal("3600")).quantize(Decimal("0.01"))

    def _calculate_current_hours(self, entry: TimeEntry) -> Decimal:
        """Calculate current hours for an active entry."""
        if not entry.clock_in:
            return Decimal("0")
        
        now = datetime.now()
        total_seconds = (now - entry.clock_in).total_seconds()
        
        # Subtract break time if on break
        break_seconds = 0
        if entry.break_start:
            if entry.break_end:
                # Break completed
                break_seconds = (entry.break_end - entry.break_start).total_seconds()
            else:
                # Currently on break
                break_seconds = (now - entry.break_start).total_seconds()
        
        net_seconds = max(0, total_seconds - break_seconds)
        hours = Decimal(str(net_seconds)) / Decimal("3600")
        return hours.quantize(Decimal("0.01"))