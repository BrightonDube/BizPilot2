"""Restaurant table and floor plan models for table management."""

import enum
from sqlalchemy import Column, String, Integer, Enum as SQLEnum, Numeric, Boolean, Text, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class TableStatus(str, enum.Enum):
    """Table status."""
    AVAILABLE = "available"
    OCCUPIED = "occupied"
    RESERVED = "reserved"
    DIRTY = "dirty"
    BLOCKED = "blocked"


class ReservationStatus(str, enum.Enum):
    """Reservation status values."""
    CONFIRMED = "confirmed"
    SEATED = "seated"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class FloorPlan(BaseModel):
    """A named floor/area layout (e.g. 'Main Dining', 'Patio').

    Floor plans are the top-level container for table positioning.
    The width/height define the canvas size for the visual layout editor.
    """

    __tablename__ = "floor_plans"

    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    width = Column(Integer, nullable=False, default=800)
    height = Column(Integer, nullable=False, default=600)
    is_active = Column(Boolean, nullable=False, default=True)
    sort_order = Column(Integer, nullable=False, default=0)

    # Relationships
    sections = relationship("Section", back_populates="floor_plan", lazy="dynamic")
    tables = relationship("RestaurantTable", back_populates="floor_plan", lazy="dynamic")


class Section(BaseModel):
    """A grouping of tables within a floor plan (e.g. 'Window', 'Bar Area').

    Why sections?
    Staff can be assigned to specific sections, and the UI can filter/highlight
    tables by section for quicker visual identification.
    """

    __tablename__ = "sections"

    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    floor_plan_id = Column(
        UUID(as_uuid=True),
        ForeignKey("floor_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    color = Column(String(20), nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)

    # Relationships
    floor_plan = relationship("FloorPlan", back_populates="sections")
    tables = relationship("RestaurantTable", back_populates="section_ref", lazy="dynamic")


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
    # FK references added by migration 080
    floor_plan_id = Column(UUID(as_uuid=True), ForeignKey("floor_plans.id"), nullable=True, index=True)
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id"), nullable=True, index=True)

    # Relationships
    floor_plan = relationship("FloorPlan", back_populates="tables")
    section_ref = relationship("Section", back_populates="tables")

    def __repr__(self) -> str:
        return f"<RestaurantTable {self.table_number}>"


class Reservation(BaseModel):
    """Guest reservation for a restaurant table.

    Why a dedicated model?
    Reservations are future-dated bookings that must be queryable by date,
    status, and guest.  They live independently of orders — a reservation
    may be cancelled before any order is placed, or a walk-in may never
    have a reservation at all.
    """

    __tablename__ = "reservations"

    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    table_id = Column(UUID(as_uuid=True), ForeignKey("restaurant_tables.id"), nullable=True, index=True)
    guest_name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    party_size = Column(Integer, nullable=False)
    date_time = Column(DateTime(timezone=True), nullable=False, index=True)
    duration = Column(Integer, nullable=False, default=90)  # minutes
    status = Column(String(20), nullable=False, default=ReservationStatus.CONFIRMED.value)
    notes = Column(Text, nullable=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=True)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    table = relationship("RestaurantTable", lazy="joined")
    created_by = relationship("User", lazy="joined")
