"""Unit tests for XeroService."""
import os
os.environ.setdefault("SECRET_KEY", "test-secret-key")

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4


from app.services.xero_service import XeroService


BIZ = uuid4()
LOG_ID = uuid4()
ENTITY_ID = uuid4()

NOW = datetime(2025, 1, 15, 12, 0, 0, tzinfo=timezone.utc)


def _svc():
    db = MagicMock()
    return XeroService(db), db


def _chain(first=None, rows=None, count=0):
    q = MagicMock()
    q.filter = MagicMock(return_value=q)
    q.order_by = MagicMock(return_value=q)
    q.offset = MagicMock(return_value=q)
    q.limit = MagicMock(return_value=q)
    q.all = MagicMock(return_value=rows or [])
    q.first = MagicMock(return_value=first)
    q.count = MagicMock(return_value=count)
    return q


# ── Connection: get_connection ───────────────────────────────────────


class TestGetConnection:
    def test_returns_connection_when_found(self):
        svc, db = _svc()
        conn = MagicMock()
        db.query.return_value = _chain(first=conn)
        assert svc.get_connection(BIZ) is conn

    def test_returns_none_when_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.get_connection(BIZ) is None

    def test_queries_correct_model(self):
        from app.models.xero import XeroConnection
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        svc.get_connection(BIZ)
        db.query.assert_called_once_with(XeroConnection)


# ── Connection: create_connection ────────────────────────────────────


class TestCreateConnection:
    def test_creates_with_defaults(self):
        svc, db = _svc()
        svc.create_connection(BIZ)
        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        created = db.add.call_args[0][0]
        assert created.business_id == BIZ
        assert created.tenant_id is None
        assert created.config is None
        assert created.is_active is False
        assert created.sync_status == "idle"

    def test_creates_with_tenant_id(self):
        svc, db = _svc()
        svc.create_connection(BIZ, tenant_id="xero-tenant-abc")
        created = db.add.call_args[0][0]
        assert created.tenant_id == "xero-tenant-abc"

    def test_creates_with_config(self):
        svc, db = _svc()
        cfg = {"account_map": {"revenue": "200"}}
        svc.create_connection(BIZ, config=cfg)
        created = db.add.call_args[0][0]
        assert created.config == cfg

    def test_creates_with_all_params(self):
        svc, db = _svc()
        cfg = {"key": "val"}
        svc.create_connection(BIZ, tenant_id="t-1", config=cfg)
        created = db.add.call_args[0][0]
        assert created.business_id == BIZ
        assert created.tenant_id == "t-1"
        assert created.config == cfg

    def test_returns_refreshed_object(self):
        svc, db = _svc()
        result = svc.create_connection(BIZ)
        refreshed = db.refresh.call_args[0][0]
        assert result is refreshed


# ── Connection: update_connection ────────────────────────────────────


class TestUpdateConnection:
    @patch("app.services.xero_service._utc_now", return_value=NOW)
    def test_updates_kwargs(self, mock_now):
        svc, db = _svc()
        conn = MagicMock()
        db.query.return_value = _chain(first=conn)
        result = svc.update_connection(BIZ, is_active=True, sync_status="syncing")
        assert conn.is_active is True
        assert conn.sync_status == "syncing"
        assert conn.updated_at == NOW
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(conn)
        assert result is conn

    @patch("app.services.xero_service._utc_now", return_value=NOW)
    def test_skips_none_values(self, mock_now):
        svc, db = _svc()
        conn = MagicMock(spec=["is_active", "tenant_id", "updated_at"])
        conn.is_active = False
        conn.tenant_id = "original"
        db.query.return_value = _chain(first=conn)
        svc.update_connection(BIZ, is_active=True, tenant_id=None)
        assert conn.is_active is True
        assert conn.tenant_id == "original"

    def test_returns_none_when_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        result = svc.update_connection(BIZ, is_active=True)
        assert result is None
        db.commit.assert_not_called()

    @patch("app.services.xero_service._utc_now", return_value=NOW)
    def test_sets_updated_at(self, mock_now):
        svc, db = _svc()
        conn = MagicMock()
        db.query.return_value = _chain(first=conn)
        svc.update_connection(BIZ)
        assert conn.updated_at == NOW

    @patch("app.services.xero_service._utc_now", return_value=NOW)
    def test_single_kwarg(self, mock_now):
        svc, db = _svc()
        conn = MagicMock()
        db.query.return_value = _chain(first=conn)
        svc.update_connection(BIZ, tenant_id="new-tenant")
        assert conn.tenant_id == "new-tenant"


# ── Connection: delete_connection ────────────────────────────────────


class TestDeleteConnection:
    def test_soft_deletes_and_returns_true(self):
        svc, db = _svc()
        conn = MagicMock()
        db.query.return_value = _chain(first=conn)
        result = svc.delete_connection(BIZ)
        assert result is True
        conn.soft_delete.assert_called_once()
        db.commit.assert_called_once()

    def test_returns_false_when_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        result = svc.delete_connection(BIZ)
        assert result is False
        db.commit.assert_not_called()


# ── Sync Logs: list_sync_logs ────────────────────────────────────────


class TestListSyncLogs:
    def test_returns_items_and_total(self):
        svc, db = _svc()
        logs = [MagicMock(), MagicMock()]
        db.query.return_value = _chain(rows=logs, count=2)
        items, total = svc.list_sync_logs(BIZ)
        assert items == logs
        assert total == 2

    def test_empty_result(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[], count=0)
        items, total = svc.list_sync_logs(BIZ)
        assert items == []
        assert total == 0

    def test_entity_type_filter(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        svc.list_sync_logs(BIZ, entity_type="invoice")
        # base filter + entity_type filter = 2 filter calls
        assert chain.filter.call_count >= 2

    def test_status_filter(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        svc.list_sync_logs(BIZ, status="failed")
        assert chain.filter.call_count >= 2

    def test_both_filters(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        svc.list_sync_logs(BIZ, entity_type="payment", status="synced")
        assert chain.filter.call_count >= 3

    def test_pagination_defaults(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        svc.list_sync_logs(BIZ)
        chain.offset.assert_called_once_with(0)
        chain.limit.assert_called_once_with(50)

    def test_pagination_custom(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=100)
        db.query.return_value = chain
        svc.list_sync_logs(BIZ, page=3, per_page=10)
        chain.offset.assert_called_once_with(20)
        chain.limit.assert_called_once_with(10)

    def test_order_by_called(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        svc.list_sync_logs(BIZ)
        chain.order_by.assert_called_once()


# ── Sync Logs: get_sync_log ─────────────────────────────────────────


class TestGetSyncLog:
    def test_returns_log_when_found(self):
        svc, db = _svc()
        log = MagicMock()
        db.query.return_value = _chain(first=log)
        result = svc.get_sync_log(BIZ, "invoice", ENTITY_ID)
        assert result is log

    def test_returns_none_when_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        result = svc.get_sync_log(BIZ, "contact", ENTITY_ID)
        assert result is None

    def test_queries_correct_model(self):
        from app.models.xero import XeroSyncLog
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        svc.get_sync_log(BIZ, "invoice", ENTITY_ID)
        db.query.assert_called_once_with(XeroSyncLog)


# ── Sync Logs: create_sync_log ──────────────────────────────────────


class TestCreateSyncLog:
    def test_creates_with_defaults(self):
        svc, db = _svc()
        svc.create_sync_log(BIZ, "invoice", ENTITY_ID)
        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        created = db.add.call_args[0][0]
        assert created.business_id == BIZ
        assert created.entity_type == "invoice"
        assert created.entity_id == ENTITY_ID
        assert created.direction == "push"
        assert created.status == "pending"

    def test_creates_with_pull_direction(self):
        svc, db = _svc()
        svc.create_sync_log(BIZ, "contact", ENTITY_ID, direction="pull")
        created = db.add.call_args[0][0]
        assert created.direction == "pull"

    def test_returns_refreshed_object(self):
        svc, db = _svc()
        result = svc.create_sync_log(BIZ, "payment", ENTITY_ID)
        refreshed = db.refresh.call_args[0][0]
        assert result is refreshed


# ── Sync Logs: mark_synced ──────────────────────────────────────────


class TestMarkSynced:
    @patch("app.services.xero_service._utc_now", return_value=NOW)
    def test_marks_synced(self, mock_now):
        svc, db = _svc()
        log = MagicMock()
        db.query.return_value = _chain(first=log)
        result = svc.mark_synced(LOG_ID, "xero-inv-123")
        assert log.status == "synced"
        assert log.xero_id == "xero-inv-123"
        assert log.payload_hash is None
        assert log.synced_at == NOW
        assert log.updated_at == NOW
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(log)
        assert result is log

    @patch("app.services.xero_service._utc_now", return_value=NOW)
    def test_marks_synced_with_payload_hash(self, mock_now):
        svc, db = _svc()
        log = MagicMock()
        db.query.return_value = _chain(first=log)
        svc.mark_synced(LOG_ID, "xero-pay-1", payload_hash="abc123hash")
        assert log.payload_hash == "abc123hash"
        assert log.xero_id == "xero-pay-1"

    def test_returns_none_when_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        result = svc.mark_synced(LOG_ID, "xero-id")
        assert result is None
        db.commit.assert_not_called()


# ── Sync Logs: mark_failed ──────────────────────────────────────────


class TestMarkFailed:
    @patch("app.services.xero_service._utc_now", return_value=NOW)
    def test_marks_failed(self, mock_now):
        svc, db = _svc()
        log = MagicMock()
        db.query.return_value = _chain(first=log)
        result = svc.mark_failed(LOG_ID, "Xero API timeout")
        assert log.status == "failed"
        assert log.error_message == "Xero API timeout"
        assert log.updated_at == NOW
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(log)
        assert result is log

    def test_returns_none_when_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        result = svc.mark_failed(LOG_ID, "error")
        assert result is None
        db.commit.assert_not_called()

    @patch("app.services.xero_service._utc_now", return_value=NOW)
    def test_preserves_other_fields(self, mock_now):
        svc, db = _svc()
        log = MagicMock()
        log.xero_id = "existing-xero-id"
        db.query.return_value = _chain(first=log)
        svc.mark_failed(LOG_ID, "rate limit exceeded")
        # xero_id should not be touched
        assert log.xero_id == "existing-xero-id"
        assert log.status == "failed"
