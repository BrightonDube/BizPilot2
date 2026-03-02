"""Pydantic schemas for customer-facing display devices and configuration."""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Customer Display schemas
# ---------------------------------------------------------------------------


class CustomerDisplayCreate(BaseModel):
    """Register a new customer-facing display."""

    name: str = Field(..., max_length=100)
    display_type: str = Field(..., description="tablet | monitor | pole_display | web")
    terminal_id: Optional[str] = None


class CustomerDisplayUpdate(BaseModel):
    """Update a registered display."""

    name: Optional[str] = None
    display_type: Optional[str] = None
    terminal_id: Optional[str] = None
    status: Optional[str] = None


class CustomerDisplayResponse(BaseModel):
    """Response schema for a customer display."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    name: str
    display_type: str
    terminal_id: Optional[str] = None
    status: str
    last_seen_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class CustomerDisplayListResponse(BaseModel):
    """Paginated list of customer displays."""

    items: list[CustomerDisplayResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ---------------------------------------------------------------------------
# Display Config schemas
# ---------------------------------------------------------------------------


class DisplayConfigCreate(BaseModel):
    """Create display configuration (1-to-1 with a display)."""

    display_id: UUID
    layout: str = "standard"
    orientation: str = "landscape"
    theme: Optional[dict[str, Any]] = None
    features: Optional[dict[str, Any]] = None
    language: str = "en"


class DisplayConfigUpdate(BaseModel):
    """Update display configuration."""

    layout: Optional[str] = None
    orientation: Optional[str] = None
    theme: Optional[dict[str, Any]] = None
    features: Optional[dict[str, Any]] = None
    language: Optional[str] = None


class DisplayConfigResponse(BaseModel):
    """Response schema for display configuration."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    display_id: UUID
    layout: str
    orientation: str
    theme: Optional[dict[str, Any]] = None
    features: Optional[dict[str, Any]] = None
    language: str
    created_at: datetime
    updated_at: datetime
