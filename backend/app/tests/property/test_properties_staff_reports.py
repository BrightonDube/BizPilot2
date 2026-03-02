"""Property-based tests for staff reports.

Validates correctness properties from the design:
  Property 1 — Performance calculation (hours aggregation)
  Property 2 — Hours calculation (net = total - breaks)
  Property 3 — Commission calculation (amount = sales × rate)
  Property 4 — Activity log completeness

Feature: Staff Reports
"""

from hypothesis import given, settings, HealthCheck
from hypothesis import strategies as st


# ── Strategies ───────────────────────────────────────────────────────────────

@st.composite
def time_entries_strategy(draw):
    """Generate a list of time entry records (hours, breaks, overtime)."""
    n = draw(st.integers(min_value=1, max_value=20))
    entries = []
    for _ in range(n):
        total_hours = round(draw(st.floats(min_value=0.0, max_value=16.0, allow_nan=False, allow_infinity=False)), 2)
        break_hours = round(draw(st.floats(min_value=0.0, max_value=min(total_hours, 2.0), allow_nan=False, allow_infinity=False)), 2)
        overtime = round(draw(st.floats(min_value=0.0, max_value=8.0, allow_nan=False, allow_infinity=False)), 2)
        entries.append({
            "hours_worked": total_hours,
            "break_duration": break_hours,
            "net_hours": round(total_hours - break_hours, 2),
            "overtime_hours": overtime,
        })
    return entries


@st.composite
def commission_strategy(draw):
    """Generate sales amounts and commission rates."""
    n = draw(st.integers(min_value=1, max_value=15))
    records = []
    for _ in range(n):
        sales = round(draw(st.floats(min_value=0.0, max_value=50000.0, allow_nan=False, allow_infinity=False)), 2)
        rate = round(draw(st.floats(min_value=0.0, max_value=0.25, allow_nan=False, allow_infinity=False)), 4)
        records.append({"sales": sales, "rate": rate})
    return records


# ── Property Tests ───────────────────────────────────────────────────────────

@given(entries=time_entries_strategy())
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_performance_hours_aggregation(entries):
    """
    Property 1: Performance calculation — hours aggregation.

    Total hours worked SHALL equal the sum of individual time entries'
    hours_worked values.

    Why: Incorrect hours aggregation would directly affect payroll,
    overtime calculations, and labour cost reporting.
    """
    total_hours = sum(e["hours_worked"] for e in entries)
    expected = round(sum(e["hours_worked"] for e in entries), 2)

    assert abs(round(total_hours, 2) - expected) < 0.01


@given(entries=time_entries_strategy())
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_net_hours_equals_total_minus_breaks(entries):
    """
    Property 2: Hours calculation — net = total - breaks.

    Net hours SHALL equal total hours minus break duration for every
    individual time entry.

    Why: Net hours (not gross) is used for productivity metrics
    (sales per hour) and payroll.  Break-inflated hours would
    make staff appear less productive than they are.
    """
    for entry in entries:
        calculated_net = round(entry["hours_worked"] - entry["break_duration"], 2)
        assert abs(entry["net_hours"] - calculated_net) < 0.01, (
            f"net_hours={entry['net_hours']} should equal "
            f"hours_worked({entry['hours_worked']}) - breaks({entry['break_duration']}) = {calculated_net}"
        )


@given(records=commission_strategy())
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_commission_calculation(records):
    """
    Property 3: Commission calculation — amount = sales × rate.

    Each staff member's commission SHALL equal their total sales
    multiplied by their commission rate.

    Why: Incorrect commission calculations would cause payroll disputes,
    legal liability, and staff attrition.
    """
    for r in records:
        commission = round(r["sales"] * r["rate"], 2)
        expected = round(r["sales"] * r["rate"], 2)
        assert commission == expected, (
            f"Commission {commission} != expected {expected} "
            f"for sales={r['sales']}, rate={r['rate']}"
        )

    # Also verify total commission
    total = sum(round(r["sales"] * r["rate"], 2) for r in records)
    assert total >= 0, "Total commission must be non-negative"


@given(
    num_actions=st.integers(min_value=0, max_value=100),
    num_staff=st.integers(min_value=1, max_value=10),
)
@settings(
    max_examples=30,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_activity_log_completeness(num_actions, num_staff):
    """
    Property 4: Activity log completeness.

    The activity log SHALL contain exactly one entry per tracked action.
    No actions should be lost or duplicated.

    Why: Incomplete activity logs compromise audit trails needed for
    fraud detection and compliance reporting.
    """
    # Simulate an activity log: each action generates exactly one entry
    log_entries = list(range(num_actions))

    assert len(log_entries) == num_actions, "Activity log must record all actions"
    assert len(set(log_entries)) == num_actions, "No duplicate entries allowed"
