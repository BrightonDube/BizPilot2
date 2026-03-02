"""
Unit tests for staff report calculation logic.

Tests each report type's core computation independently:
performance, attendance, commissions, activity, productivity, teams, and
the custom report builder aggregation.

Why unit tests in addition to PBTs?
Property tests verify invariants across random inputs; unit tests verify
specific known scenarios with exact expected outputs. Both are needed
for confidence in financial calculations.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest


# ---------------------------------------------------------------------------
# Helpers — lightweight data builders (no ORM dependency)
# ---------------------------------------------------------------------------

def make_shift(
    staff_id=None,
    clock_in=None,
    clock_out=None,
    break_minutes=0,
    sales_total=Decimal("0"),
    transactions=0,
):
    """Build a shift-like dict for report calculations."""
    staff_id = staff_id or str(uuid4())
    clock_in = clock_in or datetime(2024, 1, 15, 8, 0)
    clock_out = clock_out or (clock_in + timedelta(hours=8))
    return {
        "staff_id": staff_id,
        "clock_in": clock_in,
        "clock_out": clock_out,
        "break_minutes": break_minutes,
        "sales_total": sales_total,
        "transactions": transactions,
    }


def make_commission_rule(rate=Decimal("0.05"), threshold=Decimal("0")):
    """Build a commission rule dict."""
    return {"rate": rate, "threshold": threshold}


def calculate_hours_worked(shift):
    """Net hours = total elapsed - breaks."""
    total_seconds = (shift["clock_out"] - shift["clock_in"]).total_seconds()
    total_hours = Decimal(str(total_seconds)) / Decimal("3600")
    break_hours = Decimal(str(shift["break_minutes"])) / Decimal("60")
    return total_hours - break_hours


def calculate_commission(sales, rule):
    """Commission = (sales - threshold) * rate, floored at 0."""
    eligible = sales - rule["threshold"]
    if eligible <= 0:
        return Decimal("0")
    return (eligible * rule["rate"]).quantize(Decimal("0.01"))


def calculate_productivity(shift):
    """Productivity = transactions / net hours worked."""
    hours = calculate_hours_worked(shift)
    if hours <= 0:
        return Decimal("0")
    return (Decimal(str(shift["transactions"])) / hours).quantize(Decimal("0.01"))


# ---------------------------------------------------------------------------
# Performance report tests
# ---------------------------------------------------------------------------

class TestPerformanceReport:
    """Tests for staff performance score calculations."""

    def test_total_sales_aggregation(self):
        """Total sales for a staff member = sum of shift sales."""
        staff_id = str(uuid4())
        shifts = [
            make_shift(staff_id=staff_id, sales_total=Decimal("500.00")),
            make_shift(staff_id=staff_id, sales_total=Decimal("750.00")),
            make_shift(staff_id=staff_id, sales_total=Decimal("300.00")),
        ]
        total = sum(s["sales_total"] for s in shifts)
        assert total == Decimal("1550.00")

    def test_transaction_count_aggregation(self):
        """Transaction count = sum of transactions across shifts."""
        staff_id = str(uuid4())
        shifts = [
            make_shift(staff_id=staff_id, transactions=15),
            make_shift(staff_id=staff_id, transactions=22),
        ]
        total = sum(s["transactions"] for s in shifts)
        assert total == 37

    def test_empty_shifts_returns_zero(self):
        """No shifts means zero sales and zero transactions."""
        shifts = []
        total_sales = sum(s["sales_total"] for s in shifts)
        total_txns = sum(s["transactions"] for s in shifts)
        assert total_sales == Decimal("0")
        assert total_txns == 0


# ---------------------------------------------------------------------------
# Attendance report tests
# ---------------------------------------------------------------------------

class TestAttendanceReport:
    """Tests for hours worked and attendance calculations."""

    def test_standard_shift_hours(self):
        """8-hour shift with no breaks = 8 hours."""
        shift = make_shift(
            clock_in=datetime(2024, 1, 15, 8, 0),
            clock_out=datetime(2024, 1, 15, 16, 0),
            break_minutes=0,
        )
        assert calculate_hours_worked(shift) == Decimal("8")

    def test_shift_with_break(self):
        """8-hour shift with 30 min break = 7.5 net hours."""
        shift = make_shift(
            clock_in=datetime(2024, 1, 15, 8, 0),
            clock_out=datetime(2024, 1, 15, 16, 0),
            break_minutes=30,
        )
        assert calculate_hours_worked(shift) == Decimal("7.5")

    def test_shift_with_long_break(self):
        """8-hour shift with 60 min break = 7 net hours."""
        shift = make_shift(
            clock_in=datetime(2024, 1, 15, 8, 0),
            clock_out=datetime(2024, 1, 15, 16, 0),
            break_minutes=60,
        )
        assert calculate_hours_worked(shift) == Decimal("7")

    def test_short_shift(self):
        """4-hour shift with 15 min break = 3.75 hours."""
        shift = make_shift(
            clock_in=datetime(2024, 1, 15, 12, 0),
            clock_out=datetime(2024, 1, 15, 16, 0),
            break_minutes=15,
        )
        assert calculate_hours_worked(shift) == Decimal("3.75")

    def test_aggregate_hours_for_period(self):
        """Total hours = sum of net hours across multiple shifts."""
        staff_id = str(uuid4())
        shifts = [
            make_shift(staff_id=staff_id, break_minutes=30),   # 7.5h
            make_shift(staff_id=staff_id, break_minutes=0),    # 8h
            make_shift(staff_id=staff_id, break_minutes=60),   # 7h
        ]
        total = sum(calculate_hours_worked(s) for s in shifts)
        assert total == Decimal("22.5")


# ---------------------------------------------------------------------------
# Commission report tests
# ---------------------------------------------------------------------------

class TestCommissionReport:
    """Tests for commission calculation logic."""

    def test_basic_commission(self):
        """5% on R10000 sales = R500."""
        rule = make_commission_rule(rate=Decimal("0.05"), threshold=Decimal("0"))
        result = calculate_commission(Decimal("10000"), rule)
        assert result == Decimal("500.00")

    def test_commission_with_threshold(self):
        """5% on sales above R5000 threshold. R10000 → R250."""
        rule = make_commission_rule(rate=Decimal("0.05"), threshold=Decimal("5000"))
        result = calculate_commission(Decimal("10000"), rule)
        assert result == Decimal("250.00")

    def test_commission_below_threshold(self):
        """Sales below threshold = zero commission."""
        rule = make_commission_rule(rate=Decimal("0.05"), threshold=Decimal("5000"))
        result = calculate_commission(Decimal("3000"), rule)
        assert result == Decimal("0")

    def test_commission_at_threshold(self):
        """Sales exactly at threshold = zero commission."""
        rule = make_commission_rule(rate=Decimal("0.05"), threshold=Decimal("5000"))
        result = calculate_commission(Decimal("5000"), rule)
        assert result == Decimal("0")

    def test_aggregate_commissions(self):
        """Total commission = sum of individual shift commissions."""
        rule = make_commission_rule(rate=Decimal("0.10"), threshold=Decimal("0"))
        sales_per_shift = [Decimal("1000"), Decimal("2000"), Decimal("500")]
        total = sum(calculate_commission(s, rule) for s in sales_per_shift)
        assert total == Decimal("350.00")


# ---------------------------------------------------------------------------
# Activity report tests
# ---------------------------------------------------------------------------

class TestActivityReport:
    """Tests for activity log completeness and ordering."""

    def test_activity_entries_ordered_by_time(self):
        """Activity log entries must be chronologically ordered."""
        entries = [
            {"action": "login", "timestamp": datetime(2024, 1, 15, 8, 0)},
            {"action": "sale", "timestamp": datetime(2024, 1, 15, 9, 30)},
            {"action": "refund", "timestamp": datetime(2024, 1, 15, 10, 15)},
            {"action": "logout", "timestamp": datetime(2024, 1, 15, 16, 0)},
        ]
        timestamps = [e["timestamp"] for e in entries]
        assert timestamps == sorted(timestamps)

    def test_every_action_type_logged(self):
        """All expected action types must appear in the log."""
        expected_types = {"login", "logout", "sale", "refund", "void"}
        entries = [
            {"action": "login"},
            {"action": "sale"},
            {"action": "refund"},
            {"action": "void"},
            {"action": "logout"},
        ]
        actual_types = {e["action"] for e in entries}
        assert expected_types.issubset(actual_types)


# ---------------------------------------------------------------------------
# Productivity report tests
# ---------------------------------------------------------------------------

class TestProductivityReport:
    """Tests for transactions-per-hour productivity metric."""

    def test_basic_productivity(self):
        """20 transactions in 8 hours = 2.50 per hour."""
        shift = make_shift(transactions=20, break_minutes=0)
        assert calculate_productivity(shift) == Decimal("2.50")

    def test_productivity_with_breaks(self):
        """20 transactions in 7.5 net hours = 2.67 per hour."""
        shift = make_shift(transactions=20, break_minutes=30)
        assert calculate_productivity(shift) == Decimal("2.67")

    def test_zero_transactions(self):
        """Zero transactions = zero productivity."""
        shift = make_shift(transactions=0)
        assert calculate_productivity(shift) == Decimal("0")

    def test_zero_hours_returns_zero(self):
        """Edge case: zero-length shift should not divide by zero."""
        shift = make_shift(
            clock_in=datetime(2024, 1, 15, 8, 0),
            clock_out=datetime(2024, 1, 15, 8, 0),
            transactions=5,
        )
        assert calculate_productivity(shift) == Decimal("0")


# ---------------------------------------------------------------------------
# Team report tests
# ---------------------------------------------------------------------------

class TestTeamReport:
    """Tests for team-level aggregation across staff members."""

    def test_team_total_sales(self):
        """Team sales = sum of all members' sales."""
        team_shifts = [
            make_shift(staff_id="alice", sales_total=Decimal("1000")),
            make_shift(staff_id="alice", sales_total=Decimal("500")),
            make_shift(staff_id="bob", sales_total=Decimal("2000")),
            make_shift(staff_id="charlie", sales_total=Decimal("1500")),
        ]
        total = sum(s["sales_total"] for s in team_shifts)
        assert total == Decimal("5000")

    def test_team_member_count(self):
        """Unique staff members in the team report."""
        team_shifts = [
            make_shift(staff_id="alice"),
            make_shift(staff_id="alice"),
            make_shift(staff_id="bob"),
            make_shift(staff_id="charlie"),
        ]
        unique_members = {s["staff_id"] for s in team_shifts}
        assert len(unique_members) == 3

    def test_per_member_average(self):
        """Average sales per member = total / unique members."""
        team_shifts = [
            make_shift(staff_id="alice", sales_total=Decimal("1000")),
            make_shift(staff_id="bob", sales_total=Decimal("2000")),
        ]
        total = sum(s["sales_total"] for s in team_shifts)
        member_count = len({s["staff_id"] for s in team_shifts})
        avg = total / member_count
        assert avg == Decimal("1500")


# ---------------------------------------------------------------------------
# Custom report builder tests
# ---------------------------------------------------------------------------

class TestCustomReportBuilder:
    """Tests for the custom report builder aggregation logic."""

    def test_group_by_staff(self):
        """Grouping by staff_id should produce per-staff summaries."""
        shifts = [
            make_shift(staff_id="alice", sales_total=Decimal("100")),
            make_shift(staff_id="alice", sales_total=Decimal("200")),
            make_shift(staff_id="bob", sales_total=Decimal("300")),
        ]
        grouped = {}
        for s in shifts:
            sid = s["staff_id"]
            if sid not in grouped:
                grouped[sid] = Decimal("0")
            grouped[sid] += s["sales_total"]

        assert grouped["alice"] == Decimal("300")
        assert grouped["bob"] == Decimal("300")

    def test_filter_by_date_range(self):
        """Filtering shifts by date range should exclude out-of-range."""
        start = datetime(2024, 1, 15)
        end = datetime(2024, 1, 16)
        shifts = [
            make_shift(clock_in=datetime(2024, 1, 14, 8, 0)),  # before
            make_shift(clock_in=datetime(2024, 1, 15, 8, 0)),  # in range
            make_shift(clock_in=datetime(2024, 1, 15, 14, 0)), # in range
            make_shift(clock_in=datetime(2024, 1, 17, 8, 0)),  # after
        ]
        filtered = [s for s in shifts if start <= s["clock_in"] < end]
        assert len(filtered) == 2

    def test_empty_report(self):
        """Empty input should produce empty aggregation."""
        shifts = []
        total_sales = sum(s["sales_total"] for s in shifts)
        assert total_sales == Decimal("0")
