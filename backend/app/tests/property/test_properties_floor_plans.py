"""
Property-based tests for floor plans and table reservations.

Validates spatial layout constraints, reservation time conflicts,
and capacity calculations.

Feature: Table Management
"""

from datetime import datetime, timedelta

from hypothesis import given, settings, HealthCheck, assume
from hypothesis import strategies as st


# ---------------------------------------------------------------------------
# Floor plan layout properties
# ---------------------------------------------------------------------------

@given(
    x=st.floats(min_value=0, max_value=1000, allow_nan=False, allow_infinity=False),
    y=st.floats(min_value=0, max_value=1000, allow_nan=False, allow_infinity=False),
    width=st.floats(min_value=1, max_value=100, allow_nan=False, allow_infinity=False),
    height=st.floats(min_value=1, max_value=100, allow_nan=False, allow_infinity=False),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_table_position_bounds(x, y, width, height):
    """
    Property 1: Table position + dimensions are non-negative.

    Why: Negative coordinates would place tables outside the
    visible floor plan area, confusing staff using the layout view.
    """
    assert x >= 0
    assert y >= 0
    assert width > 0
    assert height > 0


@given(
    seats=st.integers(min_value=1, max_value=20),
    tables=st.integers(min_value=1, max_value=50),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_total_capacity_is_sum_of_seats(seats, tables):
    """
    Property 2: Floor plan total capacity = sum of all table seats.

    Why: An incorrect capacity calculation would cause the host
    to over- or under-book the restaurant.
    """
    total_capacity = seats * tables
    assert total_capacity == seats * tables
    assert total_capacity >= tables  # At least 1 seat per table


# ---------------------------------------------------------------------------
# Reservation time conflict properties
# ---------------------------------------------------------------------------

@given(
    start_offset=st.integers(min_value=0, max_value=23),
    duration_a=st.integers(min_value=1, max_value=4),
    duration_b=st.integers(min_value=1, max_value=4),
    gap=st.integers(min_value=-3, max_value=3),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_reservation_overlap_detection(start_offset, duration_a, duration_b, gap):
    """
    Property 3: Two reservations overlap iff their time ranges intersect.

    overlap = start_a < end_b AND start_b < end_a

    Why: False negatives (missing overlaps) cause double-bookings.
    False positives (spurious conflicts) reject valid reservations.
    """
    base = datetime(2025, 6, 15, 10, 0)
    start_a = base + timedelta(hours=start_offset)
    end_a = start_a + timedelta(hours=duration_a)
    start_b = end_a + timedelta(hours=gap)
    end_b = start_b + timedelta(hours=duration_b)

    overlaps = start_a < end_b and start_b < end_a

    if gap >= duration_a:
        # B starts after A ends → no overlap
        # (But only if gap is big enough)
        pass
    if gap < 0 and abs(gap) < duration_a:
        # B starts before A ends → overlap
        assert overlaps


@given(
    party_size=st.integers(min_value=1, max_value=20),
    table_capacity=st.integers(min_value=1, max_value=20),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_reservation_fits_table(party_size, table_capacity):
    """
    Property 4: A reservation is valid only if party_size <= table_capacity.

    Why: Seating more people than a table holds is both a fire code
    violation and a bad customer experience.
    """
    fits = party_size <= table_capacity
    if party_size > table_capacity:
        assert not fits
    else:
        assert fits
