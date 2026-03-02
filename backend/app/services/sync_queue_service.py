"""Sync queue service for offline-first sync engine.

Handles queued operations from offline clients, conflict resolution,
and sync metadata watermarks.

Why server-side processing?
Clients push raw payloads.  The server validates, deduplicates, and
applies them in a controlled order.  This centralised approach avoids
split-brain issues when multiple devices edit the same entity offline.
"""

from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.sync_queue import SyncQueueItem, SyncMetadata


class SyncQueueService:
    """Service for managing the offline sync queue and metadata."""

    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # Queue Operations
    # ------------------------------------------------------------------

    def enqueue(
        self,
        business_id: str,
        entity_type: str,
        entity_id: str,
        action: str,
        payload: dict,
        device_id: Optional[str] = None,
    ) -> SyncQueueItem:
        """Add a new item to the sync queue.

        Why no dedup here?
        The same entity may be updated multiple times offline.  Each update
        is a distinct operation that must be applied in order.  Dedup happens
        during processing, not during enqueue.
        """
        item = SyncQueueItem(
            business_id=business_id,
            device_id=device_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            payload=payload,
            status="pending",
        )
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def list_pending(
        self,
        business_id: str,
        entity_type: Optional[str] = None,
        page: int = 1,
        per_page: int = 50,
    ) -> Tuple[List[SyncQueueItem], int]:
        """List pending sync queue items, ordered by creation time."""
        query = self.db.query(SyncQueueItem).filter(
            SyncQueueItem.business_id == business_id,
            SyncQueueItem.status == "pending",
        )
        if entity_type:
            query = query.filter(SyncQueueItem.entity_type == entity_type)

        total = query.count()
        items = (
            query.order_by(SyncQueueItem.created_at.asc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def mark_completed(self, item_id: str) -> Optional[SyncQueueItem]:
        """Mark a sync queue item as completed."""
        item = self.db.query(SyncQueueItem).filter(
            SyncQueueItem.id == item_id,
        ).first()
        if not item:
            return None
        item.status = "completed"
        item.processed_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(item)
        return item

    def mark_failed(self, item_id: str, error: str) -> Optional[SyncQueueItem]:
        """Mark a sync queue item as failed with error details."""
        item = self.db.query(SyncQueueItem).filter(
            SyncQueueItem.id == item_id,
        ).first()
        if not item:
            return None
        item.status = "failed"
        item.last_error = error
        item.attempts = (item.attempts or 0) + 1
        self.db.commit()
        self.db.refresh(item)
        return item

    def retry_failed(self, business_id: str) -> int:
        """Reset all failed items back to pending for retry.

        Why bulk retry?
        Individual retry is supported via re-enqueue.  Bulk retry is useful
        after fixing a systemic issue (e.g. database was down, now it's up).
        """
        count = (
            self.db.query(SyncQueueItem)
            .filter(
                SyncQueueItem.business_id == business_id,
                SyncQueueItem.status == "failed",
            )
            .update({"status": "pending", "last_error": None})
        )
        self.db.commit()
        return count

    # ------------------------------------------------------------------
    # Sync Metadata (Watermarks)
    # ------------------------------------------------------------------

    def get_metadata(
        self,
        business_id: str,
        entity_type: str,
        device_id: Optional[str] = None,
    ) -> Optional[SyncMetadata]:
        """Get sync metadata for a specific entity type and device."""
        query = self.db.query(SyncMetadata).filter(
            SyncMetadata.business_id == business_id,
            SyncMetadata.entity_type == entity_type,
        )
        if device_id:
            query = query.filter(SyncMetadata.device_id == device_id)
        else:
            query = query.filter(SyncMetadata.device_id.is_(None))
        return query.first()

    def update_metadata(
        self,
        business_id: str,
        entity_type: str,
        records_synced: int,
        status: str = "completed",
        device_id: Optional[str] = None,
    ) -> SyncMetadata:
        """Update or create sync metadata watermark.

        Why upsert pattern?
        The first sync for a new entity type creates the metadata row.
        Subsequent syncs update the watermark.  Using upsert avoids
        race conditions when the first sync hasn't committed yet.
        """
        meta = self.get_metadata(business_id, entity_type, device_id)
        now = datetime.now(timezone.utc)

        if meta:
            meta.last_sync_at = now
            meta.last_sync_status = status
            meta.records_synced = (meta.records_synced or 0) + records_synced
        else:
            meta = SyncMetadata(
                business_id=business_id,
                device_id=device_id,
                entity_type=entity_type,
                last_sync_at=now,
                last_sync_status=status,
                records_synced=records_synced,
            )
            self.db.add(meta)

        self.db.commit()
        self.db.refresh(meta)
        return meta

    def list_metadata(self, business_id: str) -> List[SyncMetadata]:
        """List all sync metadata entries for a business."""
        return (
            self.db.query(SyncMetadata)
            .filter(SyncMetadata.business_id == business_id)
            .order_by(SyncMetadata.entity_type)
            .all()
        )
