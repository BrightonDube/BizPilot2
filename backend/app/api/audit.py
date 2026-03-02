"""Audit log API endpoints."""

import math
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel as PydanticBase, ConfigDict

from app.api.deps import get_current_active_user, get_current_business_id
from app.core.database import get_sync_db
from app.models.audit_log import AuditAction
from app.models.user import User
from app.services.audit_service import AuditService

router = APIRouter(prefix="/audit", tags=["Audit"])


# ---------- Schemas ----------


class AuditLogResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    business_id: str
    user_id: Optional[str] = None
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    description: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    metadata_json: Optional[str] = None
    created_at: datetime


class AuditLogListResponse(PydanticBase):
    items: List[AuditLogResponse]
    total: int
    page: int
    per_page: int
    pages: int


class ActivitySummaryResponse(PydanticBase):
    by_action: dict
    by_user: dict
    by_resource: dict
    total: int


class CsvRowResponse(PydanticBase):
    id: str
    user_id: str
    action: str
    resource_type: str
    resource_id: str
    description: str
    ip_address: str
    created_at: str


# ---------- Endpoints ----------


@router.get("/activity", response_model=AuditLogListResponse)
async def list_activity(
    user_id: Optional[str] = None,
    action: Optional[AuditAction] = None,
    resource_type: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List user activity with filtering and pagination."""
    service = AuditService(db)
    items, total = service.get_user_activity(
        business_id=business_id,
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        start_date=start_date,
        end_date=end_date,
        page=page,
        per_page=per_page,
    )
    return AuditLogListResponse(
        items=[AuditLogResponse.model_validate(i) for i in items],
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, math.ceil(total / per_page)),
    )


@router.get("/login-history", response_model=AuditLogListResponse)
async def login_history(
    user_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get login/logout history."""
    service = AuditService(db)
    items, total = service.get_login_history(
        business_id=business_id,
        user_id=user_id,
        page=page,
        per_page=per_page,
    )
    return AuditLogListResponse(
        items=[AuditLogResponse.model_validate(i) for i in items],
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, math.ceil(total / per_page)),
    )


@router.get("/summary", response_model=ActivitySummaryResponse)
async def activity_summary(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get activity summary grouped by action, user, and resource."""
    service = AuditService(db)
    return service.get_activity_summary(
        business_id=business_id,
        start_date=start_date,
        end_date=end_date,
    )


@router.get("/export", response_model=List[CsvRowResponse])
async def export_activity(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Export activity log data in CSV-ready format."""
    service = AuditService(db)
    return service.export_activity_csv(
        business_id=business_id,
        start_date=start_date,
        end_date=end_date,
    )
