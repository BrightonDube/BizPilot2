"""Pydantic schemas for digital signage.

Covers display groups, displays, content, playlists, and playlist items.
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Display Groups
# ---------------------------------------------------------------------------


class SignageDisplayGroupCreate(BaseModel):
    """Create a new display group."""

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class SignageDisplayGroupUpdate(BaseModel):
    """Update a display group."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None


class SignageDisplayGroupResponse(BaseModel):
    """Display group response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    name: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime


class SignageDisplayGroupListResponse(BaseModel):
    """Paginated list of display groups."""

    items: List[SignageDisplayGroupResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ---------------------------------------------------------------------------
# Displays
# ---------------------------------------------------------------------------


class SignageDisplayCreate(BaseModel):
    """Register a new signage display."""

    name: str = Field(..., min_length=1, max_length=255)
    display_group_id: Optional[UUID] = None


class SignageDisplayUpdate(BaseModel):
    """Update a signage display."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    display_group_id: Optional[UUID] = None
    status: Optional[str] = None


class SignageDisplayResponse(BaseModel):
    """Signage display response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    display_group_id: Optional[UUID]
    name: str
    pairing_code: Optional[str]
    device_id: Optional[str]
    status: str
    last_heartbeat_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class SignageDisplayListResponse(BaseModel):
    """Paginated list of displays."""

    items: List[SignageDisplayResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ---------------------------------------------------------------------------
# Content
# ---------------------------------------------------------------------------


class SignageContentCreate(BaseModel):
    """Create new signage content."""

    name: str = Field(..., min_length=1, max_length=255)
    content_type: str = Field(..., pattern="^(image|video|html|menu_board|promotion)$")
    layout: Optional[dict] = None
    duration_seconds: int = Field(10, ge=1, le=3600)
    transition_type: str = Field("fade", pattern="^(fade|slide|cut|dissolve)$")


class SignageContentUpdate(BaseModel):
    """Update signage content."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    layout: Optional[dict] = None
    duration_seconds: Optional[int] = Field(None, ge=1, le=3600)
    transition_type: Optional[str] = None
    status: Optional[str] = None


class SignageContentResponse(BaseModel):
    """Signage content response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    name: str
    content_type: str
    layout: Optional[dict]
    duration_seconds: int
    transition_type: str
    status: str
    published_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class SignageContentListResponse(BaseModel):
    """Paginated list of content."""

    items: List[SignageContentResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ---------------------------------------------------------------------------
# Playlists
# ---------------------------------------------------------------------------


class SignagePlaylistCreate(BaseModel):
    """Create a new playlist."""

    name: str = Field(..., min_length=1, max_length=255)
    shuffle: bool = False
    loop: bool = True
    priority: int = 0


class SignagePlaylistUpdate(BaseModel):
    """Update a playlist."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    shuffle: Optional[bool] = None
    loop: Optional[bool] = None
    priority: Optional[int] = None


class SignagePlaylistResponse(BaseModel):
    """Playlist response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    name: str
    shuffle: bool
    loop: bool
    priority: int
    created_at: datetime
    updated_at: datetime


class SignagePlaylistListResponse(BaseModel):
    """Paginated list of playlists."""

    items: List[SignagePlaylistResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ---------------------------------------------------------------------------
# Playlist Items
# ---------------------------------------------------------------------------


class SignagePlaylistItemCreate(BaseModel):
    """Add content to a playlist."""

    content_id: UUID
    sort_order: int = 0
    duration_seconds: Optional[int] = Field(None, ge=1, le=3600)


class SignagePlaylistItemUpdate(BaseModel):
    """Update a playlist item."""

    sort_order: Optional[int] = None
    duration_seconds: Optional[int] = Field(None, ge=1, le=3600)


class SignagePlaylistItemResponse(BaseModel):
    """Playlist item response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    playlist_id: UUID
    content_id: Optional[UUID]
    sort_order: int
    duration_seconds: Optional[int]
    created_at: datetime
    updated_at: datetime


class SignagePlaylistItemListResponse(BaseModel):
    """List of playlist items."""

    items: List[SignagePlaylistItemResponse]
    total: int
