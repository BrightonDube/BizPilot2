"""Business Time Settings model for time tracking configuration."""

from datetime import time
from decimal import Decimal
from sqlalchemy import Column, String, Time, Numeric, ForeignKey, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import BaseModel


class BusinessTimeSettings(BaseModel):
    """Business-specific time tracking settings."""

    __tablename__ = "business_time_settings"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    
    # Day-end processing
    day_end_time = Column(Time, nullable=False, default=time(23, 59))  # When to auto clock-out employees
    auto_clock_out_penalty_hours = Column(Numeric(4, 2), default=Decimal("5.00"))  # Penalty hours for not clocking out
    
    # Work hour settings
    standard_work_hours = Column(Numeric(4, 2), default=Decimal("8.00"))  # Standard work day hours
    overtime_threshold = Column(Numeric(4, 2), default=Decimal("8.00"))  # Hours before overtime kicks in
    
    # Payroll settings
    payroll_period_type = Column(String(20), default="monthly")  # 'weekly', 'bi-weekly', 'monthly'
    payroll_period_start_day = Column(Integer, default=1)  # Day of month for monthly, day of week for weekly
    
    # Relationships
    business = relationship("Business", backref="time_settings")

    def __repr__(self) -> str:
        return f"<BusinessTimeSettings {self.business_id}>"

    @property
    def day_end_time_str(self) -> str:
        """Return day end time as string."""
        return self.day_end_time.strftime("%H:%M") if self.day_end_time else "23:59"

    def should_auto_clock_out(self, current_time: time) -> bool:
        """Check if current time is past day end time."""
        return current_time >= self.day_end_time if self.day_end_time else False