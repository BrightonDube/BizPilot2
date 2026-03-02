"""Service layer for WooCommerce e-commerce integration.

Manages REST API connections, sync map tracking, and (future)
actual WooCommerce API calls for products, orders, and inventory.

Why separate from Xero?
WooCommerce is bi-directional (products push out, orders pull in),
while Xero is push-only.  Different conflict resolution and sync
strategies require separate service logic.
"""

import math
from datetime import datetime, timezone
from typing import Optional, Tuple, List
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.woocommerce import WooConnection, WooSyncMap


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class WooCommerceService:
    """Business logic for WooCommerce integration."""

    def __init__(self, db: Session) -> None:
        self.db = db

    # -------------------------------------------------------------------
    # Connection
    # -------------------------------------------------------------------

    def get_connection(self, business_id: UUID) -> Optional[WooConnection]:
        """Get the WooCommerce connection for a business."""
        return (
            self.db.query(WooConnection)
            .filter(
                WooConnection.business_id == business_id,
                WooConnection.deleted_at.is_(None),
            )
            .first()
        )

    def create_connection(
        self,
        business_id: UUID,
        store_url: str,
        config: Optional[dict] = None,
    ) -> WooConnection:
        """Create a WooCommerce connection."""
        conn = WooConnection(
            business_id=business_id,
            store_url=store_url,
            config=config,
            is_active=False,
            sync_status="idle",
        )
        self.db.add(conn)
        self.db.commit()
        self.db.refresh(conn)
        return conn

    def update_connection(
        self, business_id: UUID, **kwargs
    ) -> Optional[WooConnection]:
        """Update the WooCommerce connection."""
        conn = self.get_connection(business_id)
        if not conn:
            return None
        for key, value in kwargs.items():
            if value is not None:
                setattr(conn, key, value)
        conn.updated_at = _utc_now()
        self.db.commit()
        self.db.refresh(conn)
        return conn

    def delete_connection(self, business_id: UUID) -> bool:
        """Soft-delete the WooCommerce connection."""
        conn = self.get_connection(business_id)
        if not conn:
            return False
        conn.soft_delete()
        self.db.commit()
        return True

    # -------------------------------------------------------------------
    # Sync Maps
    # -------------------------------------------------------------------

    def list_sync_maps(
        self,
        business_id: UUID,
        entity_type: Optional[str] = None,
        status: Optional[str] = None,
        page: int = 1,
        per_page: int = 50,
    ) -> Tuple[List[WooSyncMap], int]:
        """List sync map entries with optional filters."""
        query = self.db.query(WooSyncMap).filter(
            WooSyncMap.business_id == business_id,
            WooSyncMap.deleted_at.is_(None),
        )
        if entity_type:
            query = query.filter(WooSyncMap.entity_type == entity_type)
        if status:
            query = query.filter(WooSyncMap.status == status)
        total = query.count()
        items = (
            query.order_by(WooSyncMap.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def get_sync_map(
        self, business_id: UUID, entity_type: str, bizpilot_id: UUID
    ) -> Optional[WooSyncMap]:
        """Get the sync map for a specific entity."""
        return (
            self.db.query(WooSyncMap)
            .filter(
                WooSyncMap.business_id == business_id,
                WooSyncMap.entity_type == entity_type,
                WooSyncMap.bizpilot_id == bizpilot_id,
            )
            .first()
        )

    def create_sync_map(
        self,
        business_id: UUID,
        entity_type: str,
        bizpilot_id: UUID,
        direction: str = "push",
    ) -> WooSyncMap:
        """Create a sync map entry (pending status)."""
        entry = WooSyncMap(
            business_id=business_id,
            entity_type=entity_type,
            bizpilot_id=bizpilot_id,
            direction=direction,
            status="pending",
        )
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def mark_synced(
        self,
        map_id: UUID,
        woo_id: str,
        payload_hash: Optional[str] = None,
    ) -> Optional[WooSyncMap]:
        """Mark a sync map entry as successfully synced."""
        entry = self.db.query(WooSyncMap).filter(WooSyncMap.id == map_id).first()
        if not entry:
            return None
        entry.status = "synced"
        entry.woo_id = woo_id
        entry.payload_hash = payload_hash
        entry.last_synced_at = _utc_now()
        entry.updated_at = _utc_now()
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def mark_failed(
        self, map_id: UUID, error_message: str
    ) -> Optional[WooSyncMap]:
        """Mark a sync map entry as failed."""
        entry = self.db.query(WooSyncMap).filter(WooSyncMap.id == map_id).first()
        if not entry:
            return None
        entry.status = "failed"
        entry.error_message = error_message
        entry.updated_at = _utc_now()
        self.db.commit()
        self.db.refresh(entry)
        return entry
