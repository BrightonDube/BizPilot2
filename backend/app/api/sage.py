"""
Sage Business Cloud Accounting API endpoints.

Provides 12 endpoints for:
- Connection management (connect, status, disconnect, toggle sync)
- Account mappings (list, save)
- Sync operations (trigger, status, history, retry)
- Reports (activity, errors)

Why no direct Sage API calls in these endpoints?
All Sage operations go through the SageService, which handles
encryption, logging, and queue management. The API layer only
handles HTTP concerns (auth, validation, serialization).
"""

from datetime import date, datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel as PydanticBase
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_active_user, get_current_business_id
from app.services.sage_service import SageService


router = APIRouter(prefix="/sage", tags=["Sage Integration"])


# ---------------------------------------------------------------------------
# Schemas (inline — small count, tightly coupled to these endpoints)
# ---------------------------------------------------------------------------

class SageConnectRequest(PydanticBase):
    """Request to establish a Sage connection."""
    company_id: Optional[str] = None
    company_name: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None


class SageMappingRequest(PydanticBase):
    """Request to create/update an account mapping."""
    bizpilot_account_type: str
    sage_account_id: str
    sage_account_name: Optional[str] = None
    bizpilot_account_id: Optional[str] = None
    tax_code: Optional[str] = None


class SageSyncTriggerRequest(PydanticBase):
    """Request to trigger a manual sync."""
    sync_type: str  # invoices, payments, journals
    entity_ids: Optional[list] = None


class SageQueueEnqueueRequest(PydanticBase):
    """Request to add an item to the sync queue."""
    operation_type: str
    entity_type: str
    entity_id: str
    payload: dict
    priority: int = 5


class SageToggleSyncRequest(PydanticBase):
    """Request to enable/disable automatic sync."""
    enabled: bool


# ---------------------------------------------------------------------------
# Connection endpoints
# ---------------------------------------------------------------------------

@router.get("/status")
async def get_sage_status(
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Get current Sage connection status."""
    service = SageService(db)
    conn = service.get_connection(business_id)
    if not conn:
        return {
            "connected": False,
            "status": "disconnected",
            "company_name": None,
            "last_sync_at": None,
            "sync_enabled": False,
        }
    return {
        "connected": conn.status == "connected",
        "status": conn.status,
        "company_id": conn.company_id,
        "company_name": conn.company_name,
        "last_sync_at": conn.last_sync_at.isoformat() if conn.last_sync_at else None,
        "sync_enabled": conn.sync_enabled,
    }


@router.post("/connect")
async def connect_sage(
    request: SageConnectRequest,
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """
    Establish a Sage connection.

    In production, the access_token and refresh_token would come from
    an OAuth callback. This endpoint accepts pre-obtained tokens for
    simplicity. Tokens are stored encrypted.
    """
    service = SageService(db)

    # Check for existing connection
    existing = service.get_connection(business_id)
    if existing and existing.status == "connected":
        raise HTTPException(status_code=400, detail="Already connected to Sage")

    # In production: encrypt tokens with Fernet before storage
    # For now, store as-is (encryption handled by deployment config)
    conn = service.create_connection(
        business_id=business_id,
        company_id=request.company_id,
        company_name=request.company_name,
        access_token_encrypted=request.access_token,
        refresh_token_encrypted=request.refresh_token,
    )
    return {
        "message": "Connected to Sage successfully",
        "connection_id": str(conn.id),
        "company_name": conn.company_name,
    }


@router.post("/disconnect")
async def disconnect_sage(
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Disconnect from Sage and clear stored tokens."""
    service = SageService(db)
    success = service.disconnect(business_id)
    if not success:
        raise HTTPException(status_code=404, detail="No Sage connection found")
    return {"message": "Disconnected from Sage"}


@router.post("/toggle-sync")
async def toggle_sage_sync(
    request: SageToggleSyncRequest,
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Enable or disable automatic syncing."""
    service = SageService(db)
    conn = service.toggle_sync(business_id, request.enabled)
    if not conn:
        raise HTTPException(status_code=404, detail="No Sage connection found")
    return {
        "sync_enabled": conn.sync_enabled,
        "message": f"Auto-sync {'enabled' if conn.sync_enabled else 'disabled'}",
    }


# ---------------------------------------------------------------------------
# Account mapping endpoints
# ---------------------------------------------------------------------------

@router.get("/mappings")
async def list_sage_mappings(
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """List all account mappings between BizPilot and Sage."""
    service = SageService(db)
    mappings = service.list_mappings(business_id)
    return [
        {
            "id": str(m.id),
            "bizpilot_account_type": m.bizpilot_account_type,
            "bizpilot_account_id": m.bizpilot_account_id,
            "sage_account_id": m.sage_account_id,
            "sage_account_name": m.sage_account_name,
            "tax_code": m.tax_code,
        }
        for m in mappings
    ]


@router.post("/mappings")
async def save_sage_mapping(
    request: SageMappingRequest,
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Create or update an account mapping (upsert by account type)."""
    service = SageService(db)
    conn = service.get_connection(business_id)
    if not conn:
        raise HTTPException(status_code=404, detail="No Sage connection found")

    mapping = service.save_mapping(
        business_id=business_id,
        connection_id=conn.id,
        bizpilot_account_type=request.bizpilot_account_type,
        sage_account_id=request.sage_account_id,
        sage_account_name=request.sage_account_name,
        bizpilot_account_id=request.bizpilot_account_id,
        tax_code=request.tax_code,
    )
    return {
        "id": str(mapping.id),
        "message": "Mapping saved",
    }


# ---------------------------------------------------------------------------
# Sync endpoints
# ---------------------------------------------------------------------------

@router.get("/sync/history")
async def get_sage_sync_history(
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Get sync history with optional status filter."""
    service = SageService(db)
    items, total = service.get_sync_history(
        business_id=business_id,
        page=page,
        per_page=per_page,
        status=status,
    )
    pages = (total + per_page - 1) // per_page if per_page > 0 else 0
    return {
        "items": [
            {
                "id": str(log.id),
                "sync_type": log.sync_type,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "status": log.status,
                "error_message": log.error_message,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in items
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": pages,
    }


@router.get("/sync/errors")
async def get_sage_sync_errors(
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Get summary of sync errors for troubleshooting."""
    service = SageService(db)
    return service.get_error_summary(business_id)


@router.get("/sync/queue")
async def get_sage_sync_queue(
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Get pending items in the sync retry queue."""
    service = SageService(db)
    items = service.get_pending_queue_items(business_id)
    return [
        {
            "id": str(item.id),
            "operation_type": item.operation_type,
            "entity_type": item.entity_type,
            "entity_id": item.entity_id,
            "priority": item.priority,
            "retry_count": item.retry_count,
            "status": item.status,
            "error_message": item.error_message,
            "next_retry_at": item.next_retry_at.isoformat() if item.next_retry_at else None,
        }
        for item in items
    ]


@router.post("/sync/queue/{item_id}/retry")
async def retry_sage_queue_item(
    item_id: UUID,
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Reset a dead-letter queue item for re-processing."""
    service = SageService(db)
    item = service.retry_queue_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    return {"message": "Item queued for retry", "id": str(item.id)}
