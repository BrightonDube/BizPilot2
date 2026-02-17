"""Cash register API endpoints."""

import math
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_active_user, get_current_business_id
from app.core.database import get_sync_db
from app.models.cash_register import RegisterStatus
from app.models.user import User
from app.schemas.cash_register import (
    CashMovementRequest,
    CashMovementResponse,
    CloseSessionRequest,
    OpenSessionRequest,
    RecordSaleRequest,
    RegisterCreate,
    RegisterReport,
    RegisterResponse,
    RegisterUpdate,
    SessionListResponse,
    SessionResponse,
)
from app.services.cash_register_service import CashRegisterService

router = APIRouter(prefix="/registers", tags=["Cash Registers"])


# ---- Register CRUD ----


@router.post("", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def create_register(
    data: RegisterCreate,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Create a new cash register."""
    service = CashRegisterService(db)
    register = service.create_register(
        business_id=business_id,
        name=data.name,
        location_id=str(data.location_id) if data.location_id else None,
    )
    return register


@router.get("", response_model=list[RegisterResponse])
async def list_registers(
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """List all cash registers."""
    service = CashRegisterService(db)
    return service.list_registers(business_id)


@router.put("/{register_id}", response_model=RegisterResponse)
async def update_register(
    register_id: str,
    data: RegisterUpdate,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Update a cash register."""
    service = CashRegisterService(db)
    try:
        updates = data.model_dump(exclude_unset=True)
        if "location_id" in updates and updates["location_id"] is not None:
            updates["location_id"] = str(updates["location_id"])
        register = service.update_register(register_id, business_id, **updates)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return register


@router.delete("/{register_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_register(
    register_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Soft delete a cash register."""
    service = CashRegisterService(db)
    try:
        service.delete_register(register_id, business_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ---- Session operations ----


@router.post("/{register_id}/open", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def open_session(
    register_id: str,
    data: OpenSessionRequest,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Open a new register session."""
    service = CashRegisterService(db)
    try:
        session = service.open_session(
            register_id=register_id,
            business_id=business_id,
            opened_by=str(current_user.id),
            opening_float=data.opening_float,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return session


@router.get("/{register_id}/active", response_model=SessionResponse)
async def get_active_session(
    register_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get the active session for a register."""
    service = CashRegisterService(db)
    session = service.get_active_session(register_id, business_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active session")
    return session


@router.post("/sessions/{session_id}/close", response_model=SessionResponse)
async def close_session(
    session_id: str,
    data: CloseSessionRequest,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Close a register session."""
    service = CashRegisterService(db)
    try:
        session = service.close_session(
            session_id=session_id,
            business_id=business_id,
            closed_by=str(current_user.id),
            actual_cash=data.actual_cash,
            notes=data.notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return session


@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get a register session with movements."""
    service = CashRegisterService(db)
    session = service.get_session(session_id, business_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return session


@router.get("/sessions", response_model=SessionListResponse)
async def list_sessions(
    register_id: Optional[str] = Query(None),
    session_status: Optional[RegisterStatus] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """List register sessions with filtering."""
    service = CashRegisterService(db)
    items, total = service.list_sessions(
        business_id=business_id,
        register_id=register_id,
        status=session_status,
        page=page,
        per_page=per_page,
    )
    return SessionListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.post("/sessions/{session_id}/movement", response_model=CashMovementResponse, status_code=status.HTTP_201_CREATED)
async def add_cash_movement(
    session_id: str,
    data: CashMovementRequest,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Add a cash movement to a session."""
    service = CashRegisterService(db)
    try:
        movement = service.add_cash_movement(
            session_id=session_id,
            business_id=business_id,
            movement_type=data.movement_type,
            amount=data.amount,
            reason=data.reason,
            performed_by=str(current_user.id),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return movement


@router.post("/sessions/{session_id}/sale", response_model=SessionResponse)
async def record_sale(
    session_id: str,
    data: RecordSaleRequest,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Record a sale in the session."""
    service = CashRegisterService(db)
    try:
        session = service.record_sale(
            session_id=session_id,
            amount=data.amount,
            payment_method=data.payment_method,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return session


@router.get("/report", response_model=RegisterReport)
async def get_register_report(
    register_id: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get register report with totals and discrepancies."""
    service = CashRegisterService(db)
    return service.get_register_report(
        business_id=business_id,
        register_id=register_id,
        start_date=start_date,
        end_date=end_date,
    )
