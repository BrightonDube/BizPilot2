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
