"""Unit tests for ReportGeneratorService."""
import os
os.environ.setdefault("SECRET_KEY", "test-secret-key")

from datetime import datetime
from unittest.mock import MagicMock
from uuid import uuid4


from app.services.report_generator_service import ReportGeneratorService, ReportData
from app.models.report_subscription import ReportType


BIZ_ID = uuid4()
USR_ID = uuid4()
EMAIL = "test@example.com"
START = datetime(2025, 1, 1)
END = datetime(2025, 1, 31, 23, 59, 59)


def _svc():
    db = MagicMock()
    return ReportGeneratorService(db), db


def _biz():
    biz = MagicMock()
    biz.id = BIZ_ID
    biz.name = "Test Biz"
    biz.currency = "ZAR"
    return biz


def _chain(first=None, count=0, rows=None):
    chain = MagicMock()
    chain.filter.return_value = chain
    chain.join.return_value = chain
    chain.group_by.return_value = chain
    chain.having.return_value = chain
    chain.order_by.return_value = chain
    chain.limit.return_value = chain
    chain.distinct.return_value = chain
    chain.all.return_value = rows if rows is not None else []
    chain.first.return_value = first
    chain.count.return_value = count
    return chain


# ── Period calculations ──────────────────────────────────────────────


class TestPeriodCalculations:
    def test_weekly_period(self):
        svc, _ = _svc()
        # Wednesday Jan 15 2025 → previous Mon Jan 6 to Sun Jan 12
        dt = datetime(2025, 1, 15)
        start, end = svc.calculate_weekly_period(dt)
        assert start.weekday() == 0  # Monday
        assert end.weekday() == 6  # Sunday
        assert start.day == 6
        assert end.day == 12

    def test_monthly_period(self):
        svc, _ = _svc()
        # Feb 15 2025 → Jan 1-31
        dt = datetime(2025, 2, 15)
        start, end = svc.calculate_monthly_period(dt)
        assert start.month == 1
        assert start.day == 1
        assert end.month == 1
        assert end.day == 31

    def test_monthly_period_january(self):
        svc, _ = _svc()
        # Jan 15 2025 → Dec 1-31 2024
        dt = datetime(2025, 1, 15)
        start, end = svc.calculate_monthly_period(dt)
        assert start.month == 12
        assert start.year == 2024
        assert end.month == 12
        assert end.day == 31


# ── Business lookup ──────────────────────────────────────────────────


class TestBusinessLookup:
    def test_get_user_businesses(self):
        svc, db = _svc()
        bu = MagicMock()
        bu.business_id = BIZ_ID
        biz = _biz()
        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(rows=[bu])
            return _chain(rows=[biz])
        db.query.side_effect = side_effect
        result = svc.get_user_businesses(USR_ID)
        assert len(result) == 1

    def test_get_user_businesses_none(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[])
        result = svc.get_user_businesses(USR_ID)
        assert result == []

    def test_get_primary_business(self):
        svc, db = _svc()
        bu = MagicMock()
        bu.business_id = BIZ_ID
        biz = _biz()
        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(first=bu)
            return _chain(first=biz)
        db.query.side_effect = side_effect
        result = svc.get_primary_business(USR_ID)
        assert result.name == "Test Biz"

    def test_get_primary_business_fallback(self):
        svc, db = _svc()
        bu = MagicMock()
        bu.business_id = BIZ_ID
        biz = _biz()
        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(first=None)  # no primary
            if call_count[0] == 2:
                return _chain(first=bu)  # fallback
            return _chain(first=biz)
        db.query.side_effect = side_effect
        result = svc.get_primary_business(USR_ID)
        assert result.name == "Test Biz"

    def test_get_primary_business_none(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        result = svc.get_primary_business(USR_ID)
        assert result is None


# ── Sales summary ────────────────────────────────────────────────────


class TestSalesSummary:
    def test_basic(self):
        svc, db = _svc()
        order = MagicMock()
        order.total = 500
        product = MagicMock()
        product.name = "Widget"
        product.quantity = 10
        product.revenue = 500
        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            c = _chain()
            if call_count[0] == 1:
                c.all.return_value = [order]
            else:
                c.all.return_value = [product]
            return c
        db.query.side_effect = side_effect
        result = svc.generate_sales_summary(USR_ID, EMAIL, _biz(), START, END)
        assert isinstance(result, ReportData)
        assert result.metrics["total_revenue"] == 500.0
        assert result.metrics["transaction_count"] == 1
        assert result.metrics["average_transaction_value"] == 500.0

    def test_no_orders(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[])
        result = svc.generate_sales_summary(USR_ID, EMAIL, _biz(), START, END)
        assert result.metrics["transaction_count"] == 0
        assert result.metrics["average_transaction_value"] == 0


# ── Inventory status ─────────────────────────────────────────────────


class TestInventoryStatus:
    def test_with_items(self):
        svc, db = _svc()
        item1 = MagicMock()
        item1.quantity_on_hand = 10
        item1.unit_cost = 50
        item1.reorder_point = 5
        item1.product_name = "Widget"
        item1.sku = "W001"

        item2 = MagicMock()
        item2.quantity_on_hand = 0
        item2.unit_cost = 30
        item2.reorder_point = 5
        item2.product_name = "Gadget"
        item2.sku = "G001"

        item3 = MagicMock()
        item3.quantity_on_hand = 2
        item3.unit_cost = 20
        item3.reorder_point = 5
        item3.product_name = "Low Stock Item"
        item3.sku = "LS01"

        db.query.return_value = _chain(rows=[item1, item2, item3])
        result = svc.generate_inventory_status(USR_ID, EMAIL, _biz(), START, END)
        assert result.metrics["total_items"] == 3
        assert result.metrics["out_of_stock_count"] == 1
        assert result.metrics["low_stock_count"] == 1
        assert result.metrics["total_value"] == 540.0  # 10*50 + 0*30 + 2*20

    def test_empty_inventory(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[])
        result = svc.generate_inventory_status(USR_ID, EMAIL, _biz(), START, END)
        assert result.metrics["total_items"] == 0


# ── Financial overview ───────────────────────────────────────────────


class TestFinancialOverview:
    def test_basic(self):
        svc, db = _svc()
        sale = MagicMock(total=10000)
        purchase = MagicMock(total=3000)
        inv = MagicMock(total=2000, amount_paid=500)
        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(rows=[sale])  # sales
            if call_count[0] == 2:
                return _chain(rows=[purchase])  # purchases
            return _chain(rows=[inv])  # invoices
        db.query.side_effect = side_effect
        result = svc.generate_financial_overview(USR_ID, EMAIL, _biz(), START, END)
        assert result.metrics["total_revenue"] == 10000.0
        assert result.metrics["total_expenses"] == 3000.0
        assert result.metrics["net_profit"] == 7000.0
        assert result.metrics["outstanding_amount"] == 1500.0

    def test_no_revenue(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[])
        result = svc.generate_financial_overview(USR_ID, EMAIL, _biz(), START, END)
        assert result.metrics["profit_margin"] == 0


# ── Customer activity ────────────────────────────────────────────────


class TestCustomerActivity:
    def test_basic(self):
        svc, db = _svc()
        customer = MagicMock()
        customer.company_name = "Acme"
        customer.first_name = None
        customer.last_name = None
        customer.total_spent = 5000
        customer.order_count = 10
        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(count=5)   # new customers
            if call_count[0] == 2:
                return _chain(count=50)  # total customers
            if call_count[0] == 3:
                return _chain(count=20)  # active
            if call_count[0] == 4:
                return _chain(count=8)   # repeat
            return _chain(rows=[customer])  # top
        db.query.side_effect = side_effect
        result = svc.generate_customer_activity(USR_ID, EMAIL, _biz(), START, END)
        assert result.metrics["new_customers"] == 5
        assert result.metrics["retention_rate"] == 40.0
        assert len(result.metrics["top_customers"]) == 1

    def test_zero_customers(self):
        svc, db = _svc()
        db.query.return_value = _chain(count=0, rows=[])
        result = svc.generate_customer_activity(USR_ID, EMAIL, _biz(), START, END)
        assert result.metrics["retention_rate"] == 0


# ── Generate report dispatcher ───────────────────────────────────────


class TestGenerateReport:
    def test_dispatches_sales(self):
        svc, db = _svc()
        biz = _biz()
        sale = MagicMock(total=100)
        db.query.return_value = _chain(rows=[sale])
        result = svc.generate_report(USR_ID, EMAIL, ReportType.SALES_SUMMARY, START, END, business=biz)
        assert result is not None
        assert result.report_type == ReportType.SALES_SUMMARY

    def test_no_business_returns_none(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        result = svc.generate_report(USR_ID, EMAIL, ReportType.SALES_SUMMARY, START, END)
        assert result is None

    def test_unknown_type_returns_none(self):
        svc, db = _svc()
        biz = _biz()
        result = svc.generate_report(USR_ID, EMAIL, "unknown_type", START, END, business=biz)
        assert result is None

    def test_exception_returns_none(self):
        svc, db = _svc()
        biz = _biz()
        db.query.side_effect = Exception("DB error")
        result = svc.generate_report(USR_ID, EMAIL, ReportType.SALES_SUMMARY, START, END, business=biz)
        assert result is None
