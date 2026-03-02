"""
Sage Business Cloud Accounting integration service.

Handles the full Sage integration lifecycle:
1. Connection management (OAuth tokens, status)
2. Account mapping (BizPilot → Sage chart of accounts)
3. Sync operations (invoices, payments, journals)
4. Queue management (retry failed operations with backoff)
5. Audit logging (compliance and debugging)

Why a single service instead of separate client + sync classes?
The Sage API surface is relatively small (invoices, payments, journals).
A single service reduces indirection and makes the dependency chain
clear. If Sage operations grow, we can extract a SageClient later.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional, List, Tuple, Dict, Any
from uuid import UUID

from sqlalchemy import func, desc, and_
from sqlalchemy.orm import Session

from app.models.sage import (
    SageConnection,
    SageAccountMapping,
    SageSyncLog,
    SageSyncQueue,
    SageConnectionStatus,
    SageSyncStatus,
    SageQueueStatus,
)


class SageService:
    """
    Service for Sage Business Cloud Accounting integration.

    All methods that touch Sage tokens handle encryption/decryption
    at this layer. Never expose raw tokens in API responses.
    """

    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # Connection management
    # ------------------------------------------------------------------

    def get_connection(self, business_id: UUID) -> Optional[SageConnection]:
        """Get the Sage connection for a business (one-to-one)."""
        return (
            self.db.query(SageConnection)
            .filter(
                SageConnection.business_id == business_id,
                SageConnection.deleted_at.is_(None),
            )
            .first()
        )

    def create_connection(
        self,
        business_id: UUID,
        company_id: Optional[str] = None,
        company_name: Optional[str] = None,
        access_token_encrypted: Optional[str] = None,
        refresh_token_encrypted: Optional[str] = None,
        token_expires_at: Optional[datetime] = None,
    ) -> SageConnection:
        """
        Create a new Sage connection.

        Tokens must be pre-encrypted by the caller (API layer handles
        encryption using Fernet before calling this method).
        """
        conn = SageConnection(
            business_id=business_id,
            company_id=company_id,
            company_name=company_name,
            access_token_encrypted=access_token_encrypted,
            refresh_token_encrypted=refresh_token_encrypted,
            token_expires_at=token_expires_at,
            status=SageConnectionStatus.CONNECTED.value,
            sync_enabled=False,
        )
        self.db.add(conn)
        self.db.commit()
        self.db.refresh(conn)
        return conn

    def update_connection_status(
        self,
        connection_id: UUID,
        status: str,
        last_sync_at: Optional[datetime] = None,
    ) -> Optional[SageConnection]:
        """Update connection status after sync or error."""
        conn = self.db.query(SageConnection).filter(
            SageConnection.id == connection_id
        ).first()
        if not conn:
            return None

        conn.status = status
        if last_sync_at:
            conn.last_sync_at = last_sync_at
        self.db.commit()
        self.db.refresh(conn)
        return conn

    def disconnect(self, business_id: UUID) -> bool:
        """Disconnect Sage by clearing tokens and setting status."""
        conn = self.get_connection(business_id)
        if not conn:
            return False

        conn.access_token_encrypted = None
        conn.refresh_token_encrypted = None
        conn.token_expires_at = None
        conn.status = SageConnectionStatus.DISCONNECTED.value
        conn.sync_enabled = False
        self.db.commit()
        return True

    def toggle_sync(self, business_id: UUID, enabled: bool) -> Optional[SageConnection]:
        """Enable or disable automatic syncing."""
        conn = self.get_connection(business_id)
        if not conn:
            return None
        conn.sync_enabled = enabled
        self.db.commit()
        self.db.refresh(conn)
        return conn

    # ------------------------------------------------------------------
    # Account mappings
    # ------------------------------------------------------------------

    def list_mappings(
        self, business_id: UUID
    ) -> List[SageAccountMapping]:
        """List all active account mappings for a business."""
        return (
            self.db.query(SageAccountMapping)
            .filter(
                SageAccountMapping.business_id == business_id,
                SageAccountMapping.is_active == True,  # noqa: E712
                SageAccountMapping.deleted_at.is_(None),
            )
            .order_by(SageAccountMapping.bizpilot_account_type)
            .all()
        )

    def save_mapping(
        self,
        business_id: UUID,
        connection_id: UUID,
        bizpilot_account_type: str,
        sage_account_id: str,
        sage_account_name: Optional[str] = None,
        bizpilot_account_id: Optional[str] = None,
        tax_code: Optional[str] = None,
    ) -> SageAccountMapping:
        """
        Create or update an account mapping.

        Upsert by business_id + bizpilot_account_type to prevent duplicates.
        """
        existing = (
            self.db.query(SageAccountMapping)
            .filter(
                SageAccountMapping.business_id == business_id,
                SageAccountMapping.bizpilot_account_type == bizpilot_account_type,
                SageAccountMapping.deleted_at.is_(None),
            )
            .first()
        )

        if existing:
            existing.sage_account_id = sage_account_id
            existing.sage_account_name = sage_account_name
            existing.bizpilot_account_id = bizpilot_account_id
            existing.tax_code = tax_code
            self.db.commit()
            self.db.refresh(existing)
            return existing

        mapping = SageAccountMapping(
            business_id=business_id,
            connection_id=connection_id,
            bizpilot_account_type=bizpilot_account_type,
            bizpilot_account_id=bizpilot_account_id,
            sage_account_id=sage_account_id,
            sage_account_name=sage_account_name,
            tax_code=tax_code,
            is_active=True,
        )
        self.db.add(mapping)
        self.db.commit()
        self.db.refresh(mapping)
        return mapping

    # ------------------------------------------------------------------
    # Sync logging
    # ------------------------------------------------------------------

    def log_sync(
        self,
        business_id: UUID,
        connection_id: UUID,
        sync_type: str,
        status: str,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        error_message: Optional[str] = None,
        request_data: Optional[dict] = None,
        response_data: Optional[dict] = None,
    ) -> SageSyncLog:
        """Record a sync operation in the audit log."""
        log = SageSyncLog(
            business_id=business_id,
            connection_id=connection_id,
            sync_type=sync_type,
            entity_type=entity_type,
            entity_id=entity_id,
            status=status,
            error_message=error_message,
            request_data=request_data,
            response_data=response_data,
        )
        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)
        return log

    def get_sync_history(
        self,
        business_id: UUID,
        page: int = 1,
        per_page: int = 20,
        status: Optional[str] = None,
    ) -> Tuple[List[SageSyncLog], int]:
        """Get sync history with optional status filter."""
        query = self.db.query(SageSyncLog).filter(
            SageSyncLog.business_id == business_id,
        )
        if status:
            query = query.filter(SageSyncLog.status == status)

        total = query.count()
        items = (
            query.order_by(SageSyncLog.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def get_error_summary(self, business_id: UUID) -> Dict[str, Any]:
        """Get summary of sync errors for the error report."""
        total_errors = (
            self.db.query(func.count(SageSyncLog.id))
            .filter(
                SageSyncLog.business_id == business_id,
                SageSyncLog.status == SageSyncStatus.FAILED.value,
            )
            .scalar()
        )
        recent_errors = (
            self.db.query(SageSyncLog)
            .filter(
                SageSyncLog.business_id == business_id,
                SageSyncLog.status == SageSyncStatus.FAILED.value,
            )
            .order_by(SageSyncLog.created_at.desc())
            .limit(10)
            .all()
        )
        return {
            "total_errors": total_errors,
            "recent_errors": [
                {
                    "id": str(e.id),
                    "sync_type": e.sync_type,
                    "entity_type": e.entity_type,
                    "error_message": e.error_message,
                    "created_at": e.created_at.isoformat() if e.created_at else None,
                }
                for e in recent_errors
            ],
        }

    # ------------------------------------------------------------------
    # Queue management
    # ------------------------------------------------------------------

    def enqueue(
        self,
        business_id: UUID,
        connection_id: UUID,
        operation_type: str,
        entity_type: str,
        entity_id: str,
        payload: dict,
        priority: int = 5,
    ) -> SageSyncQueue:
        """Add an operation to the sync retry queue."""
        item = SageSyncQueue(
            business_id=business_id,
            connection_id=connection_id,
            operation_type=operation_type,
            entity_type=entity_type,
            entity_id=entity_id,
            payload=payload,
            priority=priority,
            retry_count=0,
            max_retries=5,
            status=SageQueueStatus.PENDING.value,
        )
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def get_pending_queue_items(
        self, business_id: UUID, limit: int = 10
    ) -> List[SageSyncQueue]:
        """
        Get queue items ready for processing.

        Selects items that are pending and past their next_retry_at time,
        ordered by priority (lower = higher priority) then age.
        """
        now = datetime.now(timezone.utc)
        return (
            self.db.query(SageSyncQueue)
            .filter(
                SageSyncQueue.business_id == business_id,
                SageSyncQueue.status == SageQueueStatus.PENDING.value,
                # Either no retry scheduled, or retry time has passed
                (SageSyncQueue.next_retry_at.is_(None))
                | (SageSyncQueue.next_retry_at <= now),
            )
            .order_by(SageSyncQueue.priority.asc(), SageSyncQueue.created_at.asc())
            .limit(limit)
            .all()
        )

    def mark_queue_item_completed(self, item_id: UUID) -> bool:
        """Mark a queue item as successfully processed."""
        item = self.db.query(SageSyncQueue).filter(
            SageSyncQueue.id == item_id
        ).first()
        if not item:
            return False
        item.status = SageQueueStatus.COMPLETED.value
        self.db.commit()
        return True

    def mark_queue_item_failed(
        self, item_id: UUID, error_message: str
    ) -> Optional[SageSyncQueue]:
        """
        Mark a queue item as failed and schedule retry with backoff.

        Backoff schedule (exponential):
        retry 1: 5 min, retry 2: 15 min, retry 3: 1 hr,
        retry 4: 4 hr, retry 5: dead letter (no more retries)
        """
        item = self.db.query(SageSyncQueue).filter(
            SageSyncQueue.id == item_id
        ).first()
        if not item:
            return None

        item.retry_count += 1
        item.error_message = error_message

        if item.retry_count >= item.max_retries:
            # Move to dead letter — requires manual intervention
            item.status = SageQueueStatus.DEAD_LETTER.value
        else:
            # Exponential backoff: 5min, 15min, 60min, 240min
            backoff_minutes = [5, 15, 60, 240]
            delay = backoff_minutes[min(item.retry_count - 1, len(backoff_minutes) - 1)]
            item.next_retry_at = datetime.now(timezone.utc) + timedelta(minutes=delay)
            item.status = SageQueueStatus.PENDING.value

        self.db.commit()
        self.db.refresh(item)
        return item

    def retry_queue_item(self, item_id: UUID) -> Optional[SageSyncQueue]:
        """Reset a dead-letter item for re-processing."""
        item = self.db.query(SageSyncQueue).filter(
            SageSyncQueue.id == item_id
        ).first()
        if not item:
            return None

        item.retry_count = 0
        item.status = SageQueueStatus.PENDING.value
        item.next_retry_at = None
        item.error_message = None
        self.db.commit()
        self.db.refresh(item)
        return item
