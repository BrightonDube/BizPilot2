"""Inventory period management API endpoints.

Handles month-end period lifecycle, snapshots, ABC classification,
and stock count history.
"""

import math
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel as PydanticBase, Field

from app.core.database import get_sync_db
from app.api.deps import get_current_active_user, get_current_business_id
from app.models.user import User
from app.services.inventory_period_service import InventoryPeriodService


router = APIRouter(prefix="/inventory-periods", tags=["Inventory Periods"])


# --- Schemas (inline — small surface) ---

class PeriodResponse(PydanticBase):
    id: str
    business_id: str
    period_year: int
    period_month: int
    status: str
    opening_value: Optional[Decimal] = None
    closing_value: Optional[Decimal] = None
    cogs: Optional[Decimal] = None
    adjustments_value: Optional[Decimal] = None
    closed_at: Optional[str] = None
    reopened_at: Optional[str] = None
    created_at: str

    model_config = {"from_attributes": True}


class PeriodListResponse(PydanticBase):
    items: list[PeriodResponse]
    total: int
    page: int
    per_page: int
    pages: int


class ClosePeriodRequest(PydanticBase):
    closing_value: Decimal
    cogs: Decimal


class SnapshotResponse(PydanticBase):
    id: str
    period_id: str
    product_id: str
    quantity: int
    unit_cost: Decimal
    total_value: Decimal
    created_at: str

    model_config = {"from_attributes": True}


class SnapshotListResponse(PydanticBase):
    items: list[SnapshotResponse]
    total: int
    page: int
    per_page: int
    pages: int


class ClassificationResponse(PydanticBase):
    id: str
    business_id: str
    product_id: str
    classification: str
    annual_value: Decimal
    count_frequency_days: int
    last_counted_at: Optional[str] = None
    created_at: str

    model_config = {"from_attributes": True}


class ClassificationListResponse(PydanticBase):
    items: list[ClassificationResponse]
    total: int
    page: int
    per_page: int
    pages: int


class CountHistoryResponse(PydanticBase):
    id: str
    count_id: str
    counted_quantity: int
    counted_by: Optional[str] = None
    counted_at: str
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


# --- Period Endpoints ---

@router.get("", response_model=PeriodListResponse)
async def list_periods(
    page: int = Query(1, ge=1),
    per_page: int = Query(12, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """List inventory periods for the current business."""
    service = InventoryPeriodService(db)
    items, total = service.list_periods(business_id, page=page, per_page=per_page)
    pages = max(1, math.ceil(total / per_page))
    return PeriodListResponse(
        items=[PeriodResponse.model_validate(i) for i in items],
        total=total, page=page, per_page=per_page, pages=pages,
    )


@router.post("/{year}/{month}", response_model=PeriodResponse, status_code=status.HTTP_201_CREATED)
async def get_or_create_period(
    year: int,
    month: int,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get or create an inventory period."""
    service = InventoryPeriodService(db)
    period = service.get_or_create_period(business_id, year, month)
    return PeriodResponse.model_validate(period)


@router.patch("/{period_id}/close", response_model=PeriodResponse)
async def close_period(
    period_id: str,
    payload: ClosePeriodRequest,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Close an inventory period, locking it for edits."""
    service = InventoryPeriodService(db)
    period = service.close_period(
        period_id, business_id,
        closing_value=payload.closing_value,
        cogs=payload.cogs,
        closed_by=str(current_user.id),
    )
    if not period:
        raise HTTPException(status_code=404, detail="Period not found.")
    return PeriodResponse.model_validate(period)


@router.patch("/{period_id}/reopen", response_model=PeriodResponse)
async def reopen_period(
    period_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Reopen a closed period for corrections."""
    service = InventoryPeriodService(db)
    period = service.reopen_period(period_id, business_id, str(current_user.id))
    if not period:
        raise HTTPException(status_code=404, detail="Period not found or not closed.")
    return PeriodResponse.model_validate(period)


# --- Snapshot Endpoints ---

@router.get("/{period_id}/snapshots", response_model=SnapshotListResponse)
async def list_snapshots(
    period_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """List product snapshots for a period."""
    service = InventoryPeriodService(db)
    items, total = service.list_snapshots(period_id, page=page, per_page=per_page)
    pages = max(1, math.ceil(total / per_page))
    return SnapshotListResponse(
        items=[SnapshotResponse.model_validate(i) for i in items],
        total=total, page=page, per_page=per_page, pages=pages,
    )


# --- ABC Classification Endpoints ---

@router.get("/abc-classifications", response_model=ClassificationListResponse)
async def list_classifications(
    classification: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """List ABC classifications, optionally filtered by class (A/B/C)."""
    service = InventoryPeriodService(db)
    items, total = service.list_classifications(
        business_id, classification=classification, page=page, per_page=per_page,
    )
    pages = max(1, math.ceil(total / per_page))
    return ClassificationListResponse(
        items=[ClassificationResponse.model_validate(i) for i in items],
        total=total, page=page, per_page=per_page, pages=pages,
    )


# --- Count History Endpoints ---

@router.get("/count-history/{count_id}", response_model=list[CountHistoryResponse])
async def get_count_history(
    count_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get all recount attempts for a specific stock count."""
    service = InventoryPeriodService(db)
    items = service.get_count_history(count_id)
    return [CountHistoryResponse.model_validate(i) for i in items]
