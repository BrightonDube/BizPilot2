"""Pydantic schemas for custom report builder."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


AVAILABLE_METRICS = [
    "total_sales", "order_count", "discount_amount",
    "hours_worked", "void_count", "refund_count", "avg_order_value",
]

AVAILABLE_GROUP_BY = ["user", "department", "day", "week", "month"]


class ReportTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    metrics: List[str] = Field(..., min_length=1)
    filters: Dict[str, Any] = Field(default_factory=dict)
    group_by: List[str] = Field(default_factory=list)
    sort_by: Optional[str] = None
    sort_direction: str = Field("desc", pattern="^(asc|desc)$")
    is_scheduled: bool = False
    schedule_cron: Optional[str] = None
    schedule_recipients: Optional[List[str]] = None
    is_public: bool = False


class ReportTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    metrics: Optional[List[str]] = None
    filters: Optional[Dict[str, Any]] = None
    group_by: Optional[List[str]] = None
    sort_by: Optional[str] = None
    sort_direction: Optional[str] = None
    is_scheduled: Optional[bool] = None
    schedule_cron: Optional[str] = None
    schedule_recipients: Optional[List[str]] = None
    is_public: Optional[bool] = None


class ReportTemplateResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    report_type: str
    metrics: List[str]
    filters: Dict[str, Any]
    group_by: List[str]
    sort_by: Optional[str] = None
    sort_direction: Optional[str] = None
    is_scheduled: bool
    schedule_cron: Optional[str] = None
    schedule_recipients: Optional[List[str]] = None
    is_public: bool
    created_by_name: str
    created_at: datetime


class ReportTemplateListResponse(BaseModel):
    items: List[ReportTemplateResponse]
    total: int


class CustomReportRequest(BaseModel):
    metrics: List[str] = Field(..., min_length=1)
    filters: Dict[str, Any] = Field(default_factory=dict)
    group_by: List[str] = Field(default_factory=list)
    sort_by: Optional[str] = None
    sort_direction: str = "desc"


class CustomReportResponse(BaseModel):
    metrics: List[str]
    filters: Dict[str, Any]
    group_by: List[str]
    total_staff: int
    data: List[Dict[str, Any]]
