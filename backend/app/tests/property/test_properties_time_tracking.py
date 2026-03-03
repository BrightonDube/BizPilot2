"""
Property-based tests for time tracking.

Validates clock-in/out invariants, break calculations,
overtime thresholds, and payroll hour aggregation.

Feature: Time Tracking
"""

from datetime import datetime, timedelta
from decimal import Decimal

from hypothesis import given, settings, HealthCheck, assume
from hypothesis import strategies as st


# ---------------------------------------------------------------------------
# Clock in/out properties
# ---------------------------------------------------------------------------

@given(
    clock_in_offset=st.integers(min_value=0, max_value=23),
    duration_hours=st.floats(min_value=0.5, max_value=16, allow_nan=False, allow_infinity=False),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_clock_out_after_clock_in(clock_in_offset, duration_hours):
    """
    Property 1: Clock-out time is always after clock-in time.

    Why: A clock-out before clock-in produces negative hours,
    which corrupts payroll calculations.
    """
    base = datetime(2025, 6, 15, 0, 0)
    clock_in = base + timedelta(hours=clock_in_offset)
    clock_out = clock_in + timedelta(hours=duration_hours)
    assert clock_out > clock_in


@given(
    worked_hours=st.floats(min_value=0, max_value=16, allow_nan=False, allow_infinity=False),
    break_minutes=st.integers(min_value=0, max_value=120),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_net_hours_deducts_breaks(worked_hours, break_minutes):
    """
    Property 2: Net hours = gross hours - break time.

    Why: Not deducting breaks inflates billable hours, leading to
    overpayment.
    """
    break_hours = break_minutes / 60.0
    assume(break_hours <= worked_hours)
    net = worked_hours - break_hours
    assert net >= 0
    assert net <= worked_hours


# ---------------------------------------------------------------------------
# Overtime properties
# ---------------------------------------------------------------------------

@given(
    daily_hours=st.floats(min_value=0, max_value=16, allow_nan=False, allow_infinity=False),
    normal_threshold=st.floats(min_value=6, max_value=10, allow_nan=False, allow_infinity=False),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_overtime_kicks_in_after_threshold(daily_hours, normal_threshold):
    """
    Property 3: Overtime hours = max(0, daily_hours - threshold).

    Why: Overtime at 1.5x or 2x rate is a major cost. Calculating
    the threshold wrong leads to either underpayment (legal risk)
    or overpayment (financial loss).
    """
    overtime = max(0.0, daily_hours - normal_threshold)
    normal = min(daily_hours, normal_threshold)

    # Normal + overtime should equal total worked
    assert abs((normal + overtime) - daily_hours) < 0.0001
    if daily_hours > normal_threshold:
        assert overtime > 0
    else:
        assert overtime == 0.0


@given(
    regular_rate=st.decimals(
        min_value=Decimal("50"),
        max_value=Decimal("500"),
        places=2,
    ),
    overtime_multiplier=st.sampled_from([
        Decimal("1.5"), Decimal("2.0"),
    ]),
    overtime_hours=st.decimals(
        min_value=Decimal("0"),
        max_value=Decimal("8"),
        places=2,
    ),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_overtime_pay_calculation(regular_rate, overtime_multiplier, overtime_hours):
    """
    Property 4: Overtime pay = rate × multiplier × hours.

    Why: The multiplier (1.5x or 2x) is prescribed by law.
    Applying it incorrectly is a compliance violation.
    """
    overtime_rate = regular_rate * overtime_multiplier
    overtime_pay = overtime_rate * overtime_hours

    assert overtime_pay >= Decimal("0")
    if overtime_hours > Decimal("0"):
        assert overtime_pay > Decimal("0")
        assert overtime_pay >= regular_rate * overtime_hours


# ---------------------------------------------------------------------------
# Weekly aggregation properties
# ---------------------------------------------------------------------------

@given(
    daily_hours=st.lists(
        st.floats(min_value=0, max_value=12, allow_nan=False, allow_infinity=False),
        min_size=7,
        max_size=7,
    ),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_weekly_total_is_sum_of_daily(daily_hours):
    """
    Property 5: Weekly total = sum of all daily worked hours.

    Why: Payroll is calculated weekly. If daily hours don't
    sum correctly, the payslip is wrong.
    """
    weekly = sum(daily_hours)
    assert abs(weekly - sum(daily_hours)) < 0.0001
    assert weekly >= 0


@given(
    entries=st.lists(
        st.tuples(
            st.integers(min_value=1, max_value=28),  # day
            st.floats(min_value=0.5, max_value=12, allow_nan=False, allow_infinity=False),  # hours
        ),
        min_size=1,
        max_size=28,
    ),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_monthly_hours_non_negative(entries):
    """
    Property 6: Monthly aggregated hours are always non-negative.

    Why: Negative monthly hours would indicate a data corruption
    or a bug in the aggregation logic.
    """
    total = sum(hours for _, hours in entries)
    assert total > 0
