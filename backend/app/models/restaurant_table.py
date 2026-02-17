"""Restaurant table model for table management."""

import enum
from sqlalchemy import Column, String, Integer, Enum as SQLEnum, Numeric, Boolean
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import BaseModel


class TableStatus(str, enum.Enum):
    """Table status."""
    AVAILABLE = "available"
    OCCUPIED = "occupied"
    RESERVED = "reserved"
    DIRTY = "dirty"
    BLOCKED = "blocked"


class RestaurantTable(BaseModel):
    """Restaurant table for dine-in order management."""

    __tablename__ = "restaurant_tables"

    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    table_number = Column(String(20), nullable=False)
    capacity = Column(Integer, default=4)
    status = Column(
        SQLEnum(TableStatus, values_callable=lambda x: [e.value for e in x], name='tablestatus'),
        default=TableStatus.AVAILABLE,
    )
    section = Column(String(50), nullable=True)
    position_x = Column(Numeric(8, 2), default=0)
    position_y = Column(Numeric(8, 2), default=0)
    is_active = Column(Boolean, default=True)

    def __repr__(self) -> str:
        return f"<RestaurantTable {self.table_number}>"
