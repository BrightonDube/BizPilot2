"""Sync queue API endpoints for the offline-first sync engine.

Provides endpoints for mobile/offline clients to push queued changes,
check sync status, and manage watermarks.
"""

import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel as PydanticBase, Field

from app.core.database import get_sync_db
from app.api.deps import get_current_active_user, get_current_business_id
from app.models.user import User
from app.services.sync_queue_service import SyncQueueService


router = APIRouter(prefix="/sync", tags=["Sync Queue"])


# --- Request / Response schemas (inline — small surface area) ---

class SyncEnqueueRequest(PydanticBase):
    """Request body for enqueuing a sync operation."""
    entity_type: str = Field(..., min_length=1, max_length=50)
    entity_id: str
    action: str = Field(..., pattern="^(create|update|delete)$")
    payload: dict
    device_id: Optional[str] = None


class SyncQueueItemResponse(PydanticBase):
    """Response for a sync queue item."""
    id: str
    business_id: str
    device_id: Optional[str] = None
    entity_type: str
    entity_id: str
    action: str
    status: str
    attempts: int
    last_error: Optional[str] = None
    created_at: str
    processed_at: Optional[str] = None

    model_config = {"from_attributes": True}


class SyncQueueListResponse(PydanticBase):
    """Paginated list of sync queue items."""
    items: list[SyncQueueItemResponse]
    total: int
    page: int
    per_page: int
    pages: int


class SyncMetadataResponse(PydanticBase):
    """Response for sync metadata."""
    id: str
    business_id: str
    device_id: Optional[str] = None
    entity_type: str
    last_sync_at: Optional[str] = None
    last_sync_status: Optional[str] = None
    records_synced: int

    model_config = {"from_attributes": True}


# --- Endpoints ---

@router.post("/queue", response_model=SyncQueueItemResponse, status_code=status.HTTP_201_CREATED)
async def enqueue_sync_item(
    payload: SyncEnqueueRequest,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Enqueue a sync operation from an offline client."""
    service = SyncQueueService(db)
    item = service.enqueue(
        business_id=business_id,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        action=payload.action,
        payload=payload.payload,
        device_id=payload.device_id,
    )
    return SyncQueueItemResponse.model_validate(item)


@router.get("/queue", response_model=SyncQueueListResponse)
async def list_pending_items(
    entity_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """List pending sync queue items."""
    service = SyncQueueService(db)
    items, total = service.list_pending(business_id, entity_type=entity_type, page=page, per_page=per_page)
    pages = max(1, math.ceil(total / per_page))
    return SyncQueueListResponse(
        items=[SyncQueueItemResponse.model_validate(i) for i in items],
        total=total, page=page, per_page=per_page, pages=pages,
    )


@router.patch("/queue/{item_id}/complete", response_model=SyncQueueItemResponse)
async def mark_item_completed(
    item_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Mark a sync queue item as completed."""
    service = SyncQueueService(db)
    item = service.mark_completed(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found.")
    return SyncQueueItemResponse.model_validate(item)


@router.patch("/queue/{item_id}/fail")
async def mark_item_failed(
    item_id: str,
    error: str = Query(...),
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Mark a sync queue item as failed with error details."""
    service = SyncQueueService(db)
    item = service.mark_failed(item_id, error)
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found.")
    return SyncQueueItemResponse.model_validate(item)


@router.post("/queue/retry-failed")
async def retry_all_failed(
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Reset all failed sync items back to pending for retry."""
    service = SyncQueueService(db)
    count = service.retry_failed(business_id)
    return {"message": f"Reset {count} failed items to pending.", "count": count}


@router.get("/metadata", response_model=list[SyncMetadataResponse])
async def list_sync_metadata(
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """List all sync metadata watermarks for the current business."""
    service = SyncQueueService(db)
    items = service.list_metadata(business_id)
    return [SyncMetadataResponse.model_validate(i) for i in items]


@router.get("/metadata/{entity_type}", response_model=SyncMetadataResponse)
async def get_sync_metadata(
    entity_type: str,
    device_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get sync metadata for a specific entity type."""
    service = SyncQueueService(db)
    meta = service.get_metadata(business_id, entity_type, device_id)
    if not meta:
        raise HTTPException(status_code=404, detail="No sync metadata found for this entity type.")
    return SyncMetadataResponse.model_validate(meta)


# ---------------------------------------------------------------------------
# Health check (required by offline-sync spec for connectivity detection)
# ---------------------------------------------------------------------------

@router.get("/health")
async def sync_health_check():
    """
    Lightweight health check for offline clients to detect connectivity.

    Why a dedicated /sync/health instead of using / or /health?
    Offline clients need a specific endpoint that:
    1. Returns instantly (no DB or auth overhead)
    2. Confirms the sync subsystem is operational
    3. Can be polled frequently without impacting other endpoints
    """
    return {"status": "ok", "service": "sync"}
