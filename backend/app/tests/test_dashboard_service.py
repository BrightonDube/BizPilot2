"""Unit tests for DashboardService."""
import os
os.environ.setdefault("SECRET_KEY", "test-secret-key")

from datetime import datetime
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.services.dashboard_service import DashboardService


BIZ = str(uuid4())
USR = str(uuid4())
DASH_ID = str(uuid4())
WIDGET_ID = str(uuid4())
TPL_ID = str(uuid4())
SHARE_ID = str(uuid4())
SCHED_ID = str(uuid4())


def _svc():
    db = MagicMock()
    return DashboardService(db), db


def _chain(db, rows=None, first=None, count=0, scalar=None):
    chain = MagicMock()
    chain.filter.return_value = chain
    chain.order_by.return_value = chain
    chain.limit.return_value = chain
    chain.offset.return_value = chain
    chain.with_entities.return_value = chain
    chain.join.return_value = chain
    chain.group_by.return_value = chain
    chain.all.return_value = rows or []
    chain.first.return_value = first
    chain.count.return_value = count
    chain.scalar.return_value = scalar
    db.query.return_value = chain
    return chain


class TestDashboardCRUD:
    def test_create(self):
        svc, db = _svc()
        svc.create_dashboard(BIZ, USR, "My Dashboard")
        db.add.assert_called_once()
        db.commit.assert_called_once()

    def test_list(self):
        svc, db = _svc()
        dash = MagicMock()
        _chain(db, rows=[dash], count=1)
        items, total = svc.list_dashboards(BIZ, USR)
        assert total == 1
        assert len(items) == 1

    def test_get_found(self):
        svc, db = _svc()
        dash = MagicMock()
        _chain(db, first=dash)
        result = svc.get_dashboard(DASH_ID, BIZ)
        assert result == dash

    def test_get_not_found(self):
        svc, db = _svc()
        _chain(db, first=None)
        with pytest.raises(HTTPException) as exc:
            svc.get_dashboard(DASH_ID, BIZ)
        assert exc.value.status_code == 404

    def test_update(self):
        svc, db = _svc()
        dash = MagicMock()
        dash.name = "Old"
        _chain(db, first=dash)
        svc.update_dashboard(DASH_ID, BIZ, name="New")
        db.commit.assert_called()

    def test_delete(self):
        svc, db = _svc()
        dash = MagicMock()
        _chain(db, first=dash)
        svc.delete_dashboard(DASH_ID, BIZ)
        dash.soft_delete.assert_called_once()
        db.commit.assert_called()


class TestWidgetCRUD:
    def test_add_widget(self):
        svc, db = _svc()
        svc.add_widget(DASH_ID, "kpi_total_sales", "Sales")
        db.add.assert_called_once()
        db.commit.assert_called_once()

    def test_update_widget_found(self):
        svc, db = _svc()
        widget = MagicMock()
        _chain(db, first=widget)
        svc.update_widget(WIDGET_ID, title="Updated")
        db.commit.assert_called()

    def test_update_widget_not_found(self):
        svc, db = _svc()
        _chain(db, first=None)
        with pytest.raises(HTTPException) as exc:
            svc.update_widget(WIDGET_ID, title="X")
        assert exc.value.status_code == 404

    def test_remove_widget(self):
        svc, db = _svc()
        widget = MagicMock()
        _chain(db, first=widget)
        svc.remove_widget(WIDGET_ID)
        widget.soft_delete.assert_called_once()

    def test_remove_widget_not_found(self):
        svc, db = _svc()
        _chain(db, first=None)
        with pytest.raises(HTTPException):
            svc.remove_widget(WIDGET_ID)


class TestWidgetData:
    def test_unknown_type(self):
        svc, db = _svc()
        with pytest.raises(HTTPException) as exc:
            svc.get_widget_data("unknown_widget", None, BIZ)
        assert exc.value.status_code == 400

    def test_kpi_total_orders(self):
        svc, db = _svc()
        _chain(db, count=42)
        result = svc._kpi_total_orders(BIZ, None)
        assert result == {"value": 42}

    def test_kpi_total_customers(self):
        svc, db = _svc()
        _chain(db, count=10)
        result = svc._kpi_total_customers(BIZ, None)
        assert result == {"value": 10}

    def test_kpi_total_products(self):
        svc, db = _svc()
        _chain(db, count=5)
        result = svc._kpi_total_products(BIZ, None)
        assert result == {"value": 5}

    def test_kpi_total_sales(self):
        svc, db = _svc()
        _chain(db, scalar=1500.0)
        result = svc._kpi_total_sales(BIZ, None)
        assert result == {"value": 1500.0}

    def test_chart_order_status(self):
        svc, db = _svc()
        row = MagicMock()
        row.status = MagicMock(value="completed")
        row.count = 10
        _chain(db, rows=[row])
        result = svc._chart_order_status(BIZ, None)
        assert result["labels"] == ["completed"]
        assert result["values"] == [10]

    def test_list_recent_orders(self):
        svc, db = _svc()
        order = MagicMock()
        order.id = uuid4()
        order.order_number = "ORD-001"
        order.total = 100.0
        order.status = MagicMock(value="completed")
        order.created_at = datetime(2025, 1, 15)
        _chain(db, rows=[order])
        result = svc._list_recent_orders(BIZ, None)
        assert len(result["items"]) == 1
        assert result["items"][0]["order_number"] == "ORD-001"

    def test_list_low_stock(self):
        svc, db = _svc()
        prod = MagicMock()
        prod.id = uuid4()
        prod.name = "Widget A"
        prod.quantity = 2
        prod.low_stock_threshold = 10
        _chain(db, rows=[prod])
        result = svc._list_low_stock(BIZ, None)
        assert len(result["items"]) == 1
        assert result["items"][0]["name"] == "Widget A"


class TestDuplicateAndTemplates:
    def test_duplicate(self):
        svc, db = _svc()
        source = MagicMock()
        source.name = "Original"
        source.description = "Desc"
        source.layout = "{}"
        widget = MagicMock()
        widget.deleted_at = None
        widget.widget_type = "kpi_total_sales"
        widget.title = "Sales"
        widget.config = None
        widget.position_x = 0
        widget.position_y = 0
        widget.width = 4
        widget.height = 3
        source.widgets = [widget]
        _chain(db, first=source)
        svc.duplicate_dashboard(DASH_ID, BIZ, USR)
        assert db.add.call_count >= 2  # clone + widget

    def test_create_template(self):
        svc, db = _svc()
        svc.create_template(BIZ, "Sales Template")
        db.add.assert_called_once()
        db.commit.assert_called()

    def test_list_templates(self):
        svc, db = _svc()
        _chain(db, rows=[MagicMock()], count=1)
        items, total = svc.list_templates(BIZ)
        assert total == 1

    def test_get_template_not_found(self):
        svc, db = _svc()
        _chain(db, first=None)
        with pytest.raises(HTTPException) as exc:
            svc.get_template(TPL_ID)
        assert exc.value.status_code == 404

    def test_apply_template(self):
        svc, db = _svc()
        tpl = MagicMock()
        tpl.name = "Template"
        tpl.description = "Desc"
        tpl.layout = {"cols": 12}
        tpl.widgets_config = [
            {"widget_type": "kpi_total_sales", "title": "Sales"}
        ]
        _chain(db, first=tpl)
        svc.apply_template(TPL_ID, BIZ, USR)
        assert db.add.call_count >= 2  # dashboard + widget

    def test_delete_system_template(self):
        svc, db = _svc()
        tpl = MagicMock()
        tpl.is_system = True
        _chain(db, first=tpl)
        with pytest.raises(HTTPException) as exc:
            svc.delete_template(TPL_ID, BIZ)
        assert exc.value.status_code == 403

    def test_delete_other_business_template(self):
        svc, db = _svc()
        tpl = MagicMock()
        tpl.is_system = False
        tpl.business_id = str(uuid4())  # different business
        _chain(db, first=tpl)
        with pytest.raises(HTTPException) as exc:
            svc.delete_template(TPL_ID, BIZ)
        assert exc.value.status_code == 403


class TestSharing:
    def test_share_new(self):
        svc, db = _svc()
        dash = MagicMock()
        call_count = [0]
        def query_side_effect(*args):
            call_count[0] += 1
            chain = MagicMock()
            chain.filter.return_value = chain
            chain.order_by.return_value = chain
            if call_count[0] == 1:
                chain.first.return_value = dash  # get_dashboard
            else:
                chain.first.return_value = None  # no existing share
            return chain
        db.query.side_effect = query_side_effect
        svc.share_dashboard(DASH_ID, BIZ, USR)
        db.add.assert_called_once()

    def test_share_update_existing(self):
        svc, db = _svc()
        dash = MagicMock()
        existing = MagicMock()
        call_count = [0]
        def query_side_effect(*args):
            call_count[0] += 1
            chain = MagicMock()
            chain.filter.return_value = chain
            chain.order_by.return_value = chain
            if call_count[0] == 1:
                chain.first.return_value = dash
            else:
                chain.first.return_value = existing
            return chain
        db.query.side_effect = query_side_effect
        svc.share_dashboard(DASH_ID, BIZ, USR, permission="edit")
        assert existing.permission == "edit"

    def test_list_shares(self):
        svc, db = _svc()
        _chain(db, rows=[MagicMock()], count=1)
        items, total = svc.list_shares(DASH_ID)
        assert total == 1

    def test_revoke_share(self):
        svc, db = _svc()
        share = MagicMock()
        _chain(db, first=share)
        svc.revoke_share(SHARE_ID)
        share.soft_delete.assert_called_once()

    def test_revoke_share_not_found(self):
        svc, db = _svc()
        _chain(db, first=None)
        with pytest.raises(HTTPException):
            svc.revoke_share(SHARE_ID)


class TestExportSchedules:
    def test_create(self):
        svc, db = _svc()
        dash = MagicMock()
        _chain(db, first=dash)
        svc.create_export_schedule(DASH_ID, BIZ, USR, format="csv")
        db.add.assert_called()

    def test_list(self):
        svc, db = _svc()
        _chain(db, rows=[MagicMock()], count=2)
        items, total = svc.list_export_schedules(DASH_ID)
        assert total == 2

    def test_update(self):
        svc, db = _svc()
        sched = MagicMock()
        _chain(db, first=sched)
        svc.update_export_schedule(SCHED_ID, format="csv")
        db.commit.assert_called()

    def test_update_not_found(self):
        svc, db = _svc()
        _chain(db, first=None)
        with pytest.raises(HTTPException):
            svc.update_export_schedule(SCHED_ID, format="csv")

    def test_delete(self):
        svc, db = _svc()
        sched = MagicMock()
        _chain(db, first=sched)
        svc.delete_export_schedule(SCHED_ID)
        sched.soft_delete.assert_called_once()

    def test_delete_not_found(self):
        svc, db = _svc()
        _chain(db, first=None)
        with pytest.raises(HTTPException):
            svc.delete_export_schedule(SCHED_ID)
