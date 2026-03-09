"""Unit tests for CustomReportService."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-32-bytes-minimum")
os.environ.setdefault("DATABASE_URL", "sqlite:///test.db")

import uuid
from unittest.mock import MagicMock, call

import pytest

from app.models.report_template import ReportTemplate
from app.services.custom_report_service import (
    AVAILABLE_FILTERS,
    AVAILABLE_GROUP_BY,
    AVAILABLE_METRICS,
    CustomReportService,
)

BIZ_ID = uuid.uuid4()
USER_ID = uuid.uuid4()
TEMPLATE_ID = uuid.uuid4()


# ── helpers ─────────────────────────────────────────────────────────────

def _chain(first=None, rows=None, count=0, scalar=0):
    """Reusable mock supporting SQLAlchemy chained-call pattern."""
    c = MagicMock()
    c.filter.return_value = c
    c.join.return_value = c
    c.outerjoin.return_value = c
    c.order_by.return_value = c
    c.offset.return_value = c
    c.limit.return_value = c
    c.group_by.return_value = c
    c.with_entities.return_value = c
    c.all.return_value = rows if rows is not None else []
    c.first.return_value = first
    c.count.return_value = count
    c.scalar.return_value = scalar
    return c


def _make_staff(sid=None, first="John", last="Doe", email="john@test.com"):
    s = MagicMock()
    s.id = sid or uuid.uuid4()
    s.first_name = first
    s.last_name = last
    s.email = email
    return s


def _make_template(tid=None, name="My Report", owner_first="Jane", owner_last="Smith"):
    t = MagicMock()
    t.id = tid or uuid.uuid4()
    t.name = name
    t.description = "desc"
    t.report_type = "custom"
    t.metrics = ["total_sales"]
    t.filters = {}
    t.group_by = ["user"]
    t.sort_by = "total_sales"
    t.sort_direction = "desc"
    t.is_scheduled = False
    t.schedule_cron = None
    t.schedule_recipients = []
    t.is_public = False
    t.created_at = "2024-01-01"
    owner = MagicMock()
    owner.first_name = owner_first
    owner.last_name = owner_last
    t.owner = owner
    return t


def _make_order_data(order_count=5, total_sales=1000.0, discount_amount=50.0):
    d = MagicMock()
    d.order_count = order_count
    d.total_sales = total_sales
    d.discount_amount = discount_amount
    return d


@pytest.fixture
def db():
    return MagicMock()


@pytest.fixture
def svc(db):
    return CustomReportService(db)


# ── module-level constants ──────────────────────────────────────────────

class TestConstants:
    def test_available_metrics(self):
        assert "total_sales" in AVAILABLE_METRICS
        assert "hours_worked" in AVAILABLE_METRICS
        assert "void_count" in AVAILABLE_METRICS
        assert len(AVAILABLE_METRICS) == 7

    def test_available_group_by(self):
        assert "user" in AVAILABLE_GROUP_BY
        assert "month" in AVAILABLE_GROUP_BY

    def test_available_filters(self):
        assert "user_id" in AVAILABLE_FILTERS
        assert "date_range" in AVAILABLE_FILTERS


# ── create_template ─────────────────────────────────────────────────────

class TestCreateTemplate:
    def test_create_template_basic(self, db, svc):
        result = svc.create_template(
            business_id=BIZ_ID,
            user_id=USER_ID,
            name="Sales Report",
            metrics=["total_sales"],
            filters={"start_date": "2024-01-01"},
            group_by=["user"],
        )
        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        added = db.add.call_args[0][0]
        assert isinstance(added, ReportTemplate)
        assert added.name == "Sales Report"
        assert added.metrics == ["total_sales"]
        assert added.is_public is False
        assert added.schedule_recipients == []

    def test_create_template_with_schedule(self, db, svc):
        result = svc.create_template(
            business_id=BIZ_ID,
            user_id=USER_ID,
            name="Scheduled",
            metrics=["order_count"],
            filters={},
            group_by=[],
            is_scheduled=True,
            schedule_cron="0 9 * * *",
            schedule_recipients=["a@b.com"],
            is_public=True,
            description="Weekly report",
            sort_by="order_count",
            sort_direction="asc",
        )
        added = db.add.call_args[0][0]
        assert added.is_scheduled is True
        assert added.schedule_cron == "0 9 * * *"
        assert added.schedule_recipients == ["a@b.com"]
        assert added.is_public is True
        assert added.description == "Weekly report"
        assert added.sort_direction == "asc"

    def test_create_template_recipients_default(self, db, svc):
        """schedule_recipients=None defaults to empty list."""
        svc.create_template(
            business_id=BIZ_ID, user_id=USER_ID, name="X",
            metrics=[], filters={}, group_by=[],
            schedule_recipients=None,
        )
        added = db.add.call_args[0][0]
        assert added.schedule_recipients == []


# ── list_templates ──────────────────────────────────────────────────────

class TestListTemplates:
    def test_list_templates_no_user_filter(self, db, svc):
        t = _make_template()
        db.query.return_value = _chain(rows=[t], count=1)

        items, total = svc.list_templates(BIZ_ID)
        assert total == 1
        assert len(items) == 1
        assert items[0]["name"] == "My Report"
        assert items[0]["created_by_name"] == "Jane Smith"

    def test_list_templates_with_user_filter(self, db, svc):
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        items, total = svc.list_templates(BIZ_ID, user_id=USER_ID)
        assert total == 0
        assert items == []
        # filter called twice: once for business_id, once for user/public
        assert chain.filter.call_count == 2

    def test_list_templates_pagination(self, db, svc):
        chain = _chain(rows=[], count=5)
        db.query.return_value = chain

        items, total = svc.list_templates(BIZ_ID, page=2, per_page=2)
        assert total == 5
        chain.offset.assert_called_once_with(2)  # (2-1)*2 = 2
        chain.limit.assert_called_once_with(2)

    def test_list_templates_owner_name_unknown_when_no_owner(self, db, svc):
        t = _make_template()
        t.owner = None
        db.query.return_value = _chain(rows=[t], count=1)

        items, _ = svc.list_templates(BIZ_ID)
        assert items[0]["created_by_name"] == "Unknown"

    def test_list_templates_owner_name_unknown_when_names_empty(self, db, svc):
        t = _make_template(owner_first="", owner_last="")
        db.query.return_value = _chain(rows=[t], count=1)

        items, _ = svc.list_templates(BIZ_ID)
        assert items[0]["created_by_name"] == "Unknown"

    def test_list_templates_owner_first_name_only(self, db, svc):
        t = _make_template(owner_first="Jane", owner_last=None)
        db.query.return_value = _chain(rows=[t], count=1)

        items, _ = svc.list_templates(BIZ_ID)
        assert items[0]["created_by_name"] == "Jane"

    def test_list_templates_item_fields(self, db, svc):
        t = _make_template()
        db.query.return_value = _chain(rows=[t], count=1)

        items, _ = svc.list_templates(BIZ_ID)
        expected_keys = {
            "id", "name", "description", "report_type", "metrics",
            "filters", "group_by", "sort_by", "sort_direction",
            "is_scheduled", "schedule_cron", "schedule_recipients",
            "is_public", "created_by_name", "created_at",
        }
        assert set(items[0].keys()) == expected_keys


# ── get_template ────────────────────────────────────────────────────────

class TestGetTemplate:
    def test_get_template_found(self, db, svc):
        t = _make_template(tid=TEMPLATE_ID)
        db.query.return_value = _chain(first=t)

        result = svc.get_template(BIZ_ID, TEMPLATE_ID)
        assert result is t

    def test_get_template_not_found(self, db, svc):
        db.query.return_value = _chain(first=None)

        result = svc.get_template(BIZ_ID, uuid.uuid4())
        assert result is None


# ── update_template ─────────────────────────────────────────────────────

class TestUpdateTemplate:
    def test_update_template_sets_attrs(self, db, svc):
        t = MagicMock(spec=ReportTemplate)
        t.name = "Old"

        result = svc.update_template(t, name="New", description="Updated")
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(t)
        assert result is t

    def test_update_template_skips_none_values(self, db, svc):
        t = ReportTemplate()
        t.name = "Keep"

        svc.update_template(t, name=None, description="Set")
        # name=None → should NOT be overwritten
        assert t.name == "Keep"
        assert t.description == "Set"

    def test_update_template_ignores_nonexistent_attr(self, db, svc):
        t = ReportTemplate()
        svc.update_template(t, nonexistent_field="val")
        assert not hasattr(t, "nonexistent_field") or getattr(t, "nonexistent_field", None) != "val"
        db.commit.assert_called_once()


# ── delete_template ─────────────────────────────────────────────────────

class TestDeleteTemplate:
    def test_delete_template(self, db, svc):
        t = MagicMock()
        svc.delete_template(t)
        db.delete.assert_called_once_with(t)
        db.commit.assert_called_once()


# ── execute_report ──────────────────────────────────────────────────────

class TestExecuteReport:
    def _setup_queries(self, db, staff_rows, order_data=None, hours=0,
                       void_count=0, refund_count=0):
        """Wire db.query side_effect for execute_report.

        Call order:
          1. staff query        → .all()
          2. order data query   → .first()
          (repeated per staff member)
          3. hours query        → .scalar()
          4. void count query   → .scalar()
          5. refund count query → .scalar()
        """
        call_count = [0]

        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(rows=staff_rows)
            elif call_count[0] == 2:
                return _chain(first=order_data)
            elif call_count[0] == 3:
                return _chain(scalar=hours)
            elif call_count[0] == 4:
                return _chain(scalar=void_count)
            elif call_count[0] == 5:
                return _chain(scalar=refund_count)
            return _chain()

        db.query.side_effect = side_effect

    def test_execute_report_total_sales(self, db, svc):
        staff = _make_staff()
        order_data = _make_order_data(order_count=3, total_sales=1500.0, discount_amount=100.0)
        self._setup_queries(db, [staff], order_data=order_data)

        result = svc.execute_report(
            business_id=BIZ_ID,
            metrics=["total_sales"],
            filters={"start_date": "2024-01-01", "end_date": "2024-01-31"},
            group_by=["user"],
        )
        assert result["total_staff"] == 1
        assert result["data"][0]["total_sales"] == 1500.0
        assert "order_count" not in result["data"][0]

    def test_execute_report_order_count(self, db, svc):
        staff = _make_staff()
        order_data = _make_order_data(order_count=7, total_sales=2000.0)
        self._setup_queries(db, [staff], order_data=order_data)

        result = svc.execute_report(
            business_id=BIZ_ID,
            metrics=["order_count"],
            filters={"start_date": "2024-01-01", "end_date": "2024-01-31"},
            group_by=[],
        )
        assert result["data"][0]["order_count"] == 7

    def test_execute_report_avg_order_value(self, db, svc):
        staff = _make_staff()
        order_data = _make_order_data(order_count=4, total_sales=200.0)
        self._setup_queries(db, [staff], order_data=order_data)

        result = svc.execute_report(
            business_id=BIZ_ID,
            metrics=["avg_order_value"],
            filters={"start_date": "2024-01-01", "end_date": "2024-01-31"},
            group_by=[],
        )
        assert result["data"][0]["avg_order_value"] == 50.0

    def test_execute_report_avg_order_value_zero_orders(self, db, svc):
        staff = _make_staff()
        order_data = _make_order_data(order_count=0, total_sales=0)
        self._setup_queries(db, [staff], order_data=order_data)

        result = svc.execute_report(
            business_id=BIZ_ID,
            metrics=["avg_order_value"],
            filters={},
            group_by=[],
        )
        assert result["data"][0]["avg_order_value"] == 0

    def test_execute_report_discount_amount(self, db, svc):
        staff = _make_staff()
        order_data = _make_order_data(discount_amount=75.50)
        self._setup_queries(db, [staff], order_data=order_data)

        result = svc.execute_report(
            business_id=BIZ_ID,
            metrics=["discount_amount"],
            filters={"start_date": "2024-06-01", "end_date": "2024-06-30"},
            group_by=[],
        )
        assert result["data"][0]["discount_amount"] == 75.50

    def test_execute_report_hours_worked(self, db, svc):
        staff = _make_staff()

        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(rows=[staff])
            return _chain(scalar=42.5)

        db.query.side_effect = side_effect

        result = svc.execute_report(
            business_id=BIZ_ID,
            metrics=["hours_worked"],
            filters={"start_date": "2024-01-01", "end_date": "2024-01-31"},
            group_by=[],
        )
        assert result["data"][0]["hours_worked"] == 42.5

    def test_execute_report_void_count(self, db, svc):
        staff = _make_staff()

        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(rows=[staff])
            return _chain(scalar=3)

        db.query.side_effect = side_effect

        result = svc.execute_report(
            business_id=BIZ_ID,
            metrics=["void_count"],
            filters={},
            group_by=[],
        )
        assert result["data"][0]["void_count"] == 3

    def test_execute_report_refund_count(self, db, svc):
        staff = _make_staff()

        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(rows=[staff])
            return _chain(scalar=2)

        db.query.side_effect = side_effect

        result = svc.execute_report(
            business_id=BIZ_ID,
            metrics=["refund_count"],
            filters={},
            group_by=[],
        )
        assert result["data"][0]["refund_count"] == 2

    def test_execute_report_no_staff(self, db, svc):
        db.query.return_value = _chain(rows=[])

        result = svc.execute_report(
            business_id=BIZ_ID,
            metrics=["total_sales"],
            filters={},
            group_by=[],
        )
        assert result["total_staff"] == 0
        assert result["data"] == []

    def test_execute_report_sorting_desc(self, db, svc):
        s1 = _make_staff(first="Alice", last="A", email="a@t.com")
        s2 = _make_staff(first="Bob", last="B", email="b@t.com")

        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(rows=[s1, s2])
            elif call_count[0] == 2:
                return _chain(first=_make_order_data(total_sales=100))
            elif call_count[0] == 3:
                return _chain(first=_make_order_data(total_sales=500))
            return _chain()

        db.query.side_effect = side_effect

        result = svc.execute_report(
            business_id=BIZ_ID,
            metrics=["total_sales"],
            filters={"start_date": "2024-01-01", "end_date": "2024-01-31"},
            group_by=[],
            sort_by="total_sales",
            sort_direction="desc",
        )
        assert result["data"][0]["total_sales"] == 500.0
        assert result["data"][1]["total_sales"] == 100.0

    def test_execute_report_sorting_asc(self, db, svc):
        s1 = _make_staff(first="Alice", last="A", email="a@t.com")
        s2 = _make_staff(first="Bob", last="B", email="b@t.com")

        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(rows=[s1, s2])
            elif call_count[0] == 2:
                return _chain(first=_make_order_data(total_sales=500))
            elif call_count[0] == 3:
                return _chain(first=_make_order_data(total_sales=100))
            return _chain()

        db.query.side_effect = side_effect

        result = svc.execute_report(
            business_id=BIZ_ID,
            metrics=["total_sales"],
            filters={"start_date": "2024-01-01", "end_date": "2024-01-31"},
            group_by=[],
            sort_by="total_sales",
            sort_direction="asc",
        )
        assert result["data"][0]["total_sales"] == 100.0
        assert result["data"][1]["total_sales"] == 500.0

    def test_execute_report_sort_by_nonexistent_key(self, db, svc):
        staff = _make_staff()
        self._setup_queries(db, [staff], order_data=_make_order_data())

        result = svc.execute_report(
            business_id=BIZ_ID,
            metrics=["total_sales"],
            filters={"start_date": "2024-01-01", "end_date": "2024-01-31"},
            group_by=[],
            sort_by="nonexistent_field",
        )
        # Should not crash; results returned unsorted
        assert result["total_staff"] == 1

    def test_execute_report_user_filter(self, db, svc):
        staff = _make_staff(sid=USER_ID)
        self._setup_queries(db, [staff], order_data=_make_order_data())

        result = svc.execute_report(
            business_id=BIZ_ID,
            metrics=["total_sales"],
            filters={"user_id": str(USER_ID), "start_date": "2024-01-01", "end_date": "2024-01-31"},
            group_by=[],
        )
        assert result["total_staff"] == 1
        assert result["data"][0]["user_id"] == str(USER_ID)

    def test_execute_report_default_dates(self, db, svc):
        """No start_date/end_date in filters → defaults used."""
        db.query.return_value = _chain(rows=[])

        result = svc.execute_report(
            business_id=BIZ_ID,
            metrics=["total_sales"],
            filters={},
            group_by=[],
        )
        assert result["total_staff"] == 0
        assert result["filters"] == {}

    def test_execute_report_staff_name_unknown(self, db, svc):
        staff = _make_staff(first=None, last=None)

        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(rows=[staff])
            return _chain(scalar=0)

        db.query.side_effect = side_effect

        result = svc.execute_report(
            business_id=BIZ_ID,
            metrics=["void_count"],
            filters={},
            group_by=[],
        )
        assert result["data"][0]["staff_name"] == "Unknown"

    def test_execute_report_return_shape(self, db, svc):
        db.query.return_value = _chain(rows=[])

        result = svc.execute_report(
            business_id=BIZ_ID,
            metrics=["total_sales"],
            filters={"start_date": "2024-01-01"},
            group_by=["user"],
        )
        assert set(result.keys()) == {"metrics", "filters", "group_by", "total_staff", "data"}
        assert result["metrics"] == ["total_sales"]
        assert result["group_by"] == ["user"]

    def test_execute_report_all_metrics(self, db, svc):
        staff = _make_staff()
        order_data = _make_order_data(order_count=10, total_sales=5000, discount_amount=200)

        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(rows=[staff])
            elif call_count[0] == 2:
                return _chain(first=order_data)
            elif call_count[0] == 3:
                return _chain(scalar=80.25)
            elif call_count[0] == 4:
                return _chain(scalar=3)
            elif call_count[0] == 5:
                return _chain(scalar=1)
            return _chain()

        db.query.side_effect = side_effect

        result = svc.execute_report(
            business_id=BIZ_ID,
            metrics=["total_sales", "order_count", "avg_order_value",
                     "discount_amount", "hours_worked", "void_count", "refund_count"],
            filters={"start_date": "2024-01-01", "end_date": "2024-12-31"},
            group_by=["user"],
        )
        row = result["data"][0]
        assert row["total_sales"] == 5000.0
        assert row["order_count"] == 10
        assert row["avg_order_value"] == 500.0
        assert row["discount_amount"] == 200.0
        assert row["hours_worked"] == 80.25
        assert row["void_count"] == 3
        assert row["refund_count"] == 1
