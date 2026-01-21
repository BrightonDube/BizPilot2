"""Time Entry model for user time tracking and payroll."""

from datetime import datetime
from decimal import Decimal
from sqlalchemy import Column, String, Text, Numeric, ForeignKey, DateTime, Enum as SQLEnum, Boolean, Date
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.models.base import BaseModel


class TimeEntryType(str, enum.Enum):
    """Type of time entry."""
    CLOCK_IN = "clock_in"
    CLOCK_OUT = "clock_out"
    BREAK_START = "break_start"
    BREAK_END = "break_end"
    MANUAL_ADJUSTMENT = "manual_adjustment"


class TimeEntryStatus(str, enum.Enum):
    """Status of time entry."""
    ACTIVE = "active"  # Currently clocked in
    COMPLETED = "completed"  # Work session completed
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"


class TimeEntry(BaseModel):
    """Time entry for tracking user work hours."""

    __tablename__ = "time_entries"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    # Entry type
    entry_type = Column(
        SQLEnum(TimeEntryType, values_callable=lambda x: [e.value for e in x], name='timeentrytype'),
        default=TimeEntryType.CLOCK_IN
    )
    
    # Timestamps
    clock_in = Column(DateTime, nullable=True)
    clock_out = Column(DateTime, nullable=True)
    break_start = Column(DateTime, nullable=True)
    break_end = Column(DateTime, nullable=True)
    
    # Calculated hours
    hours_worked = Column(Numeric(6, 2), default=0)  # Total hours for this entry
    break_duration = Column(Numeric(6, 2), default=0)  # Break time in hours
    net_hours = Column(Numeric(6, 2), default=0)  # Net working hours (hours_worked - break_duration)
    
    # Auto clock-out fields
    is_auto_clocked_out = Column(Boolean, default=False)
    auto_clock_out_reason = Column(Text, nullable=True)
    
    # Payroll fields
    payroll_period_start = Column(Date, nullable=True)
    payroll_period_end = Column(Date, nullable=True)
    is_overtime = Column(Boolean, default=False)
    overtime_hours = Column(Numeric(6, 2), default=0)
    
    # Status
    status = Column(
        SQLEnum(TimeEntryStatus, values_callable=lambda x: [e.value for e in x], name='timeentrystatus'),
        default=TimeEntryStatus.ACTIVE
    )
    
    # Location/device info
    device_id = Column(String(255), nullable=True)  # POS terminal ID
    ip_address = Column(String(45), nullable=True)
    location = Column(String(255), nullable=True)
    
    # Notes
    notes = Column(Text, nullable=True)
    
    # Approval
    approved_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])

    def __repr__(self) -> str:
        return f"<TimeEntry {self.id} user={self.user_id} status={self.status}>"

    def calculate_hours(self, current_time: datetime = None) -> Decimal:
        """Calculate hours worked for this entry.
        
        Args:
            current_time: The time to use as end time for active entries.
                         If not provided and clock_out is None, returns 0.
        """
        if not self.clock_in:
            return Decimal("0")
        
        # For completed entries, use clock_out; for active entries, use provided time
        if self.clock_out:
            end_time = self.clock_out
        elif current_time:
            end_time = current_time
        else:
            return Decimal("0")  # Cannot calculate without end time
        
        total_seconds = (end_time - self.clock_in).total_seconds()
        
        # Subtract break time
        break_seconds = 0
        if self.break_start and self.break_end:
            break_seconds = (self.break_end - self.break_start).total_seconds()
        
        net_seconds = max(0, total_seconds - break_seconds)
        hours = Decimal(str(net_seconds)) / Decimal("3600")
        return hours.quantize(Decimal("0.01"))

    @property
    def is_active(self) -> bool:
        """Check if user is currently clocked in."""
        return self.clock_in is not None and self.clock_out is None
