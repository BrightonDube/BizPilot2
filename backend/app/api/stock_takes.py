"""Stock take API endpoints."""

import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel as PydanticBase, ConfigDict
from decimal import Decimal
from datetime import datetime
from uuid import UUID

from app.api.deps import get_current_active_user, get_current_business_id
from app.core.database import get_sync_db
from app.models.stock_take import StockTakeStatus
from app.models.user import User
from app.services.stock_take_service import StockTakeService


# ---- Schemas ----


class SessionCreate(PydanticBase):
    notes: Optional[str] = None


class SessionResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    reference: str
    status: StockTakeStatus
    started_by_id: UUID
    completed_by_id: Optional[UUID] = None
    notes: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class SessionListResponse(PydanticBase):
    items: list[SessionResponse]
    total: int
    page: int
    per_page: int
    pages: int


class CountRecord(PydanticBase):
    product_id: UUID
    counted_quantity: int
    notes: Optional[str] = None


class CountResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: UUID
    product_id: UUID
    business_id: UUID
    system_quantity: int
    counted_quantity: Optional[int] = None
    variance: Optional[int] = None
    unit_cost: Optional[Decimal] = None
    variance_value: Optional[Decimal] = None
    counted_by_id: Optional[UUID] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class VarianceSummaryResponse(PydanticBase):
    session_id: str
    reference: str
    status: str
    total_items: int
    items_with_variance: int
    total_variance_value: Decimal


# ---- Router ----

router = APIRouter(prefix="/stock-takes", tags=["Stock Takes"])


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    data: SessionCreate,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Create a new stock take session."""
    service = StockTakeService(db)
    session = service.create_session(
        business_id=business_id,
        user_id=str(current_user.id),
        notes=data.notes,
    )
    return session


@router.get("", response_model=SessionListResponse)
async def list_sessions(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    session_status: Optional[StockTakeStatus] = Query(None, alias="status"),
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """List stock take sessions."""
    service = StockTakeService(db)
    items, total = service.list_sessions(business_id, session_status, page, per_page)
    return SessionListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get a stock take session by ID."""
    service = StockTakeService(db)
    session = service.get_session(session_id, business_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock take session not found")
    return session


@router.post("/{session_id}/start", response_model=SessionResponse)
async def start_session(
    session_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Start a stock take session and populate counts from inventory."""
    service = StockTakeService(db)
    try:
        session = service.start_session(session_id, business_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return session


@router.get("/{session_id}/counts", response_model=list[CountResponse])
async def get_counts(
    session_id: str,
    variance_only: bool = Query(False),
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get stock counts for a session."""
    service = StockTakeService(db)
    session = service.get_session(session_id, business_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock take session not found")
    return service.get_counts(session_id, business_id, variance_only)


@router.post("/{session_id}/counts", response_model=CountResponse)
async def record_count(
    session_id: str,
    data: CountRecord,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Record a physical count for a product."""
    service = StockTakeService(db)
    try:
        count = service.record_count(
            session_id=session_id,
            product_id=str(data.product_id),
            business_id=business_id,
            counted_quantity=data.counted_quantity,
            user_id=str(current_user.id),
            notes=data.notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return count


@router.post("/{session_id}/complete", response_model=SessionResponse)
async def complete_session(
    session_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Complete a stock take session, apply adjustments to inventory."""
    service = StockTakeService(db)
    try:
        session = service.complete_session(session_id, business_id, str(current_user.id))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return session


@router.get("/{session_id}/variance-summary", response_model=VarianceSummaryResponse)
async def get_variance_summary(
    session_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get variance summary for a stock take session."""
    service = StockTakeService(db)
    try:
        summary = service.get_variance_summary(session_id, business_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return summary


@router.delete("/{session_id}", response_model=SessionResponse)
async def cancel_session(
    session_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Cancel a stock take session."""
    service = StockTakeService(db)
    try:
        session = service.cancel_session(session_id, business_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return session
