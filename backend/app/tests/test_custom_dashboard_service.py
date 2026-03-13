"""Unit tests for CustomDashboardService."""
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

from unittest.mock import MagicMock
from uuid import uuid4

import pytest  # noqa: F401

from app.services.custom_dashboard_service import CustomDashboardService

BIZ = uuid4()
USR = uuid4()
USR2 = uuid4()
DASH_ID = uuid4()
WIDGET_ID = uuid4()
TEMPLATE_ID = uuid4()
SHARE_ID = uuid4()
SCHEDULE_ID = uuid4()


def _svc():
    """Create service with a mocked DB session."""
    db = MagicMock()
    return CustomDashboardService(db), db


def _chain(first=None, rows=None, count=0):
    """Chainable SQLAlchemy query mock."""
    c = MagicMock()
    c.filter.return_value = c
    c.join.return_value = c
    c.order_by.return_value = c
    c.offset.return_value = c
    c.limit.return_value = c
    c.all.return_value = rows if rows is not None else []
    c.first.return_value = first
    c.count.return_value = count
    return c


# ── Dashboard CRUD ────────────────────────────────────────────────


class TestListDashboards:
    def test_returns_items_and_total(self):
        svc, db = _svc()
        d1, d2 = MagicMock(), MagicMock()
        db.query.return_value = _chain(rows=[d1, d2], count=2)
        items, total = svc.list_dashboards(BIZ, USR)
        assert items == [d1, d2]
        assert total == 2

    def test_empty(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[], count=0)
        items, total = svc.list_dashboards(BIZ, USR)
        assert items == []
        assert total == 0

    def test_pagination_offset_and_limit(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=5)
        db.query.return_value = chain
        svc.list_dashboards(BIZ, USR, page=2, per_page=10)
        chain.offset.assert_called_once_with(10)
        chain.limit.assert_called_once_with(10)


class TestGetDashboard:
    def test_found(self):
        svc, db = _svc()
        dash = MagicMock()
        db.query.return_value = _chain(first=dash)
        assert svc.get_dashboard(DASH_ID, BIZ) is dash

    def test_not_found_returns_none(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.get_dashboard(DASH_ID, BIZ) is None


class TestCreateDashboard:
    def test_basic(self):
        svc, db = _svc()
        svc.create_dashboard(BIZ, USR, "Sales")
        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        added = db.add.call_args[0][0]
        assert added.name == "Sales"
        assert added.is_default is False
        assert added.is_shared is False

    def test_as_default_clears_existing(self):
        svc, db = _svc()
        clear_chain = _chain()
        db.query.return_value = clear_chain
        svc.create_dashboard(BIZ, USR, "Main", is_default=True)
        clear_chain.update.assert_called_once_with({"is_default": False})
        added = db.add.call_args[0][0]
        assert added.is_default is True

    def test_non_default_skips_clear(self):
        svc, db = _svc()
        svc.create_dashboard(BIZ, USR, "Extra", is_default=False)
        db.query.assert_not_called()


class TestUpdateDashboard:
    def test_not_found_returns_none(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.update_dashboard(DASH_ID, BIZ, name="X") is None

    def test_update_name(self):
        svc, db = _svc()
        dash = MagicMock()
        dash.name = "Old"
        db.query.return_value = _chain(first=dash)
        result = svc.update_dashboard(DASH_ID, BIZ, name="New")
        assert dash.name == "New"
        db.commit.assert_called()
        db.refresh.assert_called_with(dash)
        assert result is dash

    def test_set_default_clears_existing(self):
        svc, db = _svc()
        dash = MagicMock()
        dash.user_id = USR
        get_chain = _chain(first=dash)
        clear_chain = _chain()
        db.query.side_effect = [get_chain, clear_chain]
        svc.update_dashboard(DASH_ID, BIZ, is_default=True)
        clear_chain.update.assert_called_once_with({"is_default": False})
        assert dash.is_default is True

    def test_update_shared(self):
        svc, db = _svc()
        dash = MagicMock()
        db.query.return_value = _chain(first=dash)
        svc.update_dashboard(DASH_ID, BIZ, is_shared=True)
        assert dash.is_shared is True
        db.commit.assert_called()

    def test_unset_default_no_clear(self):
        svc, db = _svc()
        dash = MagicMock()
        db.query.return_value = _chain(first=dash)
        svc.update_dashboard(DASH_ID, BIZ, is_default=False)
        assert dash.is_default is False
        assert db.query.call_count == 1  # only get_dashboard, no clear


class TestDeleteDashboard:
    def test_found(self):
        svc, db = _svc()
        dash = MagicMock()
        db.query.return_value = _chain(first=dash)
        assert svc.delete_dashboard(DASH_ID, BIZ) is True
        dash.soft_delete.assert_called_once()
        db.commit.assert_called()

    def test_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.delete_dashboard(DASH_ID, BIZ) is False


# ── Widget management ─────────────────────────────────────────────


class TestListWidgets:
    def test_returns_widgets(self):
        svc, db = _svc()
        w1, w2 = MagicMock(), MagicMock()
        db.query.return_value = _chain(rows=[w1, w2])
        assert svc.list_widgets(DASH_ID) == [w1, w2]


class TestAddWidget:
    def test_basic_defaults(self):
        svc, db = _svc()
        svc.add_widget(DASH_ID, "chart", "Revenue")
        db.add.assert_called_once()
        db.commit.assert_called_once()
        added = db.add.call_args[0][0]
        assert added.widget_type == "chart"
        assert added.title == "Revenue"
        assert added.position_x == 0
        assert added.position_y == 0

    def test_custom_position(self):
        svc, db = _svc()
        svc.add_widget(DASH_ID, "kpi", "Sales", position_x=3, position_y=2)
        added = db.add.call_args[0][0]
        assert added.position_x == 3
        assert added.position_y == 2


class TestUpdateWidget:
    def test_found_updates_fields(self):
        svc, db = _svc()
        widget = MagicMock()
        widget.title = "Old"
        widget.position_x = 0
        widget.position_y = 0
        db.query.return_value = _chain(first=widget)
        result = svc.update_widget(WIDGET_ID, title="New", position_x=5, position_y=3)
        assert widget.title == "New"
        assert widget.position_x == 5
        assert widget.position_y == 3
        db.commit.assert_called()
        assert result is widget

    def test_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.update_widget(WIDGET_ID, title="X") is None


class TestDeleteWidget:
    def test_found(self):
        svc, db = _svc()
        widget = MagicMock()
        db.query.return_value = _chain(first=widget)
        assert svc.delete_widget(WIDGET_ID) is True
        widget.soft_delete.assert_called_once()
        db.commit.assert_called()

    def test_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.delete_widget(WIDGET_ID) is False


# ── Templates ─────────────────────────────────────────────────────


class TestListTemplates:
    def test_returns_system_and_business_templates(self):
        svc, db = _svc()
        t1, t2 = MagicMock(), MagicMock()
        db.query.return_value = _chain(rows=[t1, t2])
        assert svc.list_templates(BIZ) == [t1, t2]


class TestApplyTemplate:
    def test_success_clears_old_creates_new(self):
        svc, db = _svc()
        dash = MagicMock()
        tmpl = MagicMock()
        tmpl.layout = {
            "widgets": [
                {"type": "chart", "title": "Revenue", "x": 0, "y": 0},
                {"type": "kpi", "title": "Profit", "x": 4, "y": 0},
            ]
        }
        old_w = MagicMock()

        db.query.side_effect = [
            _chain(first=dash),
            _chain(first=tmpl),
            _chain(rows=[old_w]),
        ]

        result = svc.apply_template(DASH_ID, TEMPLATE_ID, BIZ)
        old_w.soft_delete.assert_called_once()
        assert db.add.call_count == 2
        assert result is dash

    def test_dashboard_not_found(self):
        svc, db = _svc()
        db.query.side_effect = [
            _chain(first=None),
            _chain(first=MagicMock()),
        ]
        assert svc.apply_template(DASH_ID, TEMPLATE_ID, BIZ) is None

    def test_template_not_found(self):
        svc, db = _svc()
        db.query.side_effect = [
            _chain(first=MagicMock()),
            _chain(first=None),
        ]
        assert svc.apply_template(DASH_ID, TEMPLATE_ID, BIZ) is None

    def test_empty_layout_creates_no_widgets(self):
        svc, db = _svc()
        dash = MagicMock()
        tmpl = MagicMock()
        tmpl.layout = {}
        db.query.side_effect = [
            _chain(first=dash),
            _chain(first=tmpl),
            _chain(rows=[]),
        ]
        result = svc.apply_template(DASH_ID, TEMPLATE_ID, BIZ)
        assert result is dash
        db.add.assert_not_called()

    def test_none_layout_treated_as_empty(self):
        svc, db = _svc()
        dash = MagicMock()
        tmpl = MagicMock()
        tmpl.layout = None
        db.query.side_effect = [
            _chain(first=dash),
            _chain(first=tmpl),
            _chain(rows=[]),
        ]
        result = svc.apply_template(DASH_ID, TEMPLATE_ID, BIZ)
        assert result is dash
        db.add.assert_not_called()


# ── Sharing ───────────────────────────────────────────────────────


class TestShareDashboard:
    def test_creates_share(self):
        svc, db = _svc()
        svc.share_dashboard(DASH_ID, USR2, permission="edit")
        db.add.assert_called_once()
        db.commit.assert_called_once()
        added = db.add.call_args[0][0]
        assert added.dashboard_id == DASH_ID
        assert added.shared_with_user_id == USR2
        assert added.permission == "edit"

    def test_default_permission_is_view(self):
        svc, db = _svc()
        svc.share_dashboard(DASH_ID, USR2)
        added = db.add.call_args[0][0]
        assert added.permission == "view"


class TestListShares:
    def test_returns_shares(self):
        svc, db = _svc()
        s1 = MagicMock()
        db.query.return_value = _chain(rows=[s1])
        assert svc.list_shares(DASH_ID) == [s1]


class TestRemoveShare:
    def test_found(self):
        svc, db = _svc()
        share = MagicMock()
        db.query.return_value = _chain(first=share)
        assert svc.remove_share(SHARE_ID) is True
        db.delete.assert_called_once_with(share)
        db.commit.assert_called()

    def test_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.remove_share(SHARE_ID) is False
        db.delete.assert_not_called()


# ── Export schedules ──────────────────────────────────────────────


class TestCreateExportSchedule:
    def test_creates_schedule(self):
        svc, db = _svc()
        svc.create_export_schedule(DASH_ID, USR, format="csv", frequency="daily")
        db.add.assert_called_once()
        db.commit.assert_called_once()
        added = db.add.call_args[0][0]
        assert added.format == "csv"
        assert added.frequency == "daily"
        assert added.is_active is True

    def test_defaults(self):
        svc, db = _svc()
        svc.create_export_schedule(DASH_ID, USR)
        added = db.add.call_args[0][0]
        assert added.format == "pdf"
        assert added.frequency == "weekly"


class TestListExportSchedules:
    def test_returns_schedules(self):
        svc, db = _svc()
        s1 = MagicMock()
        db.query.return_value = _chain(rows=[s1])
        assert svc.list_export_schedules(DASH_ID) == [s1]


class TestToggleExportSchedule:
    def test_activate(self):
        svc, db = _svc()
        sched = MagicMock()
        sched.is_active = False
        db.query.return_value = _chain(first=sched)
        result = svc.toggle_export_schedule(SCHEDULE_ID, True)
        assert sched.is_active is True
        db.commit.assert_called()
        assert result is sched

    def test_deactivate(self):
        svc, db = _svc()
        sched = MagicMock()
        sched.is_active = True
        db.query.return_value = _chain(first=sched)
        result = svc.toggle_export_schedule(SCHEDULE_ID, False)
        assert sched.is_active is False
        assert result is sched

    def test_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.toggle_export_schedule(SCHEDULE_ID, True) is None
