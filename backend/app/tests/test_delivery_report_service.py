"""Tests for DeliveryReportService."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from app.services.delivery_report_service import DeliveryReportService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

BIZ = "business-uuid-1"


def _svc():
    db = MagicMock()
    return DeliveryReportService(db), db


def _chain(first=None, rows=None, count=0):
    q = MagicMock()
    q.filter = MagicMock(return_value=q)
    q.join = MagicMock(return_value=q)
    q.group_by = MagicMock(return_value=q)
    q.order_by = MagicMock(return_value=q)
    q.offset = MagicMock(return_value=q)
    q.limit = MagicMock(return_value=q)
    q.all = MagicMock(return_value=rows or [])
    q.first = MagicMock(return_value=first)
    q.count = MagicMock(return_value=count)
    return q


def _row(**kwargs):
    """Create a named-attribute mock row."""
    r = MagicMock()
    for k, v in kwargs.items():
        setattr(r, k, v)
    return r


# ===================================================================
# delivery_time_report
# ===================================================================


class TestDeliveryTimeReport:
    """Tests for delivery_time_report."""

    def test_basic_report(self):
        svc, db = _svc()
        row = _row(total=10, avg_diff_min=15.456, min_diff_min=-5.3, max_diff_min=42.789)
        db.query.return_value = _chain(first=row)

        result = svc.delivery_time_report(BIZ)

        assert result["total_delivered"] == 10
        assert result["avg_diff_minutes"] == 15.5
        assert result["fastest_diff_minutes"] == -5.3
        assert result["slowest_diff_minutes"] == 42.8

    def test_empty_result_none_values(self):
        svc, db = _svc()
        row = _row(total=None, avg_diff_min=None, min_diff_min=None, max_diff_min=None)
        db.query.return_value = _chain(first=row)

        result = svc.delivery_time_report(BIZ)

        assert result["total_delivered"] == 0
        assert result["avg_diff_minutes"] == 0.0
        assert result["fastest_diff_minutes"] == 0.0
        assert result["slowest_diff_minutes"] == 0.0

    def test_zero_total(self):
        svc, db = _svc()
        row = _row(total=0, avg_diff_min=None, min_diff_min=None, max_diff_min=None)
        db.query.return_value = _chain(first=row)

        result = svc.delivery_time_report(BIZ)

        assert result["total_delivered"] == 0

    def test_rounding_applied(self):
        svc, db = _svc()
        row = _row(total=5, avg_diff_min=10.149, min_diff_min=1.05, max_diff_min=99.95)
        db.query.return_value = _chain(first=row)

        result = svc.delivery_time_report(BIZ)

        assert result["avg_diff_minutes"] == 10.1
        assert result["fastest_diff_minutes"] == 1.1  # round(1.05, 1)
        assert result["slowest_diff_minutes"] == 100.0  # round(99.95, 1)

    def test_negative_diffs(self):
        """Early deliveries produce negative diff values."""
        svc, db = _svc()
        row = _row(total=3, avg_diff_min=-12.7, min_diff_min=-30.0, max_diff_min=-1.2)
        db.query.return_value = _chain(first=row)

        result = svc.delivery_time_report(BIZ)

        assert result["avg_diff_minutes"] == -12.7
        assert result["fastest_diff_minutes"] == -30.0
        assert result["slowest_diff_minutes"] == -1.2

    def test_date_from_filter(self):
        svc, db = _svc()
        row = _row(total=1, avg_diff_min=5.0, min_diff_min=5.0, max_diff_min=5.0)
        chain = _chain(first=row)
        db.query.return_value = chain

        dt = datetime(2024, 1, 1, tzinfo=timezone.utc)
        svc.delivery_time_report(BIZ, date_from=dt)

        chain.filter.assert_called_once()

    def test_date_to_filter(self):
        svc, db = _svc()
        row = _row(total=1, avg_diff_min=5.0, min_diff_min=5.0, max_diff_min=5.0)
        chain = _chain(first=row)
        db.query.return_value = chain

        dt = datetime(2024, 12, 31, tzinfo=timezone.utc)
        svc.delivery_time_report(BIZ, date_to=dt)

        chain.filter.assert_called_once()

    def test_both_date_filters(self):
        svc, db = _svc()
        row = _row(total=2, avg_diff_min=7.0, min_diff_min=3.0, max_diff_min=11.0)
        chain = _chain(first=row)
        db.query.return_value = chain

        d1 = datetime(2024, 1, 1, tzinfo=timezone.utc)
        d2 = datetime(2024, 6, 30, tzinfo=timezone.utc)
        result = svc.delivery_time_report(BIZ, date_from=d1, date_to=d2)

        assert result["total_delivered"] == 2
        chain.filter.assert_called_once()

    def test_decimal_input_values(self):
        svc, db = _svc()
        row = _row(
            total=4,
            avg_diff_min=Decimal("22.345"),
            min_diff_min=Decimal("5.678"),
            max_diff_min=Decimal("40.111"),
        )
        db.query.return_value = _chain(first=row)

        result = svc.delivery_time_report(BIZ)

        assert result["avg_diff_minutes"] == 22.3
        assert result["fastest_diff_minutes"] == 5.7
        assert result["slowest_diff_minutes"] == 40.1

    def test_return_type(self):
        svc, db = _svc()
        row = _row(total=1, avg_diff_min=0.0, min_diff_min=0.0, max_diff_min=0.0)
        db.query.return_value = _chain(first=row)

        result = svc.delivery_time_report(BIZ)

        assert isinstance(result, dict)
        assert set(result.keys()) == {
            "total_delivered",
            "avg_diff_minutes",
            "fastest_diff_minutes",
            "slowest_diff_minutes",
        }


# ===================================================================
# zone_performance_report
# ===================================================================


class TestZonePerformanceReport:
    """Tests for zone_performance_report."""

    def test_single_zone(self):
        svc, db = _svc()
        rows = [_row(zone_name="CBD", total=20, delivered=18, failed=2, total_fees=Decimal("500.00"))]
        db.query.return_value = _chain(rows=rows)

        result = svc.zone_performance_report(BIZ)

        assert len(result) == 1
        z = result[0]
        assert z["zone_name"] == "CBD"
        assert z["total_deliveries"] == 20
        assert z["delivered"] == 18
        assert z["failed"] == 2
        assert z["success_rate"] == 90.0
        assert z["total_fees"] == 500.0

    def test_multiple_zones(self):
        svc, db = _svc()
        rows = [
            _row(zone_name="North", total=10, delivered=9, failed=1, total_fees=Decimal("200.00")),
            _row(zone_name="South", total=5, delivered=3, failed=2, total_fees=Decimal("100.00")),
            _row(zone_name="East", total=8, delivered=8, failed=0, total_fees=Decimal("320.00")),
        ]
        db.query.return_value = _chain(rows=rows)

        result = svc.zone_performance_report(BIZ)

        assert len(result) == 3
        names = [z["zone_name"] for z in result]
        assert names == ["North", "South", "East"]

    def test_empty_no_zones(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[])

        result = svc.zone_performance_report(BIZ)

        assert result == []

    def test_zero_total_zone(self):
        """Zone with total=0 should return success_rate=0, no division error."""
        svc, db = _svc()
        rows = [_row(zone_name="Ghost", total=0, delivered=0, failed=0, total_fees=Decimal("0"))]
        db.query.return_value = _chain(rows=rows)

        result = svc.zone_performance_report(BIZ)

        assert result[0]["success_rate"] == 0
        assert result[0]["total_deliveries"] == 0

    def test_none_values_in_row(self):
        """None counts default to 0."""
        svc, db = _svc()
        rows = [_row(zone_name="Remote", total=None, delivered=None, failed=None, total_fees=Decimal("0"))]
        db.query.return_value = _chain(rows=rows)

        result = svc.zone_performance_report(BIZ)

        z = result[0]
        assert z["total_deliveries"] == 0
        assert z["delivered"] == 0
        assert z["failed"] == 0
        assert z["success_rate"] == 0

    def test_success_rate_rounding(self):
        svc, db = _svc()
        rows = [_row(zone_name="X", total=3, delivered=1, failed=2, total_fees=Decimal("90.00"))]
        db.query.return_value = _chain(rows=rows)

        result = svc.zone_performance_report(BIZ)

        # 1/3 * 100 = 33.333... -> 33.3
        assert result[0]["success_rate"] == 33.3

    def test_all_delivered(self):
        svc, db = _svc()
        rows = [_row(zone_name="Best", total=50, delivered=50, failed=0, total_fees=Decimal("2500.00"))]
        db.query.return_value = _chain(rows=rows)

        result = svc.zone_performance_report(BIZ)

        assert result[0]["success_rate"] == 100.0

    def test_all_failed(self):
        svc, db = _svc()
        rows = [_row(zone_name="Worst", total=10, delivered=0, failed=10, total_fees=Decimal("0"))]
        db.query.return_value = _chain(rows=rows)

        result = svc.zone_performance_report(BIZ)

        assert result[0]["success_rate"] == 0

    def test_total_fees_float(self):
        svc, db = _svc()
        rows = [_row(zone_name="A", total=1, delivered=1, failed=0, total_fees=Decimal("123.45"))]
        db.query.return_value = _chain(rows=rows)

        result = svc.zone_performance_report(BIZ)

        assert isinstance(result[0]["total_fees"], float)
        assert result[0]["total_fees"] == 123.45

    def test_date_filters_passed(self):
        svc, db = _svc()
        chain = _chain(rows=[])
        db.query.return_value = chain

        d1 = datetime(2024, 3, 1, tzinfo=timezone.utc)
        d2 = datetime(2024, 3, 31, tzinfo=timezone.utc)
        svc.zone_performance_report(BIZ, date_from=d1, date_to=d2)

        chain.join.assert_called_once()
        chain.filter.assert_called_once()
        chain.group_by.assert_called_once()

    def test_return_type(self):
        svc, db = _svc()
        rows = [_row(zone_name="Z", total=1, delivered=1, failed=0, total_fees=Decimal("10.00"))]
        db.query.return_value = _chain(rows=rows)

        result = svc.zone_performance_report(BIZ)

        assert isinstance(result, list)
        assert isinstance(result[0], dict)
        assert set(result[0].keys()) == {
            "zone_name",
            "total_deliveries",
            "delivered",
            "failed",
            "success_rate",
            "total_fees",
        }


# ===================================================================
# cost_analysis_report
# ===================================================================


class TestCostAnalysisReport:
    """Tests for cost_analysis_report."""

    def test_basic_report(self):
        svc, db = _svc()
        row = _row(
            total=30,
            total_fees=Decimal("1500.00"),
            avg_fee=Decimal("50.00"),
            collected_fees=Decimal("1200.00"),
            lost_fees=Decimal("300.00"),
        )
        db.query.return_value = _chain(first=row)

        result = svc.cost_analysis_report(BIZ)

        assert result["total_deliveries"] == 30
        assert result["total_fees"] == 1500.0
        assert result["avg_fee"] == 50.0
        assert result["collected_fees"] == 1200.0
        assert result["lost_fees"] == 300.0

    def test_empty_result_all_none(self):
        svc, db = _svc()
        row = _row(total=None, total_fees=None, avg_fee=None, collected_fees=None, lost_fees=None)
        db.query.return_value = _chain(first=row)

        result = svc.cost_analysis_report(BIZ)

        assert result["total_deliveries"] == 0
        assert result["total_fees"] == 0.0
        assert result["avg_fee"] == 0.0
        assert result["collected_fees"] == 0.0
        assert result["lost_fees"] == 0.0

    def test_zero_total(self):
        svc, db = _svc()
        row = _row(total=0, total_fees=Decimal("0"), avg_fee=None, collected_fees=Decimal("0"), lost_fees=Decimal("0"))
        db.query.return_value = _chain(first=row)

        result = svc.cost_analysis_report(BIZ)

        assert result["total_deliveries"] == 0
        assert result["avg_fee"] == 0.0

    def test_avg_fee_rounding(self):
        svc, db = _svc()
        row = _row(
            total=3,
            total_fees=Decimal("100.00"),
            avg_fee=Decimal("33.333"),
            collected_fees=Decimal("66.67"),
            lost_fees=Decimal("33.33"),
        )
        db.query.return_value = _chain(first=row)

        result = svc.cost_analysis_report(BIZ)

        assert result["avg_fee"] == 33.33

    def test_large_values(self):
        svc, db = _svc()
        row = _row(
            total=10000,
            total_fees=Decimal("999999.99"),
            avg_fee=Decimal("100.00"),
            collected_fees=Decimal("800000.00"),
            lost_fees=Decimal("199999.99"),
        )
        db.query.return_value = _chain(first=row)

        result = svc.cost_analysis_report(BIZ)

        assert result["total_deliveries"] == 10000
        assert result["total_fees"] == 999999.99
        assert result["collected_fees"] == 800000.0
        assert result["lost_fees"] == 199999.99

    def test_date_from_only(self):
        svc, db = _svc()
        row = _row(total=5, total_fees=Decimal("100"), avg_fee=Decimal("20"), collected_fees=Decimal("80"), lost_fees=Decimal("20"))
        chain = _chain(first=row)
        db.query.return_value = chain

        svc.cost_analysis_report(BIZ, date_from=datetime(2024, 1, 1, tzinfo=timezone.utc))

        chain.filter.assert_called_once()

    def test_date_to_only(self):
        svc, db = _svc()
        row = _row(total=5, total_fees=Decimal("100"), avg_fee=Decimal("20"), collected_fees=Decimal("80"), lost_fees=Decimal("20"))
        chain = _chain(first=row)
        db.query.return_value = chain

        svc.cost_analysis_report(BIZ, date_to=datetime(2024, 12, 31, tzinfo=timezone.utc))

        chain.filter.assert_called_once()

    def test_both_dates(self):
        svc, db = _svc()
        row = _row(total=7, total_fees=Decimal("350"), avg_fee=Decimal("50"), collected_fees=Decimal("300"), lost_fees=Decimal("50"))
        chain = _chain(first=row)
        db.query.return_value = chain

        d1 = datetime(2024, 1, 1, tzinfo=timezone.utc)
        d2 = datetime(2024, 6, 30, tzinfo=timezone.utc)
        result = svc.cost_analysis_report(BIZ, date_from=d1, date_to=d2)

        assert result["total_deliveries"] == 7

    def test_return_type(self):
        svc, db = _svc()
        row = _row(total=1, total_fees=Decimal("10"), avg_fee=Decimal("10"), collected_fees=Decimal("10"), lost_fees=Decimal("0"))
        db.query.return_value = _chain(first=row)

        result = svc.cost_analysis_report(BIZ)

        assert isinstance(result, dict)
        assert set(result.keys()) == {
            "total_deliveries",
            "total_fees",
            "avg_fee",
            "collected_fees",
            "lost_fees",
        }

    def test_float_conversion(self):
        """All monetary values should be float."""
        svc, db = _svc()
        row = _row(total=2, total_fees=Decimal("50"), avg_fee=Decimal("25"), collected_fees=Decimal("30"), lost_fees=Decimal("20"))
        db.query.return_value = _chain(first=row)

        result = svc.cost_analysis_report(BIZ)

        for key in ("total_fees", "avg_fee", "collected_fees", "lost_fees"):
            assert isinstance(result[key], float), f"{key} should be float"


# ===================================================================
# driver_comparison_report
# ===================================================================


class TestDriverComparisonReport:
    """Tests for driver_comparison_report."""

    def test_single_driver(self):
        svc, db = _svc()
        rows = [_row(driver_name="Alice", total=20, delivered=18, failed=2, total_fees=Decimal("600.00"))]
        db.query.return_value = _chain(rows=rows)

        result = svc.driver_comparison_report(BIZ)

        assert len(result) == 1
        d = result[0]
        assert d["driver_name"] == "Alice"
        assert d["total_deliveries"] == 20
        assert d["delivered"] == 18
        assert d["failed"] == 2
        assert d["success_rate"] == 90.0
        assert d["total_fees"] == 600.0

    def test_multiple_drivers_sorted_by_success_rate(self):
        svc, db = _svc()
        rows = [
            _row(driver_name="Bob", total=10, delivered=5, failed=5, total_fees=Decimal("200.00")),
            _row(driver_name="Eve", total=10, delivered=10, failed=0, total_fees=Decimal("400.00")),
            _row(driver_name="Dan", total=10, delivered=7, failed=3, total_fees=Decimal("280.00")),
        ]
        db.query.return_value = _chain(rows=rows)

        result = svc.driver_comparison_report(BIZ)

        names = [d["driver_name"] for d in result]
        assert names == ["Eve", "Dan", "Bob"]
        assert result[0]["success_rate"] == 100.0
        assert result[1]["success_rate"] == 70.0
        assert result[2]["success_rate"] == 50.0

    def test_empty_no_drivers(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[])

        result = svc.driver_comparison_report(BIZ)

        assert result == []

    def test_zero_total_driver(self):
        """Driver with 0 total should have success_rate=0, no ZeroDivisionError."""
        svc, db = _svc()
        rows = [_row(driver_name="Ghost", total=0, delivered=0, failed=0, total_fees=Decimal("0"))]
        db.query.return_value = _chain(rows=rows)

        result = svc.driver_comparison_report(BIZ)

        assert result[0]["success_rate"] == 0
        assert result[0]["total_deliveries"] == 0

    def test_none_values_default_to_zero(self):
        svc, db = _svc()
        rows = [_row(driver_name="Null", total=None, delivered=None, failed=None, total_fees=Decimal("0"))]
        db.query.return_value = _chain(rows=rows)

        result = svc.driver_comparison_report(BIZ)

        d = result[0]
        assert d["total_deliveries"] == 0
        assert d["delivered"] == 0
        assert d["failed"] == 0
        assert d["success_rate"] == 0

    def test_success_rate_rounding(self):
        svc, db = _svc()
        rows = [_row(driver_name="Precise", total=7, delivered=3, failed=4, total_fees=Decimal("140.00"))]
        db.query.return_value = _chain(rows=rows)

        result = svc.driver_comparison_report(BIZ)

        # 3/7 * 100 = 42.857... -> 42.9
        assert result[0]["success_rate"] == 42.9

    def test_all_delivered(self):
        svc, db = _svc()
        rows = [_row(driver_name="Star", total=100, delivered=100, failed=0, total_fees=Decimal("5000.00"))]
        db.query.return_value = _chain(rows=rows)

        result = svc.driver_comparison_report(BIZ)

        assert result[0]["success_rate"] == 100.0

    def test_all_failed(self):
        svc, db = _svc()
        rows = [_row(driver_name="Bad", total=15, delivered=0, failed=15, total_fees=Decimal("0"))]
        db.query.return_value = _chain(rows=rows)

        result = svc.driver_comparison_report(BIZ)

        assert result[0]["success_rate"] == 0

    def test_date_filters(self):
        svc, db = _svc()
        chain = _chain(rows=[])
        db.query.return_value = chain

        d1 = datetime(2024, 4, 1, tzinfo=timezone.utc)
        d2 = datetime(2024, 4, 30, tzinfo=timezone.utc)
        svc.driver_comparison_report(BIZ, date_from=d1, date_to=d2)

        chain.join.assert_called_once()
        chain.filter.assert_called_once()
        chain.group_by.assert_called_once()

    def test_tied_success_rates_stable_sort(self):
        """Drivers with same success_rate should not cause errors."""
        svc, db = _svc()
        rows = [
            _row(driver_name="A", total=10, delivered=8, failed=2, total_fees=Decimal("100.00")),
            _row(driver_name="B", total=10, delivered=8, failed=2, total_fees=Decimal("200.00")),
        ]
        db.query.return_value = _chain(rows=rows)

        result = svc.driver_comparison_report(BIZ)

        assert len(result) == 2
        assert result[0]["success_rate"] == result[1]["success_rate"] == 80.0

    def test_total_fees_float(self):
        svc, db = _svc()
        rows = [_row(driver_name="F", total=1, delivered=1, failed=0, total_fees=Decimal("77.77"))]
        db.query.return_value = _chain(rows=rows)

        result = svc.driver_comparison_report(BIZ)

        assert isinstance(result[0]["total_fees"], float)
        assert result[0]["total_fees"] == 77.77

    def test_return_type(self):
        svc, db = _svc()
        rows = [_row(driver_name="X", total=1, delivered=1, failed=0, total_fees=Decimal("10.00"))]
        db.query.return_value = _chain(rows=rows)

        result = svc.driver_comparison_report(BIZ)

        assert isinstance(result, list)
        assert isinstance(result[0], dict)
        assert set(result[0].keys()) == {
            "driver_name",
            "total_deliveries",
            "delivered",
            "failed",
            "success_rate",
            "total_fees",
        }
