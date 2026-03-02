"""API endpoints for WooCommerce e-commerce integration."""

import math
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_current_business_id
from app.core.database import get_sync_db
from app.schemas.woocommerce import (
    WooConnectionCreate,
    WooConnectionUpdate,
    WooConnectionResponse,
    WooSyncMapListResponse,
)
from app.services.woocommerce_service import WooCommerceService

router = APIRouter(prefix="/woocommerce", tags=["WooCommerce Integration"])


@router.get("/connection", response_model=WooConnectionResponse)
def get_connection(
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Get the WooCommerce connection for the current business."""
    svc = WooCommerceService(db)
    conn = svc.get_connection(UUID(business_id))
    if not conn:
        raise HTTPException(status_code=404, detail="WooCommerce connection not found")
    return conn


@router.post("/connection", response_model=WooConnectionResponse, status_code=201)
def create_connection(
    data: WooConnectionCreate,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Create a WooCommerce connection."""
    svc = WooCommerceService(db)
    return svc.create_connection(
        business_id=UUID(business_id),
        store_url=data.store_url,
        config=data.config,
    )


@router.put("/connection", response_model=WooConnectionResponse)
def update_connection(
    data: WooConnectionUpdate,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Update the WooCommerce connection."""
    svc = WooCommerceService(db)
    conn = svc.update_connection(
        UUID(business_id), **data.model_dump(exclude_unset=True)
    )
    if not conn:
        raise HTTPException(status_code=404, detail="WooCommerce connection not found")
    return conn


@router.delete("/connection", status_code=204)
def delete_connection(
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Delete the WooCommerce connection."""
    svc = WooCommerceService(db)
    if not svc.delete_connection(UUID(business_id)):
        raise HTTPException(status_code=404, detail="WooCommerce connection not found")


@router.get("/sync-maps", response_model=WooSyncMapListResponse)
def list_sync_maps(
    entity_type: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """List WooCommerce sync map entries."""
    svc = WooCommerceService(db)
    items, total = svc.list_sync_maps(
        UUID(business_id), entity_type, status, page, per_page
    )
    pages = max(1, math.ceil(total / per_page))
    return WooSyncMapListResponse(
        items=items, total=total, page=page, per_page=per_page, pages=pages
    )
