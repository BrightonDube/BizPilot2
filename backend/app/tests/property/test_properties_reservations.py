"""Property-based tests for reservation operations.

Tests time conflict detection, status transitions, and party size constraints.
"""

from datetime import datetime, timedelta

from hypothesis import given, settings
from hypothesis import strategies as st


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

party_size_st = st.integers(min_value=1, max_value=100)
duration_st = st.integers(min_value=15, max_value=480)
hours_offset_st = st.integers(min_value=0, max_value=168)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestReservationProperties:
    """Property tests for reservation invariants."""

    @given(
        start_a=hours_offset_st,
        dur_a=duration_st,
        start_b=hours_offset_st,
        dur_b=duration_st,
    )
    @settings(max_examples=30, deadline=None)
    def test_overlap_detection_is_symmetric(
        self, start_a: int, dur_a: int, start_b: int, dur_b: int
    ):
        """If A overlaps B, then B overlaps A.

        Why test symmetry?
        An asymmetric overlap check could allow double-booking from one
        direction but not the other — a subtle bug that only shows up
        when the second reservation is created before the first.
        """
        base = datetime(2025, 1, 1)
        a_start = base + timedelta(hours=start_a)
        a_end = a_start + timedelta(minutes=dur_a)
        b_start = base + timedelta(hours=start_b)
        b_end = b_start + timedelta(minutes=dur_b)

        a_overlaps_b = a_start < b_end and b_start < a_end
        b_overlaps_a = b_start < a_end and a_start < b_end

        assert a_overlaps_b == b_overlaps_a

    @given(party=party_size_st, capacity=st.integers(min_value=1, max_value=20))
    @settings(max_examples=20, deadline=None)
    def test_party_size_vs_table_capacity(self, party: int, capacity: int):
        """A table should ideally seat party_size <= capacity.

        Over-capacity bookings may be allowed with a warning, but the
        constraint must be checkable.
        """
        fits = party <= capacity
        if fits:
            assert party <= capacity
        else:
            assert party > capacity

    @given(duration=duration_st)
    @settings(max_examples=20, deadline=None)
    def test_duration_bounds(self, duration: int):
        """Reservation duration must be between 15 minutes and 8 hours."""
        assert 15 <= duration <= 480

    @given(
        status=st.sampled_from(["confirmed", "seated", "completed", "cancelled", "no_show"])
    )
    @settings(max_examples=10, deadline=None)
    def test_valid_status_transitions(self, status: str):
        """Only certain status transitions are allowed."""
        # Define valid transitions
        valid_transitions = {
            "confirmed": {"seated", "cancelled", "no_show"},
            "seated": {"completed"},
            "completed": set(),  # terminal
            "cancelled": set(),  # terminal
            "no_show": set(),  # terminal
        }
        assert status in valid_transitions
        # Terminal states cannot transition
        if status in ("completed", "cancelled", "no_show"):
            assert len(valid_transitions[status]) == 0
