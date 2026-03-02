"""Service layer for digital signage content management.

Handles CRUD for display groups, displays, content, playlists,
and playlist items, plus pairing code generation and heartbeat tracking.

Why a service layer?
Pairing-code generation, playlist ordering, and content publishing
involve multi-step logic that doesn't belong in thin API endpoints.
"""

import math
import secrets
import string
from datetime import datetime, timezone
from typing import Optional, Tuple, List
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.signage import (
    SignageDisplayGroup,
    SignageDisplay,
    SignageContent,
    SignagePlaylist,
    SignagePlaylistItem,
)


def _utc_now() -> datetime:
    """Return timezone-aware UTC timestamp."""
    return datetime.now(timezone.utc)


def _generate_pairing_code(length: int = 6) -> str:
    """Generate a random uppercase alphanumeric pairing code.

    Why this approach?
    secrets.choice is cryptographically random, which prevents
    code guessing.  6-char A-Z0-9 gives ~2B combinations.
    """
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


class SignageService:
    """Business logic for digital signage operations."""

    def __init__(self, db: Session) -> None:
        self.db = db

    # -------------------------------------------------------------------
    # Display Groups
    # -------------------------------------------------------------------

    def create_display_group(
        self,
        business_id: UUID,
        name: str,
        description: Optional[str] = None,
    ) -> SignageDisplayGroup:
        """Create a new display group."""
        group = SignageDisplayGroup(
            business_id=business_id,
            name=name,
            description=description,
        )
        self.db.add(group)
        self.db.commit()
        self.db.refresh(group)
        return group

    def get_display_group(
        self, business_id: UUID, group_id: UUID
    ) -> Optional[SignageDisplayGroup]:
        """Get a display group by ID, scoped to business."""
        return (
            self.db.query(SignageDisplayGroup)
            .filter(
                SignageDisplayGroup.id == group_id,
                SignageDisplayGroup.business_id == business_id,
                SignageDisplayGroup.deleted_at.is_(None),
            )
            .first()
        )

    def list_display_groups(
        self,
        business_id: UUID,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[SignageDisplayGroup], int]:
        """List display groups with pagination."""
        query = self.db.query(SignageDisplayGroup).filter(
            SignageDisplayGroup.business_id == business_id,
            SignageDisplayGroup.deleted_at.is_(None),
        )
        total = query.count()
        items = (
            query.order_by(SignageDisplayGroup.name)
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def update_display_group(
        self,
        business_id: UUID,
        group_id: UUID,
        **kwargs,
    ) -> Optional[SignageDisplayGroup]:
        """Update a display group."""
        group = self.get_display_group(business_id, group_id)
        if not group:
            return None
        for key, value in kwargs.items():
            if value is not None:
                setattr(group, key, value)
        group.updated_at = _utc_now()
        self.db.commit()
        self.db.refresh(group)
        return group

    def delete_display_group(
        self, business_id: UUID, group_id: UUID
    ) -> bool:
        """Soft-delete a display group."""
        group = self.get_display_group(business_id, group_id)
        if not group:
            return False
        group.soft_delete()
        self.db.commit()
        return True

    # -------------------------------------------------------------------
    # Displays
    # -------------------------------------------------------------------

    def create_display(
        self,
        business_id: UUID,
        name: str,
        display_group_id: Optional[UUID] = None,
    ) -> SignageDisplay:
        """Register a new signage display with a pairing code."""
        display = SignageDisplay(
            business_id=business_id,
            name=name,
            display_group_id=display_group_id,
            pairing_code=_generate_pairing_code(),
            status="offline",
        )
        self.db.add(display)
        self.db.commit()
        self.db.refresh(display)
        return display

    def get_display(
        self, business_id: UUID, display_id: UUID
    ) -> Optional[SignageDisplay]:
        """Get a display by ID, scoped to business."""
        return (
            self.db.query(SignageDisplay)
            .filter(
                SignageDisplay.id == display_id,
                SignageDisplay.business_id == business_id,
                SignageDisplay.deleted_at.is_(None),
            )
            .first()
        )

    def list_displays(
        self,
        business_id: UUID,
        group_id: Optional[UUID] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[SignageDisplay], int]:
        """List displays with optional group filter."""
        query = self.db.query(SignageDisplay).filter(
            SignageDisplay.business_id == business_id,
            SignageDisplay.deleted_at.is_(None),
        )
        if group_id:
            query = query.filter(SignageDisplay.display_group_id == group_id)
        total = query.count()
        items = (
            query.order_by(SignageDisplay.name)
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def update_display(
        self,
        business_id: UUID,
        display_id: UUID,
        **kwargs,
    ) -> Optional[SignageDisplay]:
        """Update a display."""
        display = self.get_display(business_id, display_id)
        if not display:
            return None
        for key, value in kwargs.items():
            if value is not None:
                setattr(display, key, value)
        display.updated_at = _utc_now()
        self.db.commit()
        self.db.refresh(display)
        return display

    def record_heartbeat(
        self, business_id: UUID, display_id: UUID
    ) -> Optional[SignageDisplay]:
        """Record a heartbeat from a display, marking it online."""
        display = self.get_display(business_id, display_id)
        if not display:
            return None
        display.status = "online"
        display.last_heartbeat_at = _utc_now()
        display.updated_at = _utc_now()
        self.db.commit()
        self.db.refresh(display)
        return display

    # -------------------------------------------------------------------
    # Content
    # -------------------------------------------------------------------

    def create_content(
        self,
        business_id: UUID,
        name: str,
        content_type: str,
        layout: Optional[dict] = None,
        duration_seconds: int = 10,
        transition_type: str = "fade",
    ) -> SignageContent:
        """Create a new content slide."""
        content = SignageContent(
            business_id=business_id,
            name=name,
            content_type=content_type,
            layout=layout,
            duration_seconds=duration_seconds,
            transition_type=transition_type,
            status="draft",
        )
        self.db.add(content)
        self.db.commit()
        self.db.refresh(content)
        return content

    def get_content(
        self, business_id: UUID, content_id: UUID
    ) -> Optional[SignageContent]:
        """Get content by ID, scoped to business."""
        return (
            self.db.query(SignageContent)
            .filter(
                SignageContent.id == content_id,
                SignageContent.business_id == business_id,
                SignageContent.deleted_at.is_(None),
            )
            .first()
        )

    def list_content(
        self,
        business_id: UUID,
        content_type: Optional[str] = None,
        status: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[SignageContent], int]:
        """List content with optional filters."""
        query = self.db.query(SignageContent).filter(
            SignageContent.business_id == business_id,
            SignageContent.deleted_at.is_(None),
        )
        if content_type:
            query = query.filter(SignageContent.content_type == content_type)
        if status:
            query = query.filter(SignageContent.status == status)
        total = query.count()
        items = (
            query.order_by(SignageContent.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def publish_content(
        self, business_id: UUID, content_id: UUID
    ) -> Optional[SignageContent]:
        """Publish a content slide, making it available for playlists.

        Why separate from update?
        Publishing is a state transition with side effects (timestamp,
        potentially triggering display refreshes) — it deserves its own
        method for clarity and future extensibility.
        """
        content = self.get_content(business_id, content_id)
        if not content:
            return None
        content.status = "published"
        content.published_at = _utc_now()
        content.updated_at = _utc_now()
        self.db.commit()
        self.db.refresh(content)
        return content

    def update_content(
        self,
        business_id: UUID,
        content_id: UUID,
        **kwargs,
    ) -> Optional[SignageContent]:
        """Update content fields."""
        content = self.get_content(business_id, content_id)
        if not content:
            return None
        for key, value in kwargs.items():
            if value is not None:
                setattr(content, key, value)
        content.updated_at = _utc_now()
        self.db.commit()
        self.db.refresh(content)
        return content

    # -------------------------------------------------------------------
    # Playlists
    # -------------------------------------------------------------------

    def create_playlist(
        self,
        business_id: UUID,
        name: str,
        shuffle: bool = False,
        loop: bool = True,
        priority: int = 0,
    ) -> SignagePlaylist:
        """Create a new playlist."""
        playlist = SignagePlaylist(
            business_id=business_id,
            name=name,
            shuffle=shuffle,
            loop=loop,
            priority=priority,
        )
        self.db.add(playlist)
        self.db.commit()
        self.db.refresh(playlist)
        return playlist

    def get_playlist(
        self, business_id: UUID, playlist_id: UUID
    ) -> Optional[SignagePlaylist]:
        """Get a playlist by ID."""
        return (
            self.db.query(SignagePlaylist)
            .filter(
                SignagePlaylist.id == playlist_id,
                SignagePlaylist.business_id == business_id,
                SignagePlaylist.deleted_at.is_(None),
            )
            .first()
        )

    def list_playlists(
        self,
        business_id: UUID,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[SignagePlaylist], int]:
        """List playlists with pagination."""
        query = self.db.query(SignagePlaylist).filter(
            SignagePlaylist.business_id == business_id,
            SignagePlaylist.deleted_at.is_(None),
        )
        total = query.count()
        items = (
            query.order_by(SignagePlaylist.priority.desc(), SignagePlaylist.name)
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def update_playlist(
        self,
        business_id: UUID,
        playlist_id: UUID,
        **kwargs,
    ) -> Optional[SignagePlaylist]:
        """Update a playlist."""
        playlist = self.get_playlist(business_id, playlist_id)
        if not playlist:
            return None
        for key, value in kwargs.items():
            if value is not None:
                setattr(playlist, key, value)
        playlist.updated_at = _utc_now()
        self.db.commit()
        self.db.refresh(playlist)
        return playlist

    # -------------------------------------------------------------------
    # Playlist Items
    # -------------------------------------------------------------------

    def add_playlist_item(
        self,
        playlist_id: UUID,
        content_id: UUID,
        sort_order: int = 0,
        duration_seconds: Optional[int] = None,
    ) -> SignagePlaylistItem:
        """Add a content item to a playlist."""
        item = SignagePlaylistItem(
            playlist_id=playlist_id,
            content_id=content_id,
            sort_order=sort_order,
            duration_seconds=duration_seconds,
        )
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def list_playlist_items(
        self, playlist_id: UUID
    ) -> Tuple[List[SignagePlaylistItem], int]:
        """List all items in a playlist, ordered by sort_order."""
        query = (
            self.db.query(SignagePlaylistItem)
            .filter(
                SignagePlaylistItem.playlist_id == playlist_id,
                SignagePlaylistItem.deleted_at.is_(None),
            )
            .order_by(SignagePlaylistItem.sort_order)
        )
        items = query.all()
        return items, len(items)

    def remove_playlist_item(self, item_id: UUID) -> bool:
        """Soft-delete a playlist item."""
        item = (
            self.db.query(SignagePlaylistItem)
            .filter(
                SignagePlaylistItem.id == item_id,
                SignagePlaylistItem.deleted_at.is_(None),
            )
            .first()
        )
        if not item:
            return False
        item.soft_delete()
        self.db.commit()
        return True
