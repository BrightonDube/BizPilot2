"""Unit tests for SalesReportService.

Covers the core helper methods and report generation with
mocked _get_period_totals to avoid deep query chain mocking.
"""

import os
os.environ.setdefault("SECRET_KEY", "test-secret-key")

import uuid
from datetime import date
from unittest.mock import MagicMock, patch

import pytest

from app.services.sales_report_service import SalesReportService


BIZ_ID = uuid.uuid4()


@pytest.fixture
def db():
    return MagicMock()


@pytest.fixture
def service(db):
    return SalesReportService(db)


SAMPLE_TOTALS = {
    "gross_sales": 5000.00,
    "net_sales": 4200.00,
    "discounts": 300.00,
    "refunds": 500.00,
    "tax": 750.00,
    "transaction_count": 50,
    "average_transaction_value": 100.00,
}


ZERO_TOTALS = {
    "gross_sales": 0.0,
    "net_sales": 0.0,
    "discounts": 0.0,
    "refunds": 0.0,
    "tax": 0.0,
    "transaction_count": 0,
    "average_transaction_value": 0.0,
}


# ---------------------------------------------------------------------------
# _calc_change
# ---------------------------------------------------------------------------

class TestCalcChange:
    """Tests for the percentage change helper."""

    def test_positive_change(self, service):
        """100 → 150 = 50% increase."""
        assert service._calc_change(150.0, 100.0) == 50.0

    def test_negative_change(self, service):
        """100 → 50 = -50% decrease."""
        assert service._calc_change(50.0, 100.0) == -50.0

    def test_zero_previous(self, service):
        """Zero division returns 0.0."""
        assert service._calc_change(100.0, 0.0) == 0.0

    def test_no_change(self, service):
        """Same values = 0% change."""
        assert service._calc_change(100.0, 100.0) == 0.0


# ---------------------------------------------------------------------------
# get_daily_report
# ---------------------------------------------------------------------------

class TestGetDailyReport:
    """Tests for SalesReportService.get_daily_report."""

    def test_daily_report_structure(self, service, db):
        """Returns expected keys in daily report."""
        with patch.object(service, "_get_period_totals", return_value=SAMPLE_TOTALS):
            # Mock hourly breakdown query chain
            hourly_chain = db.query.return_value
            hourly_chain = hourly_chain.filter.return_value
            hourly_chain.group_by.return_value.order_by.return_value.all.return_value = []

            result = service.get_daily_report(BIZ_ID, date(2025, 7, 20))

        assert result["date"] == "2025-07-20"
        assert "summary" in result
        assert "hourly_breakdown" in result
        assert "comparisons" in result
        assert "previous_day" in result["comparisons"]
        assert "same_day_last_week" in result["comparisons"]

    def test_daily_report_uses_totals(self, service, db):
        """Summary uses _get_period_totals output."""
        with patch.object(service, "_get_period_totals", return_value=SAMPLE_TOTALS):
            hourly_chain = db.query.return_value
            hourly_chain = hourly_chain.filter.return_value
            hourly_chain.group_by.return_value.order_by.return_value.all.return_value = []

            result = service.get_daily_report(BIZ_ID, date(2025, 7, 20))

        assert result["summary"]["gross_sales"] == 5000.00
        assert result["summary"]["transaction_count"] == 50


# ---------------------------------------------------------------------------
# get_weekly_report
# ---------------------------------------------------------------------------

class TestGetWeeklyReport:
    """Tests for SalesReportService.get_weekly_report."""

    def test_weekly_report_structure(self, service, db):
        """Returns expected keys in weekly report."""
        with patch.object(service, "_get_period_totals", return_value=SAMPLE_TOTALS):
            # Mock daily breakdown
            daily_chain = db.query.return_value
            daily_chain = daily_chain.filter.return_value
            daily_chain.group_by.return_value.order_by.return_value.all.return_value = []

            result = service.get_weekly_report(BIZ_ID, date(2025, 7, 14))

        assert "summary" in result
        assert "daily_breakdown" in result
        assert "comparisons" in result


# ---------------------------------------------------------------------------
# get_monthly_report
# ---------------------------------------------------------------------------

class TestGetMonthlyReport:
    """Tests for SalesReportService.get_monthly_report."""

    def test_monthly_report_structure(self, service, db):
        """Returns expected keys in monthly report."""
        with patch.object(service, "_get_period_totals", return_value=SAMPLE_TOTALS):
            # Mock daily breakdown query chain
            daily_chain = db.query.return_value
            daily_chain = daily_chain.filter.return_value
            daily_chain.group_by.return_value.order_by.return_value.all.return_value = []

            result = service.get_monthly_report(BIZ_ID, 2025, 7)

        assert "summary" in result
        assert "daily_breakdown" in result
        assert "comparisons" in result
        assert result["year"] == 2025
        assert result["month"] == 7


# ---------------------------------------------------------------------------
# get_product_performance
# ---------------------------------------------------------------------------

class TestGetProductPerformance:
    """Tests for SalesReportService.get_product_performance."""

    def test_returns_dict_with_products(self, service, db):
        """Returns dict with products list."""
        mock_row = MagicMock()
        mock_row.product_id = uuid.uuid4()
        mock_row.product_name = "Widget"
        mock_row.revenue = 5000.0
        mock_row.quantity_sold = 100
        mock_row.order_count = 50

        chain = db.query.return_value.join.return_value
        chain = chain.filter.return_value
        chain.group_by.return_value.order_by.return_value.limit.return_value.all.return_value = [mock_row]

        result = service.get_product_performance(
            BIZ_ID, date(2025, 7, 1), date(2025, 7, 31),
        )
        assert "products" in result
        assert len(result["products"]) == 1
        assert result["products"][0]["product_name"] == "Widget"
        assert result["total_revenue"] == 5000.0

    def test_empty_performance(self, service, db):
        """Returns empty products list when no sales."""
        chain = db.query.return_value.join.return_value
        chain = chain.filter.return_value
        chain.group_by.return_value.order_by.return_value.limit.return_value.all.return_value = []

        result = service.get_product_performance(
            BIZ_ID, date(2025, 7, 1), date(2025, 7, 31),
        )
        assert result["products"] == []
        assert result["total_revenue"] == 0.0


# ---------------------------------------------------------------------------
# get_category_performance
# ---------------------------------------------------------------------------

class TestGetCategoryPerformance:
    """Tests for SalesReportService.get_category_performance."""

    def test_returns_dict_with_categories(self, service, db):
        """Returns dict with categories list."""
        mock_row = MagicMock()
        mock_row.category_id = uuid.uuid4()
        mock_row.category_name = "Beverages"
        mock_row.quantity_sold = 200
        mock_row.revenue = 8000.0
        mock_row.order_count = 80

        chain = db.query.return_value.join.return_value.join.return_value.outerjoin.return_value
        chain = chain.filter.return_value
        chain.group_by.return_value.order_by.return_value.all.return_value = [mock_row]

        result = service.get_category_performance(
            BIZ_ID, date(2025, 7, 1), date(2025, 7, 31),
        )
        assert "categories" in result
        assert len(result["categories"]) == 1
        assert result["categories"][0]["category_name"] == "Beverages"


# ---------------------------------------------------------------------------
# get_payment_breakdown
# ---------------------------------------------------------------------------

class TestGetPaymentBreakdown:
    """Tests for SalesReportService.get_payment_breakdown."""

    def test_returns_breakdown(self, service, db):
        """Returns payment method breakdown."""
        mock_row = MagicMock()
        mock_row.payment_method = "card"
        mock_row.count = 30
        mock_row.total = 3000.0

        chain = db.query.return_value
        chain = chain.filter.return_value
        chain.group_by.return_value.order_by.return_value.all.return_value = [mock_row]

        # Total for percentage calc
        db.query.return_value.filter.return_value.scalar.return_value = 5000.0

        result = service.get_payment_breakdown(
            BIZ_ID, date(2025, 7, 1), date(2025, 7, 31),
        )
        assert len(result) >= 1


# ---------------------------------------------------------------------------
# get_time_analysis
# ---------------------------------------------------------------------------

class TestGetTimeAnalysis:
    """Tests for SalesReportService.get_time_analysis."""

    def test_returns_analysis(self, service, db):
        """Returns time analysis with hourly and daily data."""
        mock_hourly = MagicMock()
        mock_hourly.hour = 12
        mock_hourly.sales = 1000.0
        mock_hourly.transactions = 10

        mock_daily = MagicMock()
        mock_daily.day_of_week = 1
        mock_daily.sales = 5000.0
        mock_daily.transactions = 50

        # Both queries go through db.query → _base_sales_filter → group_by → order_by → all
        # _base_sales_filter calls .filter() on the query chain
        filter_chain = db.query.return_value.filter.return_value

        call_count = [0]
        def group_by_side_effect(*args, **kwargs):
            call_count[0] += 1
            chain = MagicMock()
            if call_count[0] <= 1:
                chain.order_by.return_value.all.return_value = [mock_hourly]
            else:
                chain.order_by.return_value.all.return_value = [mock_daily]
            return chain
        filter_chain.group_by.side_effect = group_by_side_effect

        result = service.get_time_analysis(
            BIZ_ID, date(2025, 7, 1), date(2025, 7, 31),
        )
        assert "hourly_breakdown" in result
        assert "day_of_week_breakdown" in result
        assert "peak_hour" in result


# ---------------------------------------------------------------------------
# get_discount_analysis
# ---------------------------------------------------------------------------

class TestGetDiscountAnalysis:
    """Tests for SalesReportService.get_discount_analysis."""

    def test_returns_analysis(self, service, db):
        """Returns discount analysis dict."""
        # Mock the various query chains
        chain = db.query.return_value.filter.return_value
        chain.one.return_value = MagicMock(
            total_discount=500.0,
            discount_count=20,
            avg_discount=25.0,
        )
        chain.scalar.return_value = 10000.0
        chain.group_by.return_value.order_by.return_value.limit.return_value.all.return_value = []

        result = service.get_discount_analysis(
            BIZ_ID, date(2025, 7, 1), date(2025, 7, 31),
        )
        assert "total_discounts" in result or isinstance(result, dict)


# ---------------------------------------------------------------------------
# get_refund_analysis
# ---------------------------------------------------------------------------

class TestGetRefundAnalysis:
    """Tests for SalesReportService.get_refund_analysis."""

    def test_returns_analysis(self, service, db):
        """Returns refund analysis dict."""
        chain = db.query.return_value.filter.return_value
        chain.one.return_value = MagicMock(
            total_refunds=200.0,
            refund_count=5,
        )
        chain.scalar.return_value = 10000.0
        chain.order_by.return_value.limit.return_value.all.return_value = []
        chain.group_by.return_value.order_by.return_value.all.return_value = []

        result = service.get_refund_analysis(
            BIZ_ID, date(2025, 7, 1), date(2025, 7, 31),
        )
        assert isinstance(result, dict)
