"""Pydantic schemas for reservations and floor plans.

Why separate schemas for create, update, and response?
Each operation needs different validation rules:
- Create: requires all mandatory fields, no id
- Update: all fields optional (partial updates)
- Response: includes computed/server fields like id, timestamps
"""

from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


# ---------------------------------------------------------------------------
# Floor Plan Schemas
# ---------------------------------------------------------------------------


class FloorPlanCreate(BaseModel):
    """Schema for creating a floor plan."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    width: int = Field(800, ge=100, le=5000)
    height: int = Field(600, ge=100, le=5000)
    sort_order: int = 0


class FloorPlanUpdate(BaseModel):
    """Schema for updating a floor plan."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    width: Optional[int] = Field(None, ge=100, le=5000)
    height: Optional[int] = Field(None, ge=100, le=5000)
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class FloorPlanResponse(BaseModel):
    """Schema for floor plan response."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    business_id: str
    name: str
    description: Optional[str] = None
    width: int
    height: int
    is_active: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime


class FloorPlanListResponse(BaseModel):
    """Paginated floor plan list."""
    items: List[FloorPlanResponse]
    total: int


# ---------------------------------------------------------------------------
# Section Schemas
# ---------------------------------------------------------------------------


class SectionCreate(BaseModel):
    """Schema for creating a section within a floor plan."""
    floor_plan_id: str
    name: str = Field(..., min_length=1, max_length=255)
    color: Optional[str] = Field(None, max_length=20)
    sort_order: int = 0


class SectionResponse(BaseModel):
    """Schema for section response."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    business_id: str
    floor_plan_id: str
    name: str
    color: Optional[str] = None
    sort_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Reservation Schemas
# ---------------------------------------------------------------------------


class ReservationCreate(BaseModel):
    """Schema for creating a reservation."""
    guest_name: str = Field(..., min_length=1, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=255)
    party_size: int = Field(..., ge=1, le=100)
    date_time: datetime
    duration: int = Field(90, ge=15, le=480)  # 15 min to 8 hours
    table_id: Optional[str] = None
    notes: Optional[str] = None
    customer_id: Optional[str] = None


class ReservationUpdate(BaseModel):
    """Schema for updating a reservation."""
    guest_name: Optional[str] = Field(None, min_length=1, max_length=255)
    phone: Optional[str] = None
    email: Optional[str] = None
    party_size: Optional[int] = Field(None, ge=1, le=100)
    date_time: Optional[datetime] = None
    duration: Optional[int] = Field(None, ge=15, le=480)
    table_id: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class ReservationResponse(BaseModel):
    """Schema for reservation response."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    business_id: str
    table_id: Optional[str] = None
    guest_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    party_size: int
    date_time: datetime
    duration: int
    status: str
    notes: Optional[str] = None
    customer_id: Optional[str] = None
    created_by_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ReservationListResponse(BaseModel):
    """Paginated reservation list."""
    items: List[ReservationResponse]
    total: int
    page: int
    per_page: int
    pages: int
