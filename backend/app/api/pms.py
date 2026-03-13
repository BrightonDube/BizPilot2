"""API endpoints for PMS (Property Management System) integration.

Provides connection management, charge posting, guest search,
reconciliation, and audit log access.
"""

import math
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_current_business_id
from app.core.database import get_sync_db
from app.schemas.pms import (
    PMSConnectionCreate,
    PMSConnectionUpdate,
    PMSConnectionResponse,
    PMSConnectionListResponse,
    PMSChargeCreate,
    PMSChargeResponse,
    PMSChargeListResponse,
    PMSChargeReversalCreate,
    PMSChargeReversalResponse,
    PMSGuestListResponse,
    PMSReconciliationStartRequest,
    PMSReconciliationSessionResponse,
    PMSReconciliationResolveRequest,
    PMSReconciliationItemResponse,
    PMSAuditLogListResponse,
)
from app.services.pms_service import PMSService

router = APIRouter(prefix="/pms", tags=["PMS Integration"])


# ---------------------------------------------------------------------------
# Connections
# ---------------------------------------------------------------------------


@router.get("/connections", response_model=PMSConnectionListResponse)
def list_connections(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """List PMS connections for the current business."""
    svc = PMSService(db)
    items, total = svc.list_connections(UUID(business_id), page, per_page)
    pages = max(1, math.ceil(total / per_page))
    return PMSConnectionListResponse(
        items=items, total=total, page=page, per_page=per_page, pages=pages
    )


@router.post("/connections", response_model=PMSConnectionResponse, status_code=201)
def create_connection(
    data: PMSConnectionCreate,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Create a new PMS connection."""
    svc = PMSService(db)
    return svc.create_connection(
        business_id=UUID(business_id),
        adapter_type=data.adapter_type,
        connection_name=data.connection_name,
        host_url=data.host_url,
        config=data.config,
    )


@router.get("/connections/{connection_id}", response_model=PMSConnectionResponse)
def get_connection(
    connection_id: UUID,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Get a PMS connection by ID."""
    svc = PMSService(db)
    conn = svc.get_connection(UUID(business_id), connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    return conn


@router.put("/connections/{connection_id}", response_model=PMSConnectionResponse)
def update_connection(
    connection_id: UUID,
    data: PMSConnectionUpdate,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Update a PMS connection."""
    svc = PMSService(db)
    conn = svc.update_connection(
        UUID(business_id),
        connection_id,
        **data.model_dump(exclude_unset=True),
    )
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    return conn


@router.delete("/connections/{connection_id}", status_code=204)
def delete_connection(
    connection_id: UUID,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Delete a PMS connection."""
    svc = PMSService(db)
    if not svc.delete_connection(UUID(business_id), connection_id):
        raise HTTPException(status_code=404, detail="Connection not found")


# ---------------------------------------------------------------------------
# Charges
# ---------------------------------------------------------------------------


@router.get("/charges", response_model=PMSChargeListResponse)
def list_charges(
    connection_id: Optional[UUID] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """List PMS charges with optional filters."""
    svc = PMSService(db)
    items, total = svc.list_charges(
        UUID(business_id), connection_id, status, page, per_page
    )
    pages = max(1, math.ceil(total / per_page))
    return PMSChargeListResponse(
        items=items, total=total, page=page, per_page=per_page, pages=pages
    )


@router.post("/charges", response_model=PMSChargeResponse, status_code=201)
def create_charge(
    data: PMSChargeCreate,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    user=Depends(get_current_active_user),
):
    """Post a charge to a guest folio."""
    svc = PMSService(db)
    return svc.create_charge(
        business_id=UUID(business_id),
        connection_id=data.connection_id,
        room_number=data.room_number,
        amount=data.amount,
        currency=data.currency,
        guest_name=data.guest_name,
        folio_number=data.folio_number,
        description=data.description,
        order_id=data.order_id,
        user_id=user.id if hasattr(user, "id") else None,
    )


@router.get("/charges/{charge_id}", response_model=PMSChargeResponse)
def get_charge(
    charge_id: UUID,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Get a charge by ID."""
    svc = PMSService(db)
    charge = svc.get_charge(UUID(business_id), charge_id)
    if not charge:
        raise HTTPException(status_code=404, detail="Charge not found")
    return charge


# ---------------------------------------------------------------------------
# Reversals
# ---------------------------------------------------------------------------


@router.post("/reversals", response_model=PMSChargeReversalResponse, status_code=201)
def create_reversal(
    data: PMSChargeReversalCreate,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    user=Depends(get_current_active_user),
):
    """Request reversal of a posted charge."""
    svc = PMSService(db)
    reversal = svc.create_reversal(
        business_id=UUID(business_id),
        charge_id=data.charge_id,
        reason=data.reason,
        user_id=user.id if hasattr(user, "id") else None,
    )
    if not reversal:
        raise HTTPException(
            status_code=400,
            detail="Charge not found or not in posted status",
        )
    return reversal


# ---------------------------------------------------------------------------
# Guest Search
# ---------------------------------------------------------------------------


@router.get("/guests", response_model=PMSGuestListResponse)
def search_guests(
    connection_id: UUID = Query(...),
    search: Optional[str] = None,
    room_number: Optional[str] = None,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Search cached guest profiles."""
    svc = PMSService(db)
    items, total = svc.search_guests(connection_id, search, room_number)
    return PMSGuestListResponse(items=items, total=total)


# ---------------------------------------------------------------------------
# Reconciliation
# ---------------------------------------------------------------------------


@router.post(
    "/reconciliation",
    response_model=PMSReconciliationSessionResponse,
    status_code=201,
)
def start_reconciliation(
    data: PMSReconciliationStartRequest,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    user=Depends(get_current_active_user),
):
    """Start an EOD reconciliation session."""
    svc = PMSService(db)
    return svc.start_reconciliation(
        business_id=UUID(business_id),
        connection_id=data.connection_id,
        session_date=data.session_date,
        user_id=user.id if hasattr(user, "id") else None,
    )


@router.get(
    "/reconciliation/{session_id}",
    response_model=PMSReconciliationSessionResponse,
)
def get_reconciliation(
    session_id: UUID,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Get a reconciliation session by ID."""
    svc = PMSService(db)
    session = svc.get_reconciliation_session(UUID(business_id), session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Reconciliation session not found")
    return session


@router.post(
    "/reconciliation/items/{item_id}/resolve",
    response_model=PMSReconciliationItemResponse,
)
def resolve_reconciliation_item(
    item_id: UUID,
    data: PMSReconciliationResolveRequest,
    db: Session = Depends(get_sync_db),
    user=Depends(get_current_active_user),
):
    """Resolve a reconciliation discrepancy."""
    svc = PMSService(db)
    item = svc.resolve_reconciliation_item(
        item_id,
        resolution_note=data.resolution_note,
        user_id=user.id if hasattr(user, "id") else None,
    )
    if not item:
        raise HTTPException(status_code=404, detail="Reconciliation item not found")
    return item


# ---------------------------------------------------------------------------
# Audit Logs
# ---------------------------------------------------------------------------


@router.get("/audit", response_model=PMSAuditLogListResponse)
def list_audit_logs(
    entity_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """List PMS audit logs."""
    svc = PMSService(db)
    items, total = svc.list_audit_logs(
        UUID(business_id), entity_type, page, per_page
    )
    pages = max(1, math.ceil(total / per_page))
    return PMSAuditLogListResponse(
        items=items, total=total, page=page, per_page=per_page, pages=pages
    )
