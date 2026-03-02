"""Models for customer-facing display devices.

Manages display hardware registration, configuration (layout, theme),
and health tracking.

Why separate customer_displays from POS terminals?
A POS terminal is operator-facing; a customer display is a secondary
screen (tablet, monitor, pole display) that shows the customer their
order total, promotional content, or a feedback form.  They have
different lifecycle management and configuration needs.
"""

import enum
import uuid

from sqlalchemy import (
    Column,
    String,
    DateTime,
    ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.models.base import BaseModel


class DisplayType(str, enum.Enum):
    """Physical form factor of the display."""

    TABLET = "tablet"
    MONITOR = "monitor"
    POLE_DISPLAY = "pole_display"
    WEB = "web"


class DisplayStatus(str, enum.Enum):
    """Connection status of a display device."""

    ONLINE = "online"
    OFFLINE = "offline"
    PAIRING = "pairing"


class CustomerDisplay(BaseModel):
    """Registered customer-facing display device."""

    __tablename__ = "customer_displays"

    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=False,
        index=True,
    )
    name = Column(String(100), nullable=False)
    display_type = Column(String(30), nullable=False)
    terminal_id = Column(
        String(100),
        nullable=True,
        comment="Links to POS terminal ID for automatic content sync",
    )
    status = Column(String(30), default=DisplayStatus.OFFLINE.value, nullable=False)
    last_seen_at = Column(DateTime(timezone=True), nullable=True)


class DisplayConfig(BaseModel):
    """Presentation settings for a customer display.

    Why a separate table from customer_displays?
    Display hardware data (status, last_seen_at) is updated by device
    heartbeats at high frequency.  Config (layout, theme, features) is
    updated by managers occasionally.  Separating them avoids write
    contention and keeps the device registry lean.
    """

    __tablename__ = "display_configs"

    display_id = Column(
        UUID(as_uuid=True),
        ForeignKey("customer_displays.id"),
        nullable=False,
        unique=True,
        comment="1-to-1 with customer_displays",
    )
    layout = Column(String(30), default="standard", nullable=False)
    orientation = Column(String(20), default="landscape", nullable=False)
    theme = Column(JSONB, nullable=True, comment="Colours, fonts, logo URL")
    features = Column(JSONB, nullable=True, comment="Toggle flags for display features")
    language = Column(String(10), default="en", nullable=False)
