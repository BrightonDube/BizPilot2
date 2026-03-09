"""Unit tests for WooCommerceService."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch, call

import pytest

from app.services.woocommerce_service import WooCommerceService

FAKE_NOW = datetime(2025, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
UTC_PATCH = "app.services.woocommerce_service._utc_now"


# ── helpers ──────────────────────────────────────────────────────────

def _svc():
    db = MagicMock()
    return WooCommerceService(db), db


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


def _uid():
    return uuid.uuid4()


# ── Connection tests ─────────────────────────────────────────────────


class TestGetConnection:
    def test_returns_connection_when_found(self):
        conn = MagicMock()
        svc, db = _svc()
        db.query.return_value = _chain(first=conn)

        result = svc.get_connection(_uid())

        assert result is conn
        db.query.assert_called_once()

    def test_returns_none_when_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.get_connection(_uid())

        assert result is None

    def test_applies_business_id_and_deleted_at_filter(self):
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        svc.get_connection(_uid())

        chain.filter.assert_called_once()
        assert chain.first.call_count == 1


class TestCreateConnection:
    def test_creates_and_returns_connection(self):
        svc, db = _svc()
        bid = _uid()

        result = svc.create_connection(bid, "https://shop.example.com")

        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        created = db.add.call_args[0][0]
        assert created.business_id == bid
        assert created.store_url == "https://shop.example.com"
        assert created.is_active is False
        assert created.sync_status == "idle"
        assert created.config is None
        assert result is created

    def test_passes_config_when_provided(self):
        svc, db = _svc()
        cfg = {"direction": "push"}

        svc.create_connection(_uid(), "https://shop.example.com", config=cfg)

        created = db.add.call_args[0][0]
        assert created.config == cfg

    def test_config_defaults_to_none(self):
        svc, db = _svc()

        svc.create_connection(_uid(), "https://shop.example.com")

        created = db.add.call_args[0][0]
        assert created.config is None


class TestUpdateConnection:
    @patch(UTC_PATCH, return_value=FAKE_NOW)
    def test_updates_attributes_and_timestamp(self, mock_now):
        conn = MagicMock()
        svc, db = _svc()
        db.query.return_value = _chain(first=conn)

        result = svc.update_connection(_uid(), store_url="https://new.example.com", is_active=True)

        assert result is conn
        assert conn.store_url == "https://new.example.com"
        assert conn.is_active is True
        assert conn.updated_at == FAKE_NOW
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(conn)

    @patch(UTC_PATCH, return_value=FAKE_NOW)
    def test_skips_none_values(self, mock_now):
        conn = MagicMock(spec=[])
        svc, db = _svc()
        db.query.return_value = _chain(first=conn)

        svc.update_connection(_uid(), store_url=None, is_active=True)

        assert not hasattr(conn, "store_url")
        assert conn.is_active is True

    def test_returns_none_when_connection_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.update_connection(_uid(), store_url="https://new.example.com")

        assert result is None
        db.commit.assert_not_called()

    @patch(UTC_PATCH, return_value=FAKE_NOW)
    def test_with_no_kwargs(self, mock_now):
        conn = MagicMock()
        svc, db = _svc()
        db.query.return_value = _chain(first=conn)

        result = svc.update_connection(_uid())

        assert result is conn
        assert conn.updated_at == FAKE_NOW
        db.commit.assert_called_once()


class TestDeleteConnection:
    def test_soft_deletes_and_returns_true(self):
        conn = MagicMock()
        svc, db = _svc()
        db.query.return_value = _chain(first=conn)

        result = svc.delete_connection(_uid())

        assert result is True
        conn.soft_delete.assert_called_once()
        db.commit.assert_called_once()

    def test_returns_false_when_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.delete_connection(_uid())

        assert result is False
        db.commit.assert_not_called()


# ── Sync Map tests ───────────────────────────────────────────────────


class TestListSyncMaps:
    def test_returns_items_and_total(self):
        rows = [MagicMock(), MagicMock()]
        svc, db = _svc()
        db.query.return_value = _chain(rows=rows, count=2)

        items, total = svc.list_sync_maps(_uid())

        assert items == rows
        assert total == 2

    def test_applies_entity_type_filter(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.list_sync_maps(_uid(), entity_type="product")

        # Initial filter + entity_type filter = 2 filter calls
        assert chain.filter.call_count == 2

    def test_applies_status_filter(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.list_sync_maps(_uid(), status="synced")

        assert chain.filter.call_count == 2

    def test_applies_both_filters(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.list_sync_maps(_uid(), entity_type="order", status="failed")

        assert chain.filter.call_count == 3

    def test_no_optional_filters(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.list_sync_maps(_uid())

        # Only the base filter
        assert chain.filter.call_count == 1

    def test_pagination_offset_and_limit(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=100)
        db.query.return_value = chain

        svc.list_sync_maps(_uid(), page=3, per_page=10)

        chain.offset.assert_called_once_with(20)
        chain.limit.assert_called_once_with(10)

    def test_first_page_offset_is_zero(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=5)
        db.query.return_value = chain

        svc.list_sync_maps(_uid(), page=1, per_page=50)

        chain.offset.assert_called_once_with(0)
        chain.limit.assert_called_once_with(50)

    def test_order_by_is_called(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.list_sync_maps(_uid())

        chain.order_by.assert_called_once()

    def test_empty_results(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[], count=0)

        items, total = svc.list_sync_maps(_uid())

        assert items == []
        assert total == 0


class TestGetSyncMap:
    def test_returns_sync_map_when_found(self):
        entry = MagicMock()
        svc, db = _svc()
        db.query.return_value = _chain(first=entry)

        result = svc.get_sync_map(_uid(), "product", _uid())

        assert result is entry

    def test_returns_none_when_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.get_sync_map(_uid(), "product", _uid())

        assert result is None

    def test_filter_is_called(self):
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        svc.get_sync_map(_uid(), "order", _uid())

        chain.filter.assert_called_once()


class TestCreateSyncMap:
    def test_creates_with_default_direction(self):
        svc, db = _svc()
        bid = _uid()
        bpid = _uid()

        result = svc.create_sync_map(bid, "product", bpid)

        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        entry = db.add.call_args[0][0]
        assert entry.business_id == bid
        assert entry.entity_type == "product"
        assert entry.bizpilot_id == bpid
        assert entry.direction == "push"
        assert entry.status == "pending"
        assert result is entry

    def test_creates_with_custom_direction(self):
        svc, db = _svc()

        svc.create_sync_map(_uid(), "order", _uid(), direction="pull")

        entry = db.add.call_args[0][0]
        assert entry.direction == "pull"

    def test_status_always_pending(self):
        svc, db = _svc()

        svc.create_sync_map(_uid(), "customer", _uid())

        entry = db.add.call_args[0][0]
        assert entry.status == "pending"


class TestMarkSynced:
    @patch(UTC_PATCH, return_value=FAKE_NOW)
    def test_marks_entry_as_synced(self, mock_now):
        entry = MagicMock()
        svc, db = _svc()
        db.query.return_value = _chain(first=entry)
        mid = _uid()

        result = svc.mark_synced(mid, "woo-123", payload_hash="abc123")

        assert result is entry
        assert entry.status == "synced"
        assert entry.woo_id == "woo-123"
        assert entry.payload_hash == "abc123"
        assert entry.last_synced_at == FAKE_NOW
        assert entry.updated_at == FAKE_NOW
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(entry)

    @patch(UTC_PATCH, return_value=FAKE_NOW)
    def test_payload_hash_defaults_to_none(self, mock_now):
        entry = MagicMock()
        svc, db = _svc()
        db.query.return_value = _chain(first=entry)

        svc.mark_synced(_uid(), "woo-456")

        assert entry.payload_hash is None

    def test_returns_none_when_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.mark_synced(_uid(), "woo-789")

        assert result is None
        db.commit.assert_not_called()


class TestMarkFailed:
    @patch(UTC_PATCH, return_value=FAKE_NOW)
    def test_marks_entry_as_failed(self, mock_now):
        entry = MagicMock()
        svc, db = _svc()
        db.query.return_value = _chain(first=entry)

        result = svc.mark_failed(_uid(), "Connection timeout")

        assert result is entry
        assert entry.status == "failed"
        assert entry.error_message == "Connection timeout"
        assert entry.updated_at == FAKE_NOW
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(entry)

    def test_returns_none_when_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.mark_failed(_uid(), "Some error")

        assert result is None
        db.commit.assert_not_called()

    @patch(UTC_PATCH, return_value=FAKE_NOW)
    def test_preserves_error_message_text(self, mock_now):
        entry = MagicMock()
        svc, db = _svc()
        db.query.return_value = _chain(first=entry)
        long_msg = "Error: " + "x" * 500

        svc.mark_failed(_uid(), long_msg)

        assert entry.error_message == long_msg
