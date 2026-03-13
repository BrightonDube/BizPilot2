"""Service layer for customer-facing display management.

Handles display registration, configuration, and health monitoring.

Why a dedicated service?
Display management involves device pairing workflows, heartbeat
tracking, and config propagation — all distinct from POS terminal
management.  Keeping it separate avoids coupling display concerns
with point-of-sale logic.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.customer_display import CustomerDisplay, DisplayConfig


class CustomerDisplayService:
    """Business logic for customer display devices."""

    def __init__(self, db: Session) -> None:
        self.db = db

    # -----------------------------------------------------------------------
    # Display CRUD
    # -----------------------------------------------------------------------

    def register_display(
        self,
        business_id: uuid.UUID,
        *,
        name: str,
        display_type: str,
        terminal_id: Optional[str] = None,
    ) -> CustomerDisplay:
        """Register a new customer-facing display."""
        display = CustomerDisplay(
            id=uuid.uuid4(),
            business_id=business_id,
            name=name,
            display_type=display_type,
            terminal_id=terminal_id,
            status="offline",
        )
        self.db.add(display)
        self.db.commit()
        self.db.refresh(display)
        return display

    def list_displays(
        self,
        business_id: uuid.UUID,
        *,
        page: int = 1,
        per_page: int = 20,
    ) -> tuple[list[CustomerDisplay], int]:
        """List displays for a business."""
        query = self.db.query(CustomerDisplay).filter(
            CustomerDisplay.business_id == business_id,
            CustomerDisplay.deleted_at.is_(None),
        )
        total = query.count()
        items = (
            query.order_by(CustomerDisplay.name)
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def get_display(self, display_id: uuid.UUID) -> Optional[CustomerDisplay]:
        return (
            self.db.query(CustomerDisplay)
            .filter(CustomerDisplay.id == display_id, CustomerDisplay.deleted_at.is_(None))
            .first()
        )

    def update_display(self, display_id: uuid.UUID, **kwargs) -> Optional[CustomerDisplay]:
        display = self.get_display(display_id)
        if not display:
            return None
        for key, value in kwargs.items():
            if value is not None and hasattr(display, key):
                setattr(display, key, value)
        self.db.commit()
        self.db.refresh(display)
        return display

    def delete_display(self, display_id: uuid.UUID) -> bool:
        display = self.get_display(display_id)
        if not display:
            return False
        display.soft_delete()
        self.db.commit()
        return True

    def heartbeat(self, display_id: uuid.UUID) -> Optional[CustomerDisplay]:
        """Record a heartbeat from a display device.

        Why heartbeats?
        Customer displays can disconnect silently (power loss, network
        issues).  Periodic heartbeats let the dashboard show which
        displays are actually online vs which were just registered.
        """
        display = self.get_display(display_id)
        if not display:
            return None
        display.status = "online"
        display.last_seen_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(display)
        return display

    # -----------------------------------------------------------------------
    # Display Config CRUD
    # -----------------------------------------------------------------------

    def create_config(
        self,
        display_id: uuid.UUID,
        *,
        layout: str = "standard",
        orientation: str = "landscape",
        theme: Optional[dict] = None,
        features: Optional[dict] = None,
        language: str = "en",
    ) -> DisplayConfig:
        """Create display configuration (1-to-1 with display)."""
        config = DisplayConfig(
            id=uuid.uuid4(),
            display_id=display_id,
            layout=layout,
            orientation=orientation,
            theme=theme,
            features=features,
            language=language,
        )
        self.db.add(config)
        self.db.commit()
        self.db.refresh(config)
        return config

    def get_config(self, display_id: uuid.UUID) -> Optional[DisplayConfig]:
        """Get configuration for a display."""
        return (
            self.db.query(DisplayConfig)
            .filter(DisplayConfig.display_id == display_id)
            .first()
        )

    def update_config(self, display_id: uuid.UUID, **kwargs) -> Optional[DisplayConfig]:
        """Update display configuration."""
        config = self.get_config(display_id)
        if not config:
            return None
        for key, value in kwargs.items():
            if value is not None and hasattr(config, key):
                setattr(config, key, value)
        self.db.commit()
        self.db.refresh(config)
        return config
