"""Service layer for Xero accounting integration.

Manages OAuth2 connection state, sync log tracking, and (future)
actual Xero API calls for invoices, payments, and contacts.

Why separate service?
Xero integration involves OAuth2 token management, idempotent sync,
and entity mapping — all complex enough to warrant isolation from
the general accounting service.
"""

import math
from datetime import datetime, timezone
from typing import Optional, Tuple, List
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.xero import XeroConnection, XeroSyncLog


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class XeroService:
    """Business logic for Xero integration."""

    def __init__(self, db: Session) -> None:
        self.db = db

    # -------------------------------------------------------------------
    # Connection
    # -------------------------------------------------------------------

    def get_connection(self, business_id: UUID) -> Optional[XeroConnection]:
        """Get the Xero connection for a business (max one per business)."""
        return (
            self.db.query(XeroConnection)
            .filter(
                XeroConnection.business_id == business_id,
                XeroConnection.deleted_at.is_(None),
            )
            .first()
        )

    def create_connection(
        self,
        business_id: UUID,
        tenant_id: Optional[str] = None,
        config: Optional[dict] = None,
    ) -> XeroConnection:
        """Create a Xero connection for a business."""
        conn = XeroConnection(
            business_id=business_id,
            tenant_id=tenant_id,
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
    ) -> Optional[XeroConnection]:
        """Update the Xero connection."""
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
        """Soft-delete the Xero connection."""
        conn = self.get_connection(business_id)
        if not conn:
            return False
        conn.soft_delete()
        self.db.commit()
        return True

    # -------------------------------------------------------------------
    # Sync Logs
    # -------------------------------------------------------------------

    def list_sync_logs(
        self,
        business_id: UUID,
        entity_type: Optional[str] = None,
        status: Optional[str] = None,
        page: int = 1,
        per_page: int = 50,
    ) -> Tuple[List[XeroSyncLog], int]:
        """List sync log entries with optional filters."""
        query = self.db.query(XeroSyncLog).filter(
            XeroSyncLog.business_id == business_id,
            XeroSyncLog.deleted_at.is_(None),
        )
        if entity_type:
            query = query.filter(XeroSyncLog.entity_type == entity_type)
        if status:
            query = query.filter(XeroSyncLog.status == status)
        total = query.count()
        items = (
            query.order_by(XeroSyncLog.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def get_sync_log(
        self, business_id: UUID, entity_type: str, entity_id: UUID
    ) -> Optional[XeroSyncLog]:
        """Get the sync log for a specific entity."""
        return (
            self.db.query(XeroSyncLog)
            .filter(
                XeroSyncLog.business_id == business_id,
                XeroSyncLog.entity_type == entity_type,
                XeroSyncLog.entity_id == entity_id,
            )
            .first()
        )

    def create_sync_log(
        self,
        business_id: UUID,
        entity_type: str,
        entity_id: UUID,
        direction: str = "push",
    ) -> XeroSyncLog:
        """Create a sync log entry (pending status)."""
        log = XeroSyncLog(
            business_id=business_id,
            entity_type=entity_type,
            entity_id=entity_id,
            direction=direction,
            status="pending",
        )
        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)
        return log

    def mark_synced(
        self,
        log_id: UUID,
        xero_id: str,
        payload_hash: Optional[str] = None,
    ) -> Optional[XeroSyncLog]:
        """Mark a sync log entry as successfully synced."""
        log = self.db.query(XeroSyncLog).filter(XeroSyncLog.id == log_id).first()
        if not log:
            return None
        log.status = "synced"
        log.xero_id = xero_id
        log.payload_hash = payload_hash
        log.synced_at = _utc_now()
        log.updated_at = _utc_now()
        self.db.commit()
        self.db.refresh(log)
        return log

    def mark_failed(
        self, log_id: UUID, error_message: str
    ) -> Optional[XeroSyncLog]:
        """Mark a sync log entry as failed."""
        log = self.db.query(XeroSyncLog).filter(XeroSyncLog.id == log_id).first()
        if not log:
            return None
        log.status = "failed"
        log.error_message = error_message
        log.updated_at = _utc_now()
        self.db.commit()
        self.db.refresh(log)
        return log
