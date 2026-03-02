"""API endpoints for digital signage content management.

Provides CRUD for display groups, displays, content, playlists,
and playlist items — all scoped to the current business.
"""

import math
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_current_business_id
from app.core.database import get_sync_db
from app.schemas.signage import (
    SignageDisplayGroupCreate,
    SignageDisplayGroupUpdate,
    SignageDisplayGroupResponse,
    SignageDisplayGroupListResponse,
    SignageDisplayCreate,
    SignageDisplayUpdate,
    SignageDisplayResponse,
    SignageDisplayListResponse,
    SignageContentCreate,
    SignageContentUpdate,
    SignageContentResponse,
    SignageContentListResponse,
    SignagePlaylistCreate,
    SignagePlaylistUpdate,
    SignagePlaylistResponse,
    SignagePlaylistListResponse,
    SignagePlaylistItemCreate,
    SignagePlaylistItemResponse,
    SignagePlaylistItemListResponse,
)
from app.services.signage_service import SignageService

router = APIRouter(prefix="/signage", tags=["Digital Signage"])


# ---------------------------------------------------------------------------
# Display Groups
# ---------------------------------------------------------------------------


@router.get("/groups", response_model=SignageDisplayGroupListResponse)
def list_display_groups(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """List all display groups for the current business."""
    svc = SignageService(db)
    items, total = svc.list_display_groups(UUID(business_id), page, per_page)
    pages = max(1, math.ceil(total / per_page))
    return SignageDisplayGroupListResponse(
        items=items, total=total, page=page, per_page=per_page, pages=pages
    )


@router.post("/groups", response_model=SignageDisplayGroupResponse, status_code=201)
def create_display_group(
    data: SignageDisplayGroupCreate,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Create a new display group."""
    svc = SignageService(db)
    return svc.create_display_group(
        business_id=UUID(business_id),
        name=data.name,
        description=data.description,
    )


@router.get("/groups/{group_id}", response_model=SignageDisplayGroupResponse)
def get_display_group(
    group_id: UUID,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Get a display group by ID."""
    svc = SignageService(db)
    group = svc.get_display_group(UUID(business_id), group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Display group not found")
    return group


@router.put("/groups/{group_id}", response_model=SignageDisplayGroupResponse)
def update_display_group(
    group_id: UUID,
    data: SignageDisplayGroupUpdate,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Update a display group."""
    svc = SignageService(db)
    group = svc.update_display_group(
        UUID(business_id), group_id,
        name=data.name,
        description=data.description,
    )
    if not group:
        raise HTTPException(status_code=404, detail="Display group not found")
    return group


@router.delete("/groups/{group_id}", status_code=204)
def delete_display_group(
    group_id: UUID,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Delete a display group."""
    svc = SignageService(db)
    if not svc.delete_display_group(UUID(business_id), group_id):
        raise HTTPException(status_code=404, detail="Display group not found")


# ---------------------------------------------------------------------------
# Displays
# ---------------------------------------------------------------------------


@router.get("/displays", response_model=SignageDisplayListResponse)
def list_displays(
    group_id: Optional[UUID] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """List signage displays with optional group filter."""
    svc = SignageService(db)
    items, total = svc.list_displays(UUID(business_id), group_id, page, per_page)
    pages = max(1, math.ceil(total / per_page))
    return SignageDisplayListResponse(
        items=items, total=total, page=page, per_page=per_page, pages=pages
    )


@router.post("/displays", response_model=SignageDisplayResponse, status_code=201)
def create_display(
    data: SignageDisplayCreate,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Register a new signage display."""
    svc = SignageService(db)
    return svc.create_display(
        business_id=UUID(business_id),
        name=data.name,
        display_group_id=data.display_group_id,
    )


@router.get("/displays/{display_id}", response_model=SignageDisplayResponse)
def get_display(
    display_id: UUID,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Get a signage display by ID."""
    svc = SignageService(db)
    display = svc.get_display(UUID(business_id), display_id)
    if not display:
        raise HTTPException(status_code=404, detail="Display not found")
    return display


@router.put("/displays/{display_id}", response_model=SignageDisplayResponse)
def update_display(
    display_id: UUID,
    data: SignageDisplayUpdate,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Update a signage display."""
    svc = SignageService(db)
    display = svc.update_display(
        UUID(business_id), display_id,
        name=data.name,
        display_group_id=data.display_group_id,
        status=data.status,
    )
    if not display:
        raise HTTPException(status_code=404, detail="Display not found")
    return display


@router.post("/displays/{display_id}/heartbeat", response_model=SignageDisplayResponse)
def display_heartbeat(
    display_id: UUID,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Record a heartbeat from a signage display."""
    svc = SignageService(db)
    display = svc.record_heartbeat(UUID(business_id), display_id)
    if not display:
        raise HTTPException(status_code=404, detail="Display not found")
    return display


# ---------------------------------------------------------------------------
# Content
# ---------------------------------------------------------------------------


@router.get("/content", response_model=SignageContentListResponse)
def list_content(
    content_type: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """List signage content with optional filters."""
    svc = SignageService(db)
    items, total = svc.list_content(
        UUID(business_id), content_type, status, page, per_page
    )
    pages = max(1, math.ceil(total / per_page))
    return SignageContentListResponse(
        items=items, total=total, page=page, per_page=per_page, pages=pages
    )


@router.post("/content", response_model=SignageContentResponse, status_code=201)
def create_content(
    data: SignageContentCreate,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Create new signage content."""
    svc = SignageService(db)
    return svc.create_content(
        business_id=UUID(business_id),
        name=data.name,
        content_type=data.content_type,
        layout=data.layout,
        duration_seconds=data.duration_seconds,
        transition_type=data.transition_type,
    )


@router.get("/content/{content_id}", response_model=SignageContentResponse)
def get_content(
    content_id: UUID,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Get content by ID."""
    svc = SignageService(db)
    content = svc.get_content(UUID(business_id), content_id)
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    return content


@router.put("/content/{content_id}", response_model=SignageContentResponse)
def update_content(
    content_id: UUID,
    data: SignageContentUpdate,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Update signage content."""
    svc = SignageService(db)
    content = svc.update_content(
        UUID(business_id), content_id,
        name=data.name,
        layout=data.layout,
        duration_seconds=data.duration_seconds,
        transition_type=data.transition_type,
        status=data.status,
    )
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    return content


@router.post("/content/{content_id}/publish", response_model=SignageContentResponse)
def publish_content(
    content_id: UUID,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Publish content to make it available for playlists."""
    svc = SignageService(db)
    content = svc.publish_content(UUID(business_id), content_id)
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    return content


# ---------------------------------------------------------------------------
# Playlists
# ---------------------------------------------------------------------------


@router.get("/playlists", response_model=SignagePlaylistListResponse)
def list_playlists(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """List signage playlists."""
    svc = SignageService(db)
    items, total = svc.list_playlists(UUID(business_id), page, per_page)
    pages = max(1, math.ceil(total / per_page))
    return SignagePlaylistListResponse(
        items=items, total=total, page=page, per_page=per_page, pages=pages
    )


@router.post("/playlists", response_model=SignagePlaylistResponse, status_code=201)
def create_playlist(
    data: SignagePlaylistCreate,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Create a new playlist."""
    svc = SignageService(db)
    return svc.create_playlist(
        business_id=UUID(business_id),
        name=data.name,
        shuffle=data.shuffle,
        loop=data.loop,
        priority=data.priority,
    )


@router.get("/playlists/{playlist_id}", response_model=SignagePlaylistResponse)
def get_playlist(
    playlist_id: UUID,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Get a playlist by ID."""
    svc = SignageService(db)
    playlist = svc.get_playlist(UUID(business_id), playlist_id)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return playlist


@router.put("/playlists/{playlist_id}", response_model=SignagePlaylistResponse)
def update_playlist(
    playlist_id: UUID,
    data: SignagePlaylistUpdate,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Update a playlist."""
    svc = SignageService(db)
    playlist = svc.update_playlist(
        UUID(business_id), playlist_id,
        name=data.name,
        shuffle=data.shuffle,
        loop=data.loop,
        priority=data.priority,
    )
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return playlist


# ---------------------------------------------------------------------------
# Playlist Items
# ---------------------------------------------------------------------------


@router.get(
    "/playlists/{playlist_id}/items",
    response_model=SignagePlaylistItemListResponse,
)
def list_playlist_items(
    playlist_id: UUID,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """List items in a playlist, ordered by sort_order."""
    svc = SignageService(db)
    # Verify playlist belongs to business
    playlist = svc.get_playlist(UUID(business_id), playlist_id)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    items, total = svc.list_playlist_items(playlist_id)
    return SignagePlaylistItemListResponse(items=items, total=total)


@router.post(
    "/playlists/{playlist_id}/items",
    response_model=SignagePlaylistItemResponse,
    status_code=201,
)
def add_playlist_item(
    playlist_id: UUID,
    data: SignagePlaylistItemCreate,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Add content to a playlist."""
    svc = SignageService(db)
    playlist = svc.get_playlist(UUID(business_id), playlist_id)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return svc.add_playlist_item(
        playlist_id=playlist_id,
        content_id=data.content_id,
        sort_order=data.sort_order,
        duration_seconds=data.duration_seconds,
    )


@router.delete("/playlists/items/{item_id}", status_code=204)
def remove_playlist_item(
    item_id: UUID,
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Remove an item from a playlist."""
    svc = SignageService(db)
    if not svc.remove_playlist_item(item_id):
        raise HTTPException(status_code=404, detail="Playlist item not found")
