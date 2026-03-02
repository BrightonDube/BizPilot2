"""Modifier availability model.

Controls when specific modifiers are available for selection based on
time windows, day of week, date ranges, and location (Requirement 6
of the addons-modifiers spec).

Each row represents a single availability rule.  Multiple rules can
apply to the same modifier — the service layer combines them to
determine current availability.

Why individual rows instead of a JSON schedule?
Rows allow efficient SQL filtering ("give me all available modifiers
for location X on Tuesday at 14:00") without needing to parse JSON
in the database layer.
"""

from sqlalchemy import Boolean, Column, Date, ForeignKey, Integer, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class ModifierAvailability(BaseModel):
    """An availability rule for a modifier.

    Attributes:
        modifier_id: The modifier this rule applies to.
        day_of_week: ISO 8601 day number (0=Mon … 6=Sun).  NULL = every day.
        start_time: Start of time window within a day.  NULL = midnight.
        end_time: End of time window within a day.  NULL = end of day.
        start_date: Start of seasonal availability.  NULL = no start bound.
        end_date: End of seasonal availability.  NULL = no end bound.
        location_id: Specific location UUID.  NULL = all locations.
        is_available: False can represent the "86'd" (temporarily
            unavailable) concept common in restaurant POS systems.
    """

    __tablename__ = "modifier_availability"

    modifier_id = Column(
        UUID(as_uuid=True),
        ForeignKey("modifiers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    day_of_week = Column(Integer, nullable=True)
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    location_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    is_available = Column(Boolean, nullable=False, default=True)

    # Relationships
    modifier = relationship("Modifier", foreign_keys=[modifier_id])

    def __repr__(self) -> str:
        day_str = f"day={self.day_of_week}" if self.day_of_week is not None else "all-days"
        return f"<ModifierAvailability modifier={self.modifier_id} {day_str} avail={self.is_available}>"
