"""Unit tests for SyncQueueService.

Tests cover:
- Queue operations: enqueue, list_pending, mark_completed, mark_failed, retry_failed
- Sync metadata: get_metadata, update_metadata, list_metadata
- Edge cases: not-found items, None attempts, device_id filtering
"""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch, call

import pytest

from app.models.sync_queue import SyncQueueItem, SyncMetadata
from app.services.sync_queue_service import SyncQueueService


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

BIZ = uuid.uuid4()
DEVICE = uuid.uuid4()
ENTITY_ID = uuid.uuid4()
ITEM_ID = uuid.uuid4()


def _svc():
    db = MagicMock()
    return SyncQueueService(db), db


def _chain(first=None, rows=None, count=0):
    """Return a chainable mock that mimics a SQLAlchemy query."""
    q = MagicMock()
    q.filter = MagicMock(return_value=q)
    q.order_by = MagicMock(return_value=q)
    q.offset = MagicMock(return_value=q)
    q.limit = MagicMock(return_value=q)
    q.all = MagicMock(return_value=rows or [])
    q.first = MagicMock(return_value=first)
    q.count = MagicMock(return_value=count)
    q.update = MagicMock(return_value=count)
    return q


def _mock_queue_item(**overrides):
    item = MagicMock(spec=SyncQueueItem)
    item.id = overrides.get("id", ITEM_ID)
    item.business_id = overrides.get("business_id", BIZ)
    item.device_id = overrides.get("device_id", None)
    item.entity_type = overrides.get("entity_type", "product")
    item.entity_id = overrides.get("entity_id", ENTITY_ID)
    item.action = overrides.get("action", "create")
    item.payload = overrides.get("payload", {"name": "Widget"})
    item.status = overrides.get("status", "pending")
    item.processed_at = overrides.get("processed_at", None)
    item.last_error = overrides.get("last_error", None)
    item.attempts = overrides.get("attempts", 0)
    item.created_at = overrides.get("created_at", datetime.now(timezone.utc))
    return item


def _mock_metadata(**overrides):
    meta = MagicMock(spec=SyncMetadata)
    meta.id = overrides.get("id", uuid.uuid4())
    meta.business_id = overrides.get("business_id", BIZ)
    meta.device_id = overrides.get("device_id", None)
    meta.entity_type = overrides.get("entity_type", "product")
    meta.last_sync_at = overrides.get("last_sync_at", datetime.now(timezone.utc))
    meta.last_sync_status = overrides.get("last_sync_status", "completed")
    meta.records_synced = overrides.get("records_synced", 10)
    return meta


# ══════════════════════════════════════════════════════════════════════════════
# Queue Operations – enqueue
# ══════════════════════════════════════════════════════════════════════════════


class TestEnqueue:
    """Tests for SyncQueueService.enqueue."""

    def test_enqueue_creates_item_with_pending_status(self):
        svc, db = _svc()
        result = svc.enqueue(
            business_id=str(BIZ),
            entity_type="product",
            entity_id=str(ENTITY_ID),
            action="create",
            payload={"name": "Widget"},
        )
        db.add.assert_called_once()
        added_item = db.add.call_args[0][0]
        assert isinstance(added_item, SyncQueueItem)
        assert added_item.status == "pending"
        assert added_item.business_id == str(BIZ)
        assert added_item.entity_type == "product"
        assert added_item.entity_id == str(ENTITY_ID)
        assert added_item.action == "create"
        assert added_item.payload == {"name": "Widget"}
        assert added_item.device_id is None

    def test_enqueue_commits_and_refreshes(self):
        svc, db = _svc()
        result = svc.enqueue(
            business_id=str(BIZ),
            entity_type="order",
            entity_id=str(ENTITY_ID),
            action="update",
            payload={"total": 100},
        )
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    def test_enqueue_with_device_id(self):
        svc, db = _svc()
        result = svc.enqueue(
            business_id=str(BIZ),
            entity_type="product",
            entity_id=str(ENTITY_ID),
            action="create",
            payload={"name": "Gadget"},
            device_id=str(DEVICE),
        )
        added_item = db.add.call_args[0][0]
        assert added_item.device_id == str(DEVICE)

    def test_enqueue_returns_item(self):
        svc, db = _svc()
        result = svc.enqueue(
            business_id=str(BIZ),
            entity_type="product",
            entity_id=str(ENTITY_ID),
            action="delete",
            payload={},
        )
        assert isinstance(result, SyncQueueItem)


# ══════════════════════════════════════════════════════════════════════════════
# Queue Operations – list_pending
# ══════════════════════════════════════════════════════════════════════════════


class TestListPending:
    """Tests for SyncQueueService.list_pending."""

    def test_list_pending_returns_items_and_total(self):
        svc, db = _svc()
        items = [_mock_queue_item(), _mock_queue_item()]
        db.query.return_value = _chain(rows=items, count=2)

        result_items, total = svc.list_pending(str(BIZ))
        assert result_items == items
        assert total == 2

    def test_list_pending_with_entity_type_filter(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.list_pending(str(BIZ), entity_type="order")
        # filter is called for business_id+status, then again for entity_type
        assert chain.filter.call_count >= 2

    def test_list_pending_without_entity_type_filter(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.list_pending(str(BIZ))
        # filter called once for business_id+status, no extra filter for entity_type
        assert chain.filter.call_count == 1

    def test_list_pending_pagination_defaults(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.list_pending(str(BIZ))
        chain.offset.assert_called_once_with(0)   # (1-1)*50
        chain.limit.assert_called_once_with(50)

    def test_list_pending_pagination_custom(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=100)
        db.query.return_value = chain

        svc.list_pending(str(BIZ), page=3, per_page=20)
        chain.offset.assert_called_once_with(40)   # (3-1)*20
        chain.limit.assert_called_once_with(20)

    def test_list_pending_empty(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[], count=0)

        items, total = svc.list_pending(str(BIZ))
        assert items == []
        assert total == 0


# ══════════════════════════════════════════════════════════════════════════════
# Queue Operations – mark_completed
# ══════════════════════════════════════════════════════════════════════════════


class TestMarkCompleted:
    """Tests for SyncQueueService.mark_completed."""

    def test_mark_completed_sets_status_and_processed_at(self):
        svc, db = _svc()
        item = _mock_queue_item(status="pending")
        db.query.return_value = _chain(first=item)

        result = svc.mark_completed(str(ITEM_ID))
        assert item.status == "completed"
        assert item.processed_at is not None
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(item)
        assert result is item

    def test_mark_completed_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.mark_completed(str(uuid.uuid4()))
        assert result is None
        db.commit.assert_not_called()

    def test_mark_completed_processed_at_is_utc(self):
        svc, db = _svc()
        item = _mock_queue_item()
        db.query.return_value = _chain(first=item)

        svc.mark_completed(str(ITEM_ID))
        assert item.processed_at.tzinfo is not None


# ══════════════════════════════════════════════════════════════════════════════
# Queue Operations – mark_failed
# ══════════════════════════════════════════════════════════════════════════════


class TestMarkFailed:
    """Tests for SyncQueueService.mark_failed."""

    def test_mark_failed_sets_status_and_error(self):
        svc, db = _svc()
        item = _mock_queue_item(status="pending", attempts=0)
        db.query.return_value = _chain(first=item)

        result = svc.mark_failed(str(ITEM_ID), "Connection timeout")
        assert item.status == "failed"
        assert item.last_error == "Connection timeout"
        assert item.attempts == 1
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(item)
        assert result is item

    def test_mark_failed_increments_attempts(self):
        svc, db = _svc()
        item = _mock_queue_item(attempts=2)
        db.query.return_value = _chain(first=item)

        svc.mark_failed(str(ITEM_ID), "Server error")
        assert item.attempts == 3

    def test_mark_failed_none_attempts_becomes_one(self):
        svc, db = _svc()
        item = _mock_queue_item(attempts=None)
        db.query.return_value = _chain(first=item)

        svc.mark_failed(str(ITEM_ID), "First failure")
        assert item.attempts == 1

    def test_mark_failed_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.mark_failed(str(uuid.uuid4()), "error")
        assert result is None
        db.commit.assert_not_called()


# ══════════════════════════════════════════════════════════════════════════════
# Queue Operations – retry_failed
# ══════════════════════════════════════════════════════════════════════════════


class TestRetryFailed:
    """Tests for SyncQueueService.retry_failed."""

    def test_retry_failed_returns_updated_count(self):
        svc, db = _svc()
        chain = _chain(count=5)
        db.query.return_value = chain

        result = svc.retry_failed(str(BIZ))
        assert result == 5
        chain.update.assert_called_once_with({"status": "pending", "last_error": None})
        db.commit.assert_called_once()

    def test_retry_failed_no_failed_items(self):
        svc, db = _svc()
        chain = _chain(count=0)
        db.query.return_value = chain

        result = svc.retry_failed(str(BIZ))
        assert result == 0
        db.commit.assert_called_once()


# ══════════════════════════════════════════════════════════════════════════════
# Sync Metadata – get_metadata
# ══════════════════════════════════════════════════════════════════════════════


class TestGetMetadata:
    """Tests for SyncQueueService.get_metadata."""

    def test_get_metadata_found(self):
        svc, db = _svc()
        meta = _mock_metadata()
        db.query.return_value = _chain(first=meta)

        result = svc.get_metadata(str(BIZ), "product")
        assert result is meta

    def test_get_metadata_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.get_metadata(str(BIZ), "product")
        assert result is None

    def test_get_metadata_with_device_id(self):
        svc, db = _svc()
        chain = _chain(first=_mock_metadata(device_id=DEVICE))
        db.query.return_value = chain

        result = svc.get_metadata(str(BIZ), "product", device_id=str(DEVICE))
        assert result is not None
        # filter is called: once for business_id+entity_type, once for device_id
        assert chain.filter.call_count >= 2

    def test_get_metadata_without_device_id_filters_null(self):
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        svc.get_metadata(str(BIZ), "product", device_id=None)
        # filter is called: once for business_id+entity_type, once for device_id IS NULL
        assert chain.filter.call_count >= 2


# ══════════════════════════════════════════════════════════════════════════════
# Sync Metadata – update_metadata
# ══════════════════════════════════════════════════════════════════════════════


class TestUpdateMetadata:
    """Tests for SyncQueueService.update_metadata."""

    def test_update_metadata_existing_record(self):
        svc, db = _svc()
        existing = _mock_metadata(records_synced=10, last_sync_status="completed")
        db.query.return_value = _chain(first=existing)

        result = svc.update_metadata(str(BIZ), "product", records_synced=5)
        assert existing.last_sync_status == "completed"
        assert existing.records_synced == 15  # 10 + 5
        assert existing.last_sync_at is not None
        db.add.assert_not_called()
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(existing)

    def test_update_metadata_existing_none_records(self):
        svc, db = _svc()
        existing = _mock_metadata(records_synced=None)
        db.query.return_value = _chain(first=existing)

        result = svc.update_metadata(str(BIZ), "product", records_synced=7)
        assert existing.records_synced == 7  # (None or 0) + 7

    def test_update_metadata_creates_new_when_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.update_metadata(str(BIZ), "order", records_synced=3)
        db.add.assert_called_once()
        added = db.add.call_args[0][0]
        assert isinstance(added, SyncMetadata)
        assert added.business_id == str(BIZ)
        assert added.entity_type == "order"
        assert added.records_synced == 3
        assert added.last_sync_status == "completed"
        db.commit.assert_called_once()

    def test_update_metadata_creates_new_with_device_id(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        svc.update_metadata(str(BIZ), "product", records_synced=2, device_id=str(DEVICE))
        added = db.add.call_args[0][0]
        assert added.device_id == str(DEVICE)

    def test_update_metadata_custom_status(self):
        svc, db = _svc()
        existing = _mock_metadata(records_synced=5)
        db.query.return_value = _chain(first=existing)

        svc.update_metadata(str(BIZ), "product", records_synced=1, status="partial")
        assert existing.last_sync_status == "partial"

    def test_update_metadata_default_status_is_completed(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        svc.update_metadata(str(BIZ), "product", records_synced=1)
        added = db.add.call_args[0][0]
        assert added.last_sync_status == "completed"


# ══════════════════════════════════════════════════════════════════════════════
# Sync Metadata – list_metadata
# ══════════════════════════════════════════════════════════════════════════════


class TestListMetadata:
    """Tests for SyncQueueService.list_metadata."""

    def test_list_metadata_returns_items(self):
        svc, db = _svc()
        metas = [_mock_metadata(entity_type="customer"), _mock_metadata(entity_type="product")]
        db.query.return_value = _chain(rows=metas)

        result = svc.list_metadata(str(BIZ))
        assert result == metas
        assert len(result) == 2

    def test_list_metadata_empty(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[])

        result = svc.list_metadata(str(BIZ))
        assert result == []

    def test_list_metadata_calls_order_by(self):
        svc, db = _svc()
        chain = _chain(rows=[])
        db.query.return_value = chain

        svc.list_metadata(str(BIZ))
        chain.order_by.assert_called_once()
