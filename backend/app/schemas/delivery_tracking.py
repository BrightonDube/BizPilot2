"""Pydantic schemas for delivery tracking, driver shifts, and proof-of-delivery.

Extends the base delivery schemas with operational/real-time concerns.
"""

from datetime import date, time, datetime
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Driver Shift schemas
# ---------------------------------------------------------------------------


class DriverShiftCreate(BaseModel):
    """Create a new scheduled shift for a driver."""

    driver_id: UUID
    shift_date: date
    start_time: time
    end_time: time


class DriverShiftUpdate(BaseModel):
    """Update an existing driver shift."""

    shift_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    status: Optional[str] = None


class DriverShiftResponse(BaseModel):
    """Response schema for a driver shift."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    driver_id: UUID
    shift_date: date
    start_time: time
    end_time: time
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    status: str
    created_at: datetime
    updated_at: datetime


class DriverShiftListResponse(BaseModel):
    """Paginated list of driver shifts."""

    items: list[DriverShiftResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ---------------------------------------------------------------------------
# Delivery Tracking schemas
# ---------------------------------------------------------------------------


class DeliveryTrackingCreate(BaseModel):
    """Record a new tracking update for a delivery."""

    delivery_id: UUID
    status: str
    location: Optional[dict[str, Any]] = None
    eta_minutes: Optional[int] = None
    notes: Optional[str] = None


class DeliveryTrackingResponse(BaseModel):
    """Response schema for a tracking entry."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    delivery_id: UUID
    status: str
    location: Optional[dict[str, Any]] = None
    eta_minutes: Optional[int] = None
    notes: Optional[str] = None
    recorded_at: datetime


# ---------------------------------------------------------------------------
# Delivery Proof schemas
# ---------------------------------------------------------------------------


class DeliveryProofCreate(BaseModel):
    """Record proof of delivery."""

    delivery_id: UUID
    proof_type: str = Field(..., pattern="^(signature|photo|both)$")
    signature_url: Optional[str] = None
    photo_url: Optional[str] = None
    recipient_name: Optional[str] = None


class DeliveryProofResponse(BaseModel):
    """Response schema for delivery proof."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    delivery_id: UUID
    proof_type: str
    signature_url: Optional[str] = None
    photo_url: Optional[str] = None
    recipient_name: Optional[str] = None
    created_at: datetime
