"""Schemas for custom dashboards."""

from typing import Optional, List, Any
from pydantic import BaseModel, Field
from datetime import datetime


class DashboardCreate(BaseModel):
    """Schema for creating a dashboard."""

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class DashboardUpdate(BaseModel):
    """Schema for updating a dashboard."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    is_default: Optional[bool] = None
    layout: Optional[str] = None
    is_shared: Optional[bool] = None


class WidgetCreate(BaseModel):
    """Schema for creating a widget."""

    widget_type: str = Field(..., min_length=1, max_length=50)
    title: str = Field(..., min_length=1, max_length=255)
    config: Optional[dict] = None
    position_x: int = 0
    position_y: int = 0
    width: int = Field(4, ge=1, le=12)
    height: int = Field(3, ge=1)


class WidgetUpdate(BaseModel):
    """Schema for updating a widget."""

    title: Optional[str] = Field(None, min_length=1, max_length=255)
    config: Optional[dict] = None
    position_x: Optional[int] = None
    position_y: Optional[int] = None
    width: Optional[int] = Field(None, ge=1, le=12)
    height: Optional[int] = Field(None, ge=1)


class WidgetDataRequest(BaseModel):
    """Schema for requesting widget data."""

    widget_type: str
    config: Optional[dict] = None


class WidgetResponse(BaseModel):
    """Widget response schema."""

    model_config = {"from_attributes": True}

    id: str
    dashboard_id: str
    widget_type: str
    title: str
    config: Optional[dict] = None
    position_x: int
    position_y: int
    width: int
    height: int
    created_at: datetime
    updated_at: datetime


class DashboardResponse(BaseModel):
    """Dashboard response schema."""

    model_config = {"from_attributes": True}

    id: str
    business_id: str
    user_id: str
    name: str
    description: Optional[str] = None
    is_default: bool
    layout: Optional[str] = None
    is_shared: bool
    widgets: List[WidgetResponse] = []
    created_at: datetime
    updated_at: datetime


class DashboardListResponse(BaseModel):
    """Dashboard list response schema."""

    items: List[DashboardResponse]
    total: int


class WidgetDataResponse(BaseModel):
    """Response for widget data."""

    widget_type: str
    data: Any


# ── Template Schemas ─────────────────────────────────────────────────────────

class DashboardTemplateCreate(BaseModel):
    """Schema for creating a dashboard template."""

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    category: Optional[str] = Field(None, max_length=100)
    layout: dict = Field(default_factory=dict)
    widgets_config: List[dict] = Field(default_factory=list)
    thumbnail_url: Optional[str] = None


class DashboardTemplateUpdate(BaseModel):
    """Schema for updating a dashboard template."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    category: Optional[str] = None
    layout: Optional[dict] = None
    widgets_config: Optional[List[dict]] = None
    thumbnail_url: Optional[str] = None


class DashboardTemplateResponse(BaseModel):
    """Dashboard template response schema."""

    model_config = {"from_attributes": True}

    id: str
    business_id: Optional[str] = None
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    layout: dict
    widgets_config: list
    thumbnail_url: Optional[str] = None
    is_system: bool
    created_at: datetime
    updated_at: datetime


class DashboardTemplateListResponse(BaseModel):
    """Template list response."""

    items: List[DashboardTemplateResponse]
    total: int


# ── Share Schemas ────────────────────────────────────────────────────────────

class DashboardShareCreate(BaseModel):
    """Schema for sharing a dashboard with a user."""

    shared_with_user_id: str
    permission: str = Field("view", pattern="^(view|edit)$")


class DashboardShareResponse(BaseModel):
    """Dashboard share response schema."""

    model_config = {"from_attributes": True}

    id: str
    dashboard_id: str
    shared_with_user_id: str
    permission: str
    created_at: datetime


class DashboardShareListResponse(BaseModel):
    """Share list response."""

    items: List[DashboardShareResponse]
    total: int


# ── Export Schedule Schemas ──────────────────────────────────────────────────

class ExportScheduleCreate(BaseModel):
    """Schema for creating an export schedule."""

    format: str = Field("pdf", pattern="^(pdf|csv)$")
    frequency: str = Field("weekly", pattern="^(daily|weekly|monthly)$")
    recipients: List[str] = Field(default_factory=list)


class ExportScheduleUpdate(BaseModel):
    """Schema for updating an export schedule."""

    format: Optional[str] = Field(None, pattern="^(pdf|csv)$")
    frequency: Optional[str] = Field(None, pattern="^(daily|weekly|monthly)$")
    recipients: Optional[List[str]] = None
    is_active: Optional[bool] = None


class ExportScheduleResponse(BaseModel):
    """Export schedule response schema."""

    model_config = {"from_attributes": True}

    id: str
    dashboard_id: str
    user_id: str
    format: str
    frequency: str
    recipients: list
    is_active: bool
    last_sent_at: Optional[datetime] = None
    next_send_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
