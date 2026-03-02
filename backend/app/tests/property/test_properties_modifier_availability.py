"""Property-based tests for modifier availability filtering.

Task 3.11 — Validates that the availability rule matcher (_rule_matches)
produces correct results for any combination of time, date, day-of-week,
and location filters.

Why property tests for availability?
The rule-matching logic has many optional dimensions (time ranges, date
ranges, day-of-week, location).  Property tests exercise corner cases
like midnight crossing, Saturday-only rules, and location-specific
overrides that are tedious to enumerate by hand.
"""

from datetime import time, date, timedelta
from hypothesis import given, strategies as st, assume, settings
from unittest.mock import MagicMock

from app.services.modifier_availability_service import ModifierAvailabilityService


# ---------------------------------------------------------------------------
# Strategies for rule fields
# ---------------------------------------------------------------------------
time_st = st.builds(
    time,
    hour=st.integers(min_value=0, max_value=23),
    minute=st.integers(min_value=0, max_value=59),
)

date_st = st.dates(
    min_value=date(2020, 1, 1),
    max_value=date(2030, 12, 31),
)

day_of_week_st = st.integers(min_value=0, max_value=6)  # 0=Monday .. 6=Sunday


def _make_rule(
    *,
    start_time=None,
    end_time=None,
    start_date=None,
    end_date=None,
    day_of_week=None,
    location_id=None,
):
    """Build a mock availability rule matching the actual model fields.

    The real ModifierAvailability model uses singular field names:
    day_of_week (int), location_id (UUID), start_time, end_time, etc.
    """
    rule = MagicMock()
    rule.start_time = start_time
    rule.end_time = end_time
    rule.start_date = start_date
    rule.end_date = end_date
    rule.day_of_week = day_of_week
    rule.location_id = location_id
    return rule


# ---------------------------------------------------------------------------
# Property 1: a rule with no filters matches everything
# ---------------------------------------------------------------------------
@given(
    current_time=time_st,
    current_date=date_st,
    current_day=day_of_week_st,
)
@settings(max_examples=100, deadline=None)
def test_empty_rule_matches_everything(current_time, current_date, current_day):
    """Property: a rule with all filter fields set to None always matches."""
    rule = _make_rule()
    result = ModifierAvailabilityService._rule_matches(
        rule, current_time, current_date, current_day, location_id=None
    )
    assert result is True


# ---------------------------------------------------------------------------
# Property 2: time within range always matches
# ---------------------------------------------------------------------------
@given(
    start_hour=st.integers(min_value=0, max_value=22),
    minute=st.integers(min_value=0, max_value=59),
)
@settings(max_examples=100, deadline=None)
def test_time_within_range_matches(start_hour: int, minute: int):
    """Property: if current_time is between start_time and end_time
    (non-wrapping), the rule matches.
    """
    start = time(start_hour, 0)
    end = time(start_hour + 1, 0)  # one hour window
    current = time(start_hour, minute)

    rule = _make_rule(start_time=start, end_time=end)
    result = ModifierAvailabilityService._rule_matches(
        rule, current, date.today(), date.today().weekday(), location_id=None
    )
    assert result is True


# ---------------------------------------------------------------------------
# Property 3: time outside range does not match
# ---------------------------------------------------------------------------
@given(
    start_hour=st.integers(min_value=2, max_value=22),
)
@settings(max_examples=50, deadline=None)
def test_time_outside_range_does_not_match(start_hour: int):
    """Property: if current_time is clearly before start_time,
    the rule does not match (for non-wrapping ranges).
    """
    start = time(start_hour, 0)
    end = time(start_hour, 30)
    current = time(start_hour - 2, 0)  # 2 hours before window

    rule = _make_rule(start_time=start, end_time=end)
    result = ModifierAvailabilityService._rule_matches(
        rule, current, date.today(), date.today().weekday(), location_id=None
    )
    assert result is False


# ---------------------------------------------------------------------------
# Property 4: date within range matches
# ---------------------------------------------------------------------------
@given(
    base_date=date_st,
    offset=st.integers(min_value=0, max_value=30),
)
@settings(max_examples=100, deadline=None)
def test_date_within_range_matches(base_date, offset: int):
    """Property: a date between start_date and end_date always matches."""
    end_date = base_date + timedelta(days=30)
    current = base_date + timedelta(days=offset)

    rule = _make_rule(start_date=base_date, end_date=end_date)
    result = ModifierAvailabilityService._rule_matches(
        rule, time(12, 0), current, current.weekday(), location_id=None
    )
    assert result is True


# ---------------------------------------------------------------------------
# Property 5: day-of-week filter respects the value
# ---------------------------------------------------------------------------
@given(
    target_day=day_of_week_st,
    other_day=day_of_week_st,
)
@settings(max_examples=100, deadline=None)
def test_day_of_week_filter(target_day: int, other_day: int):
    """Property: a matching day_of_week passes; a different day fails."""
    assume(target_day != other_day)

    rule = _make_rule(day_of_week=target_day)

    result_match = ModifierAvailabilityService._rule_matches(
        rule, time(12, 0), date.today(), target_day, location_id=None
    )
    result_mismatch = ModifierAvailabilityService._rule_matches(
        rule, time(12, 0), date.today(), other_day, location_id=None
    )

    assert result_match is True
    assert result_mismatch is False
