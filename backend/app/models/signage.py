"""Models for digital signage content management.

Manages signage displays, content slides, playlists, and playlist items
for promotional screens in retail/restaurant environments.

Why separate from customer_displays?
Customer displays show POS order lines at checkout.  Digital signage
manages content marketing screens (menus, promotions, announcements)
with playlists, scheduling, and analytics — fundamentally different
functionality.
"""

import uuid

from sqlalchemy import (
    Column,
    String,
    Text,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.models.base import BaseModel


class SignageDisplayGroup(BaseModel):
    """Logical group of signage displays for bulk content assignment."""

    __tablename__ = "signage_display_groups"

    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)


class SignageDisplay(BaseModel):
    """Registered digital signage hardware device.

    pairing_code is a short-lived code displayed on the device
    during setup — the manager enters it in the dashboard to pair.
    """

    __tablename__ = "signage_displays"

    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=False,
        index=True,
    )
    display_group_id = Column(
        UUID(as_uuid=True),
        ForeignKey("signage_display_groups.id"),
        nullable=True,
    )
    name = Column(String(255), nullable=False)
    pairing_code = Column(String(20), nullable=True, unique=True)
    device_id = Column(String(255), nullable=True)
    status = Column(String(30), default="offline", nullable=False)
    last_heartbeat_at = Column(DateTime(timezone=True), nullable=True)


class SignageContent(BaseModel):
    """Content slide for digital signage.

    content_type distinguishes between static images, videos, HTML
    widgets, menu boards, and promotion banners.  The layout JSONB
    stores the visual arrangement specific to each type.
    """

    __tablename__ = "signage_content"

    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    content_type = Column(String(30), nullable=False)
    layout = Column(JSONB, nullable=True)
    duration_seconds = Column(Integer, default=10, nullable=False)
    transition_type = Column(String(30), default="fade", nullable=False)
    status = Column(String(30), default="draft", nullable=False)
    published_at = Column(DateTime(timezone=True), nullable=True)


class SignagePlaylist(BaseModel):
    """Ordered sequence of content for playback on signage displays."""

    __tablename__ = "signage_playlists"

    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    shuffle = Column(Boolean, default=False, nullable=False)
    loop = Column(Boolean, default=True, nullable=False)
    priority = Column(Integer, default=0, nullable=False)


class SignagePlaylistItem(BaseModel):
    """Individual item within a signage playlist."""

    __tablename__ = "signage_playlist_items"

    playlist_id = Column(
        UUID(as_uuid=True),
        ForeignKey("signage_playlists.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    content_id = Column(
        UUID(as_uuid=True),
        ForeignKey("signage_content.id"),
        nullable=True,
    )
    sort_order = Column(Integer, default=0, nullable=False)
    duration_seconds = Column(Integer, nullable=True)
