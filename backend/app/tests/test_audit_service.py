"""Unit tests for AuditService.

Tests cover:
- log_action (create entry, metadata serialisation, optional fields)
- get_user_activity (pagination, filtering by user/action/resource/dates)
- get_login_history (basic, user filter, pagination)
- get_activity_summary (grouped counts, date filters, null-user label)
- export_activity_csv (row mapping, empty result, date filters)
"""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

import json
import uuid
from datetime import datetime
from unittest.mock import MagicMock


from app.models.audit_log import AuditAction, UserAuditLog
from app.services.audit_service import AuditService


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

BIZ = str(uuid.uuid4())
USER = str(uuid.uuid4())


def _svc():
    db = MagicMock()
    return AuditService(db), db


def _chain(first=None, rows=None, count=0):
    """Return a chainable mock that mimics a SQLAlchemy query."""
    c = MagicMock()
    c.filter.return_value = c
    c.join.return_value = c
    c.order_by.return_value = c
    c.offset.return_value = c
    c.limit.return_value = c
    c.with_entities.return_value = c
    c.group_by.return_value = c
    c.all.return_value = rows if rows is not None else []
    c.first.return_value = first
    c.count.return_value = count
    c.scalar.return_value = None
    return c


def _mock_log(**overrides):
    log = MagicMock(spec=UserAuditLog)
    log.id = overrides.get("id", uuid.uuid4())
    log.business_id = overrides.get("business_id", BIZ)
    log.user_id = overrides.get("user_id", USER)
    log.action = overrides.get("action", AuditAction.CREATE)
    log.resource_type = overrides.get("resource_type", "product")
    log.resource_id = overrides.get("resource_id", str(uuid.uuid4()))
    log.description = overrides.get("description", "Created product")
    log.ip_address = overrides.get("ip_address", "127.0.0.1")
    log.user_agent = overrides.get("user_agent", "TestAgent/1.0")
    log.metadata_json = overrides.get("metadata_json", None)
    log.created_at = overrides.get("created_at", datetime(2025, 1, 15, 10, 0, 0))
    log.deleted_at = overrides.get("deleted_at", None)
    return log


# ══════════════════════════════════════════════════════════════════════════════
# log_action
# ══════════════════════════════════════════════════════════════════════════════


class TestLogAction:
    def test_creates_entry_and_commits(self):
        svc, db = _svc()
        result = svc.log_action(
            business_id=BIZ,
            user_id=USER,
            action=AuditAction.CREATE,
            resource_type="product",
        )

        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        added = db.add.call_args[0][0]
        assert isinstance(added, UserAuditLog)
        assert result is added

    def test_metadata_serialized_to_json(self):
        svc, db = _svc()
        meta = {"key": "value", "count": 42}
        svc.log_action(
            business_id=BIZ,
            user_id=USER,
            action=AuditAction.UPDATE,
            resource_type="order",
            metadata=meta,
        )

        added = db.add.call_args[0][0]
        assert added.metadata_json == json.dumps(meta)

    def test_metadata_none_when_not_provided(self):
        svc, db = _svc()
        svc.log_action(
            business_id=BIZ,
            user_id=USER,
            action=AuditAction.VIEW,
            resource_type="dashboard",
        )

        added = db.add.call_args[0][0]
        assert added.metadata_json is None

    def test_optional_fields_set(self):
        svc, db = _svc()
        rid = str(uuid.uuid4())
        svc.log_action(
            business_id=BIZ,
            user_id=USER,
            action=AuditAction.DELETE,
            resource_type="product",
            resource_id=rid,
            description="Deleted item",
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0",
        )

        added = db.add.call_args[0][0]
        assert added.business_id == BIZ
        assert added.user_id == USER
        assert added.action == AuditAction.DELETE
        assert added.resource_type == "product"
        assert added.resource_id == rid
        assert added.description == "Deleted item"
        assert added.ip_address == "192.168.1.1"
        assert added.user_agent == "Mozilla/5.0"

    def test_user_id_optional(self):
        svc, db = _svc()
        svc.log_action(
            business_id=BIZ,
            user_id=None,
            action=AuditAction.IMPORT,
            resource_type="batch",
        )

        added = db.add.call_args[0][0]
        assert added.user_id is None


# ══════════════════════════════════════════════════════════════════════════════
# get_user_activity
# ══════════════════════════════════════════════════════════════════════════════


class TestGetUserActivity:
    def test_returns_items_and_total(self):
        svc, db = _svc()
        logs = [_mock_log(), _mock_log()]
        chain = _chain(rows=logs, count=2)
        db.query.return_value = chain

        items, total = svc.get_user_activity(BIZ)
        assert items == logs
        assert total == 2

    def test_pagination_offset(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.get_user_activity(BIZ, page=3, per_page=10)
        chain.offset.assert_called_once_with(20)
        chain.limit.assert_called_once_with(10)

    def test_filters_by_user_id(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.get_user_activity(BIZ, user_id=USER)
        # Base filter + user_id filter
        assert chain.filter.call_count >= 2

    def test_filters_by_action(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.get_user_activity(BIZ, action=AuditAction.LOGIN)
        assert chain.filter.call_count >= 2

    def test_filters_by_resource_type(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.get_user_activity(BIZ, resource_type="order")
        assert chain.filter.call_count >= 2

    def test_filters_by_date_range(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        start = datetime(2025, 1, 1)
        end = datetime(2025, 1, 31)
        svc.get_user_activity(BIZ, start_date=start, end_date=end)
        # Base filter + start_date filter + end_date filter
        assert chain.filter.call_count >= 3


# ══════════════════════════════════════════════════════════════════════════════
# get_login_history
# ══════════════════════════════════════════════════════════════════════════════


class TestGetLoginHistory:
    def test_returns_login_logout_events(self):
        svc, db = _svc()
        logs = [
            _mock_log(action=AuditAction.LOGIN),
            _mock_log(action=AuditAction.LOGOUT),
        ]
        chain = _chain(rows=logs, count=2)
        db.query.return_value = chain

        items, total = svc.get_login_history(BIZ)
        assert items == logs
        assert total == 2

    def test_filters_by_user_id(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.get_login_history(BIZ, user_id=USER)
        assert chain.filter.call_count >= 2

    def test_pagination(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.get_login_history(BIZ, page=2, per_page=15)
        chain.offset.assert_called_once_with(15)
        chain.limit.assert_called_once_with(15)


# ══════════════════════════════════════════════════════════════════════════════
# get_activity_summary
# ══════════════════════════════════════════════════════════════════════════════


class TestGetActivitySummary:
    def test_returns_summary_dict(self):
        svc, db = _svc()
        chain = _chain(count=10)
        chain.all.side_effect = [
            [(AuditAction.CREATE, 5), (AuditAction.UPDATE, 3)],  # by_action
            [(USER, 8)],                                          # by_user
            [("product", 6), ("order", 4)],                       # by_resource
        ]
        db.query.return_value = chain

        result = svc.get_activity_summary(BIZ)

        assert result["by_action"] == {"create": 5, "update": 3}
        assert result["by_user"] == {str(USER): 8}
        assert result["by_resource"] == {"product": 6, "order": 4}
        assert result["total"] == 10

    def test_system_user_label_for_none_user(self):
        svc, db = _svc()
        chain = _chain(count=3)
        chain.all.side_effect = [
            [],                  # by_action
            [(None, 3)],         # by_user (system/anonymous)
            [],                  # by_resource
        ]
        db.query.return_value = chain

        result = svc.get_activity_summary(BIZ)
        assert result["by_user"] == {"system": 3}

    def test_with_date_filters(self):
        svc, db = _svc()
        chain = _chain(count=0)
        chain.all.side_effect = [[], [], []]
        db.query.return_value = chain

        start = datetime(2025, 1, 1)
        end = datetime(2025, 1, 31)
        result = svc.get_activity_summary(BIZ, start_date=start, end_date=end)

        # Base filter + start_date + end_date
        assert chain.filter.call_count >= 3
        assert result["total"] == 0


# ══════════════════════════════════════════════════════════════════════════════
# export_activity_csv
# ══════════════════════════════════════════════════════════════════════════════


class TestExportActivityCsv:
    def test_returns_list_of_dicts(self):
        svc, db = _svc()
        rid = str(uuid.uuid4())
        log = _mock_log(
            resource_id=rid,
            description="Test export",
            ip_address="10.0.0.1",
        )
        chain = _chain(rows=[log])
        db.query.return_value = chain

        result = svc.export_activity_csv(BIZ)

        assert len(result) == 1
        row = result[0]
        assert row["id"] == str(log.id)
        assert row["user_id"] == str(log.user_id)
        assert row["action"] == log.action.value
        assert row["resource_type"] == "product"
        assert row["resource_id"] == rid
        assert row["description"] == "Test export"
        assert row["ip_address"] == "10.0.0.1"
        assert row["created_at"] == log.created_at.isoformat()

    def test_empty_export(self):
        svc, db = _svc()
        chain = _chain(rows=[])
        db.query.return_value = chain

        result = svc.export_activity_csv(BIZ)
        assert result == []

    def test_handles_none_optional_fields(self):
        svc, db = _svc()
        log = _mock_log(
            user_id=None,
            resource_id=None,
            description=None,
            ip_address=None,
            created_at=None,
            action=None,
        )
        chain = _chain(rows=[log])
        db.query.return_value = chain

        result = svc.export_activity_csv(BIZ)
        row = result[0]
        assert row["user_id"] == ""
        assert row["action"] == ""
        assert row["resource_id"] == ""
        assert row["description"] == ""
        assert row["ip_address"] == ""
        assert row["created_at"] == ""

    def test_with_date_filters(self):
        svc, db = _svc()
        chain = _chain(rows=[])
        db.query.return_value = chain

        start = datetime(2025, 1, 1)
        end = datetime(2025, 6, 30)
        svc.export_activity_csv(BIZ, start_date=start, end_date=end)

        # Base filter + start_date + end_date
        assert chain.filter.call_count >= 3
