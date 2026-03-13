"""Unit tests for SageService."""
import os
os.environ.setdefault("SECRET_KEY", "test-secret-key")

from datetime import datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4


from app.services.sage_service import SageService
from app.models.sage import SageConnectionStatus, SageQueueStatus


BIZ = uuid4()
CONN = uuid4()
ITEM = uuid4()


def _svc():
    db = MagicMock()
    return SageService(db), db


def _chain(first=None, rows=None, count=0, scalar=None):
    c = MagicMock()
    c.filter.return_value = c
    c.order_by.return_value = c
    c.offset.return_value = c
    c.limit.return_value = c
    c.all.return_value = rows if rows is not None else []
    c.first.return_value = first
    c.count.return_value = count
    c.scalar.return_value = scalar
    return c


# ── Connection management ────────────────────────────────────────────


class TestConnection:
    def test_get(self):
        svc, db = _svc()
        conn = MagicMock()
        db.query.return_value = _chain(first=conn)
        assert svc.get_connection(BIZ) == conn

    def test_get_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.get_connection(BIZ) is None

    def test_create(self):
        svc, db = _svc()
        svc.create_connection(BIZ, company_id="sage-123")
        db.add.assert_called_once()
        db.commit.assert_called()

    def test_update_status(self):
        svc, db = _svc()
        conn = MagicMock()
        db.query.return_value = _chain(first=conn)
        result = svc.update_connection_status(CONN, "syncing")
        assert result.status == "syncing"

    def test_update_status_with_sync_time(self):
        svc, db = _svc()
        conn = MagicMock()
        db.query.return_value = _chain(first=conn)
        now = datetime.now(timezone.utc)
        svc.update_connection_status(CONN, "connected", last_sync_at=now)
        assert conn.last_sync_at == now

    def test_update_status_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.update_connection_status(CONN, "x") is None

    def test_disconnect(self):
        svc, db = _svc()
        conn = MagicMock()
        db.query.return_value = _chain(first=conn)
        assert svc.disconnect(BIZ) is True
        assert conn.access_token_encrypted is None
        assert conn.status == SageConnectionStatus.DISCONNECTED.value

    def test_disconnect_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.disconnect(BIZ) is False

    def test_toggle_sync(self):
        svc, db = _svc()
        conn = MagicMock()
        db.query.return_value = _chain(first=conn)
        result = svc.toggle_sync(BIZ, True)
        assert result.sync_enabled is True

    def test_toggle_sync_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.toggle_sync(BIZ, True) is None


# ── Mappings ─────────────────────────────────────────────────────────


class TestMappings:
    def test_list(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[MagicMock()])
        result = svc.list_mappings(BIZ)
        assert len(result) == 1

    def test_save_new(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        svc.save_mapping(BIZ, CONN, "revenue", "sage-acc-1")
        db.add.assert_called_once()

    def test_save_update(self):
        svc, db = _svc()
        existing = MagicMock()
        db.query.return_value = _chain(first=existing)
        result = svc.save_mapping(BIZ, CONN, "revenue", "sage-acc-2")
        assert result.sage_account_id == "sage-acc-2"
        db.add.assert_not_called()


# ── Sync logging ─────────────────────────────────────────────────────


class TestSyncLog:
    def test_log(self):
        svc, db = _svc()
        svc.log_sync(BIZ, CONN, "full", "success")
        db.add.assert_called_once()

    def test_get_history(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[MagicMock()], count=1)
        items, total = svc.get_sync_history(BIZ)
        assert total == 1

    def test_get_history_filtered(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        svc.get_sync_history(BIZ, status="failed")
        assert chain.filter.call_count >= 1

    def test_error_summary(self):
        svc, db = _svc()
        err = MagicMock()
        err.id = uuid4()
        err.sync_type = "invoice"
        err.entity_type = "invoice"
        err.error_message = "timeout"
        err.created_at = datetime.now(timezone.utc)
        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(scalar=5)
            return _chain(rows=[err])
        db.query.side_effect = side_effect
        result = svc.get_error_summary(BIZ)
        assert result["total_errors"] == 5
        assert len(result["recent_errors"]) == 1


# ── Queue management ─────────────────────────────────────────────────


class TestQueue:
    def test_enqueue(self):
        svc, db = _svc()
        svc.enqueue(BIZ, CONN, "create", "invoice", "inv-1", {"total": 100})
        db.add.assert_called_once()

    def test_get_pending(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[MagicMock()])
        result = svc.get_pending_queue_items(BIZ)
        assert len(result) == 1

    def test_mark_completed(self):
        svc, db = _svc()
        item = MagicMock()
        db.query.return_value = _chain(first=item)
        assert svc.mark_queue_item_completed(ITEM) is True
        assert item.status == SageQueueStatus.COMPLETED.value

    def test_mark_completed_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.mark_queue_item_completed(ITEM) is False

    def test_mark_failed_retry(self):
        svc, db = _svc()
        item = MagicMock()
        item.retry_count = 0
        item.max_retries = 5
        db.query.return_value = _chain(first=item)
        result = svc.mark_queue_item_failed(ITEM, "timeout")
        assert result.retry_count == 1
        assert result.status == SageQueueStatus.PENDING.value
        assert result.next_retry_at is not None

    def test_mark_failed_dead_letter(self):
        svc, db = _svc()
        item = MagicMock()
        item.retry_count = 4
        item.max_retries = 5
        db.query.return_value = _chain(first=item)
        result = svc.mark_queue_item_failed(ITEM, "fatal")
        assert result.status == SageQueueStatus.DEAD_LETTER.value

    def test_mark_failed_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.mark_queue_item_failed(ITEM, "err") is None

    def test_retry_item(self):
        svc, db = _svc()
        item = MagicMock()
        db.query.return_value = _chain(first=item)
        result = svc.retry_queue_item(ITEM)
        assert result.retry_count == 0
        assert result.status == SageQueueStatus.PENDING.value

    def test_retry_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.retry_queue_item(ITEM) is None
