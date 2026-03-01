"""Shift management models."""

import enum
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, Enum as SQLEnum, Date, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class ShiftStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class LeaveType(str, enum.Enum):
    ANNUAL = "annual"
    SICK = "sick"
    FAMILY = "family"
    UNPAID = "unpaid"
    OTHER = "other"


class LeaveStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class Shift(BaseModel):
    """Scheduled shift for a staff member."""
    __tablename__ = "shifts"

    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=True)
    shift_date = Column(Date, nullable=False, index=True)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    break_minutes = Column(Integer, default=0)
    role = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(
        SQLEnum(ShiftStatus, values_callable=lambda x: [e.value for e in x], name='shiftstatus'),
        default=ShiftStatus.SCHEDULED,
    )
    actual_start = Column(DateTime(timezone=True), nullable=True)
    actual_end = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", lazy="joined")


class LeaveRequest(BaseModel):
    """Staff leave request."""
    __tablename__ = "leave_requests"

    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    leave_type = Column(
        SQLEnum(LeaveType, values_callable=lambda x: [e.value for e in x], name='leavetype'),
        nullable=False,
    )
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    reason = Column(Text, nullable=True)
    status = Column(
        SQLEnum(LeaveStatus, values_callable=lambda x: [e.value for e in x], name='leavestatus'),
        default=LeaveStatus.PENDING,
    )
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    user = relationship("User", foreign_keys=[user_id], lazy="joined")
