"""Tests for ReorderSettingsService."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

from unittest.mock import MagicMock, patch, call
from uuid import uuid4

import pytest

from app.models.reorder import ProductReorderSettings, ReorderAuditLog
from app.schemas.reorder import ProductReorderSettingsCreate
from app.services.reorder_settings_service import ReorderSettingsService


# ── Helpers ──────────────────────────────────────────────────────────


def _chain(first=None, rows=None, count=0):
    """Mock SQLAlchemy query chain."""
    c = MagicMock()
    c.filter.return_value = c
    c.order_by.return_value = c
    c.offset.return_value = c
    c.limit.return_value = c
    c.all.return_value = rows if rows is not None else []
    c.first.return_value = first
    c.count.return_value = count
    return c


def _make_db():
    return MagicMock(spec=["query", "add", "flush", "commit", "refresh"])


def _make_create_data(
    product_id=None,
    reorder_point=10,
    safety_stock=5,
    par_level=20,
    eoq=50,
    auto_reorder=False,
    preferred_supplier_id=None,
):
    return ProductReorderSettingsCreate(
        product_id=product_id or str(uuid4()),
        reorder_point=reorder_point,
        safety_stock=safety_stock,
        par_level=par_level,
        eoq=eoq,
        auto_reorder=auto_reorder,
        preferred_supplier_id=preferred_supplier_id,
    )


def _make_existing_settings(product_id=None, business_id=None):
    """Build a mock ProductReorderSettings that already exists."""
    s = MagicMock(spec=ProductReorderSettings)
    s.id = uuid4()
    s.product_id = product_id or str(uuid4())
    s.business_id = business_id or str(uuid4())
    s.reorder_point = 5
    s.safety_stock = 2
    s.par_level = 15
    s.eoq = 30
    s.auto_reorder = False
    s.preferred_supplier_id = None
    s.deleted_at = None
    return s


# ── get_settings ─────────────────────────────────────────────────────


class TestGetSettings:
    def test_returns_settings_when_found(self):
        existing = _make_existing_settings()
        db = _make_db()
        db.query.return_value = _chain(first=existing)
        svc = ReorderSettingsService(db)

        result = svc.get_settings(uuid4(), uuid4())
        assert result is existing

    def test_returns_none_when_not_found(self):
        db = _make_db()
        db.query.return_value = _chain(first=None)
        svc = ReorderSettingsService(db)

        result = svc.get_settings(uuid4(), uuid4())
        assert result is None

    def test_queries_correct_model(self):
        db = _make_db()
        chain = _chain(first=None)
        db.query.return_value = chain
        svc = ReorderSettingsService(db)

        svc.get_settings(uuid4(), uuid4())
        db.query.assert_called_once_with(ProductReorderSettings)

    def test_applies_filter(self):
        db = _make_db()
        chain = _chain(first=None)
        db.query.return_value = chain
        svc = ReorderSettingsService(db)

        svc.get_settings(uuid4(), uuid4())
        assert chain.filter.called


# ── upsert_settings – create path ────────────────────────────────────


class TestUpsertCreate:
    @patch("app.services.reorder_settings_service.ReorderAuditLog")
    @patch("app.services.reorder_settings_service.ProductReorderSettings")
    @patch.object(ReorderSettingsService, "get_settings", return_value=None)
    def test_creates_new_settings(self, mock_get, MockSettings, MockAudit):
        db = _make_db()
        svc = ReorderSettingsService(db)
        data = _make_create_data()
        biz = uuid4()
        user = uuid4()

        svc.upsert_settings(data, biz, user_id=user)

        MockSettings.assert_called_once()
        kwargs = MockSettings.call_args[1]
        assert kwargs["product_id"] == data.product_id
        assert kwargs["business_id"] == biz
        assert kwargs["reorder_point"] == data.reorder_point
        assert kwargs["safety_stock"] == data.safety_stock
        assert kwargs["par_level"] == data.par_level
        assert kwargs["eoq"] == data.eoq
        assert kwargs["auto_reorder"] == data.auto_reorder
        assert kwargs["preferred_supplier_id"] == data.preferred_supplier_id

    @patch("app.services.reorder_settings_service.ReorderAuditLog")
    @patch("app.services.reorder_settings_service.ProductReorderSettings")
    @patch.object(ReorderSettingsService, "get_settings", return_value=None)
    def test_adds_settings_and_audit_to_db(self, mock_get, MockSettings, MockAudit):
        db = _make_db()
        svc = ReorderSettingsService(db)
        data = _make_create_data()
        biz = uuid4()

        svc.upsert_settings(data, biz)

        # settings + audit = 2 add calls
        assert db.add.call_count == 2
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    @patch("app.services.reorder_settings_service.ReorderAuditLog")
    @patch("app.services.reorder_settings_service.ProductReorderSettings")
    @patch.object(ReorderSettingsService, "get_settings", return_value=None)
    def test_audit_log_action_is_created(self, mock_get, MockSettings, MockAudit):
        db = _make_db()
        svc = ReorderSettingsService(db)
        data = _make_create_data()
        biz = uuid4()
        user = uuid4()

        svc.upsert_settings(data, biz, user_id=user)

        MockAudit.assert_called_once()
        audit_kwargs = MockAudit.call_args[1]
        assert audit_kwargs["action"] == "settings_created"
        assert audit_kwargs["entity_type"] == "product_reorder_settings"
        assert audit_kwargs["performed_by"] == user
        assert audit_kwargs["is_automated"] is False
        assert audit_kwargs["business_id"] == biz

    @patch("app.services.reorder_settings_service.ReorderAuditLog")
    @patch("app.services.reorder_settings_service.ProductReorderSettings")
    @patch.object(ReorderSettingsService, "get_settings", return_value=None)
    def test_audit_details_contain_product_and_thresholds(
        self, mock_get, MockSettings, MockAudit
    ):
        db = _make_db()
        svc = ReorderSettingsService(db)
        data = _make_create_data(reorder_point=10, safety_stock=5)
        biz = uuid4()

        svc.upsert_settings(data, biz)

        details = MockAudit.call_args[1]["details"]
        assert details["product_id"] == data.product_id
        assert details["reorder_point"] == 10
        assert details["safety_stock"] == 5

    @patch("app.services.reorder_settings_service.ReorderAuditLog")
    @patch("app.services.reorder_settings_service.ProductReorderSettings")
    @patch.object(ReorderSettingsService, "get_settings", return_value=None)
    def test_returns_new_settings_object(self, mock_get, MockSettings, MockAudit):
        db = _make_db()
        svc = ReorderSettingsService(db)
        data = _make_create_data()
        biz = uuid4()

        result = svc.upsert_settings(data, biz)

        assert result is MockSettings.return_value

    @patch("app.services.reorder_settings_service.ReorderAuditLog")
    @patch("app.services.reorder_settings_service.ProductReorderSettings")
    @patch.object(ReorderSettingsService, "get_settings", return_value=None)
    def test_create_without_user_id(self, mock_get, MockSettings, MockAudit):
        db = _make_db()
        svc = ReorderSettingsService(db)
        data = _make_create_data()
        biz = uuid4()

        svc.upsert_settings(data, biz)

        audit_kwargs = MockAudit.call_args[1]
        assert audit_kwargs["performed_by"] is None


# ── upsert_settings – update path ────────────────────────────────────


class TestUpsertUpdate:
    @patch("app.services.reorder_settings_service.ReorderAuditLog")
    def test_updates_existing_fields(self, MockAudit):
        existing = _make_existing_settings()
        db = _make_db()
        svc = ReorderSettingsService(db)
        data = _make_create_data(reorder_point=99, safety_stock=50, par_level=200, eoq=100, auto_reorder=True)
        biz = uuid4()

        with patch.object(svc, "get_settings", return_value=existing):
            svc.upsert_settings(data, biz)

        assert existing.reorder_point == 99
        assert existing.safety_stock == 50
        assert existing.par_level == 200
        assert existing.eoq == 100
        assert existing.auto_reorder is True

    @patch("app.services.reorder_settings_service.ReorderAuditLog")
    def test_does_not_add_existing_settings_to_session(self, MockAudit):
        """Update path should not call db.add for the settings object."""
        existing = _make_existing_settings()
        db = _make_db()
        svc = ReorderSettingsService(db)
        data = _make_create_data()
        biz = uuid4()

        with patch.object(svc, "get_settings", return_value=existing):
            svc.upsert_settings(data, biz)

        # Only audit log should be added (1 call), not the existing settings
        assert db.add.call_count == 1

    @patch("app.services.reorder_settings_service.ReorderAuditLog")
    def test_audit_log_action_is_updated(self, MockAudit):
        existing = _make_existing_settings()
        db = _make_db()
        svc = ReorderSettingsService(db)
        data = _make_create_data()
        biz = uuid4()
        user = uuid4()

        with patch.object(svc, "get_settings", return_value=existing):
            svc.upsert_settings(data, biz, user_id=user)

        audit_kwargs = MockAudit.call_args[1]
        assert audit_kwargs["action"] == "settings_updated"

    @patch("app.services.reorder_settings_service.ReorderAuditLog")
    def test_preferred_supplier_updated_when_truthy(self, MockAudit):
        existing = _make_existing_settings()
        existing.preferred_supplier_id = None
        supplier_id = str(uuid4())
        db = _make_db()
        svc = ReorderSettingsService(db)
        data = _make_create_data(preferred_supplier_id=supplier_id)
        biz = uuid4()

        with patch.object(svc, "get_settings", return_value=existing):
            svc.upsert_settings(data, biz)

        assert existing.preferred_supplier_id == supplier_id

    @patch("app.services.reorder_settings_service.ReorderAuditLog")
    def test_preferred_supplier_not_overwritten_when_falsy(self, MockAudit):
        existing = _make_existing_settings()
        original_supplier = str(uuid4())
        existing.preferred_supplier_id = original_supplier
        db = _make_db()
        svc = ReorderSettingsService(db)
        data = _make_create_data(preferred_supplier_id=None)
        biz = uuid4()

        with patch.object(svc, "get_settings", return_value=existing):
            svc.upsert_settings(data, biz)

        assert existing.preferred_supplier_id == original_supplier

    @patch("app.services.reorder_settings_service.ReorderAuditLog")
    def test_returns_existing_settings_object(self, MockAudit):
        existing = _make_existing_settings()
        db = _make_db()
        svc = ReorderSettingsService(db)
        data = _make_create_data()
        biz = uuid4()

        with patch.object(svc, "get_settings", return_value=existing):
            result = svc.upsert_settings(data, biz)

        assert result is existing

    @patch("app.services.reorder_settings_service.ReorderAuditLog")
    def test_commits_and_refreshes(self, MockAudit):
        existing = _make_existing_settings()
        db = _make_db()
        svc = ReorderSettingsService(db)
        data = _make_create_data()
        biz = uuid4()

        with patch.object(svc, "get_settings", return_value=existing):
            svc.upsert_settings(data, biz)

        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(existing)


# ── bulk_update ──────────────────────────────────────────────────────


class TestBulkUpdate:
    def test_calls_upsert_for_each_item(self):
        db = _make_db()
        svc = ReorderSettingsService(db)
        biz = uuid4()
        user = uuid4()
        items = [_make_create_data() for _ in range(3)]

        with patch.object(svc, "upsert_settings", return_value=MagicMock()) as mock_upsert:
            svc.bulk_update(items, biz, user_id=user)

            assert mock_upsert.call_count == 3
            for i, item in enumerate(items):
                mock_upsert.assert_any_call(item, biz, user)

    def test_returns_list_of_results(self):
        db = _make_db()
        svc = ReorderSettingsService(db)
        biz = uuid4()
        items = [_make_create_data() for _ in range(2)]
        mock_results = [MagicMock(), MagicMock()]

        with patch.object(svc, "upsert_settings", side_effect=mock_results):
            results = svc.bulk_update(items, biz)

        assert len(results) == 2
        assert results[0] is mock_results[0]
        assert results[1] is mock_results[1]

    def test_empty_list_returns_empty(self):
        db = _make_db()
        svc = ReorderSettingsService(db)
        biz = uuid4()

        with patch.object(svc, "upsert_settings") as mock_upsert:
            results = svc.bulk_update([], biz)

        assert results == []
        mock_upsert.assert_not_called()

    def test_passes_user_id_none_by_default(self):
        db = _make_db()
        svc = ReorderSettingsService(db)
        biz = uuid4()
        items = [_make_create_data()]

        with patch.object(svc, "upsert_settings", return_value=MagicMock()) as mock_upsert:
            svc.bulk_update(items, biz)

            mock_upsert.assert_called_once_with(items[0], biz, None)


# ── list_settings ────────────────────────────────────────────────────


class TestListSettings:
    def test_returns_items_and_total(self):
        biz = uuid4()
        s1 = _make_existing_settings()
        s2 = _make_existing_settings()

        db = _make_db()
        db.query.return_value = _chain(rows=[s1, s2], count=2)
        svc = ReorderSettingsService(db)

        items, total = svc.list_settings(biz)
        assert items == [s1, s2]
        assert total == 2

    def test_empty_result(self):
        db = _make_db()
        db.query.return_value = _chain(rows=[], count=0)
        svc = ReorderSettingsService(db)

        items, total = svc.list_settings(uuid4())
        assert items == []
        assert total == 0

    def test_pagination_offset_and_limit(self):
        db = _make_db()
        chain = _chain(rows=[], count=10)
        db.query.return_value = chain
        svc = ReorderSettingsService(db)

        svc.list_settings(uuid4(), page=3, per_page=5)
        chain.offset.assert_called_with(10)  # (3-1)*5
        chain.limit.assert_called_with(5)

    def test_default_pagination(self):
        db = _make_db()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        svc = ReorderSettingsService(db)

        svc.list_settings(uuid4())
        chain.offset.assert_called_with(0)  # (1-1)*20
        chain.limit.assert_called_with(20)

    def test_queries_correct_model(self):
        db = _make_db()
        db.query.return_value = _chain()
        svc = ReorderSettingsService(db)

        svc.list_settings(uuid4())
        db.query.assert_called_once_with(ProductReorderSettings)

    def test_orders_by_created_at_desc(self):
        db = _make_db()
        chain = _chain()
        db.query.return_value = chain
        svc = ReorderSettingsService(db)

        svc.list_settings(uuid4())
        chain.order_by.assert_called_once()
