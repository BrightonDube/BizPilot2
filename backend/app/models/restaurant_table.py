"""Restaurant table and floor plan models for table management."""

import enum
from sqlalchemy import Column, String, Integer, Enum as SQLEnum, Numeric, Boolean, Text, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel, utc_now


class TableStatus(str, enum.Enum):
    """Table status."""
    AVAILABLE = "available"
    OCCUPIED = "occupied"
    RESERVED = "reserved"
    DIRTY = "dirty"
    BLOCKED = "blocked"


class ReservationStatus(str, enum.Enum):
    """Reservation status."""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    ARRIVED = "seated"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class FloorPlan(BaseModel):
    """A named floor/area layout (e.g. 'Main Dining', 'Patio')."""

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
    width_units = Column(Integer, nullable=False, default=100)
    height_units = Column(Integer, nullable=False, default=100)
    is_active = Column(Boolean, nullable=False, default=True)
    sort_order = Column(Integer, nullable=False, default=0)

    # Relationships
    sections = relationship("Section", back_populates="floor_plan", lazy="dynamic")
    tables = relationship("RestaurantTable", back_populates="floor_plan", lazy="dynamic")
    floor_plan_tables = relationship("FloorPlanTable", back_populates="floor_plan", cascade="all, delete-orphan")
    section_assignments = relationship("FloorPlanSectionAssignment", back_populates="floor_plan", cascade="all, delete-orphan")


class FloorPlanTable(BaseModel):
    """A table positioned on a floor plan."""

    __tablename__ = "floor_plan_tables"

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
    name = Column(String(50), nullable=False)
    section = Column(String(50), nullable=True)
    x_position = Column(Numeric(5, 2), nullable=False)
    y_position = Column(Numeric(5, 2), nullable=False)
    width = Column(Numeric(5, 2), nullable=False, default=10.00)
    height = Column(Numeric(5, 2), nullable=False, default=10.00)
    capacity = Column(Integer, nullable=False, default=4)
    shape = Column(String(20), nullable=False, default="rectangle")
    is_active = Column(Boolean, nullable=False, default=True)

    # Relationships
    floor_plan = relationship("FloorPlan", back_populates="floor_plan_tables")


class FloorPlanSectionAssignment(BaseModel):
    """Assigns a waiter to a floor section."""

    __tablename__ = "floor_plan_section_assignments"

    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    section_name = Column(String(50), nullable=False)
    waiter_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    floor_plan_id = Column(
        UUID(as_uuid=True),
        ForeignKey("floor_plans.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Relationships
    floor_plan = relationship("FloorPlan", back_populates="section_assignments")
    waiter = relationship("User")


class Section(BaseModel):
    """A grouping of tables within a floor plan (e.g. 'Window', 'Bar Area')."""

    __tablename__ = "sections"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    floor_plan_id = Column(UUID(as_uuid=True), ForeignKey("floor_plans.id"), nullable=False)
    name = Column(String(100), nullable=False)
    color = Column(String(7), nullable=False, default="#3b82f6")
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)

    floor_plan = relationship("FloorPlan", back_populates="sections")
    tables = relationship("RestaurantTable", back_populates="section_obj")


class RestaurantTable(BaseModel):
    """A physical or virtual table in the restaurant."""

    __tablename__ = "restaurant_tables"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    table_number = Column(String(20), nullable=False)
    capacity = Column(Integer, nullable=True)
    status = Column(SQLEnum(TableStatus, name='tablestatus'), default=TableStatus.AVAILABLE)
    section = Column(String(50), nullable=True)
    position_x = Column(Numeric(8, 2), nullable=True)
    position_y = Column(Numeric(8, 2), nullable=True)
    is_active = Column(Boolean, default=True)
    floor_plan_id = Column(UUID(as_uuid=True), ForeignKey("floor_plans.id"), nullable=True)
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id"), nullable=True)

    floor_plan = relationship("FloorPlan", back_populates="tables")
    section_obj = relationship("Section", back_populates="tables")


class Reservation(BaseModel):
    """Table reservation."""

    __tablename__ = "reservations"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    table_id = Column(UUID(as_uuid=True), ForeignKey("restaurant_tables.id"), nullable=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=True)
    customer_name = Column(String(255), nullable=False)
    customer_phone = Column(String(50), nullable=True)
    customer_email = Column(String(255), nullable=True)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    party_size = Column(Integer, nullable=False, default=2)
    status = Column(String(30), nullable=False, default="confirmed")
    notes = Column(Text, nullable=True)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    table = relationship("RestaurantTable", lazy="joined")
    created_by = relationship("User", lazy="joined")
