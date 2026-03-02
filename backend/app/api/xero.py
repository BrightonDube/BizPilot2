"""API endpoints for Xero accounting integration."""

import math
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_current_business_id
from app.core.database import get_sync_db
from app.schemas.xero import (
    XeroConnectionCreate,
    XeroConnectionUpdate,
    XeroConnectionResponse,
    XeroSyncLogListResponse,
)
from app.services.xero_service import XeroService

router = APIRouter(prefix="/xero", tags=["Xero Integration"])


@router.get("/connection", response_model=XeroConnectionResponse)
def get_connection(
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Get the Xero connection for the current business."""
    svc = XeroService(db)
    conn = svc.get_connection(UUID(business_id))
    if not conn:
        raise HTTPException(status_code=404, detail="Xero connection not found")
    return conn


@router.post("/connection", response_model=XeroConnectionResponse, status_code=201)
def create_connection(
    data: XeroConnectionCreate,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Create a Xero connection."""
    svc = XeroService(db)
    return svc.create_connection(
        business_id=UUID(business_id),
        tenant_id=data.tenant_id,
        config=data.config,
    )


@router.put("/connection", response_model=XeroConnectionResponse)
def update_connection(
    data: XeroConnectionUpdate,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Update the Xero connection."""
    svc = XeroService(db)
    conn = svc.update_connection(
        UUID(business_id), **data.model_dump(exclude_unset=True)
    )
    if not conn:
        raise HTTPException(status_code=404, detail="Xero connection not found")
    return conn


@router.delete("/connection", status_code=204)
def delete_connection(
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Delete the Xero connection."""
    svc = XeroService(db)
    if not svc.delete_connection(UUID(business_id)):
        raise HTTPException(status_code=404, detail="Xero connection not found")


@router.get("/sync-logs", response_model=XeroSyncLogListResponse)
def list_sync_logs(
    entity_type: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """List Xero sync log entries."""
    svc = XeroService(db)
    items, total = svc.list_sync_logs(
        UUID(business_id), entity_type, status, page, per_page
    )
    pages = max(1, math.ceil(total / per_page))
    return XeroSyncLogListResponse(
        items=items, total=total, page=page, per_page=per_page, pages=pages
    )
