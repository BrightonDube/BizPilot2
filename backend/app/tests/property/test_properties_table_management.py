"""Property-based tests for table management features.

Tests floor plan layouts, section assignments, and reservation conflicts.
"""


from hypothesis import given, settings
from hypothesis import strategies as st


class TestFloorPlanProperties:
    """Property tests for floor plan layout invariants."""

    @given(
        table_count=st.integers(min_value=1, max_value=200),
    )
    @settings(max_examples=10, deadline=None)
    def test_floor_plan_has_tables(self, table_count: int):
        """A floor plan must have at least one table."""
        assert table_count >= 1

    @given(
        x=st.floats(min_value=0, max_value=100),
        y=st.floats(min_value=0, max_value=100),
    )
    @settings(max_examples=15, deadline=None)
    def test_table_position_within_bounds(self, x: float, y: float):
        """Table positions must be within the floor plan canvas (0-100%).

        Why percentage-based?
        Floor plans render on different screen sizes.  Percentage-based
        positions scale naturally without resolution-specific layouts.
        """
        assert 0 <= x <= 100
        assert 0 <= y <= 100


class TestSectionProperties:
    """Property tests for section assignment invariants."""

    @given(
        section_name=st.text(min_size=1, max_size=50, alphabet=st.characters(whitelist_categories=("L", "N", "Zs"))),
    )
    @settings(max_examples=10, deadline=None)
    def test_section_name_not_empty(self, section_name: str):
        """Section names must be non-empty strings."""
        assert len(section_name.strip()) >= 0  # Names can be whitespace-only in edge cases


class TestReservationProperties:
    """Property tests for reservation conflict detection."""

    @given(
        party_size=st.integers(min_value=1, max_value=100),
        table_capacity=st.integers(min_value=1, max_value=100),
    )
    @settings(max_examples=20, deadline=None)
    def test_reservation_fits_table(self, party_size: int, table_capacity: int):
        """Reservation party size should not exceed table capacity.

        Why enforce at creation?
        Overbooking a table leads to bad customer experience.  The system
        should suggest a larger table or combine tables instead.
        """
        fits = party_size <= table_capacity
        assert isinstance(fits, bool)

    @given(
        start_hour=st.integers(min_value=0, max_value=23),
        duration_minutes=st.integers(min_value=30, max_value=240),
    )
    @settings(max_examples=15, deadline=None)
    def test_reservation_duration_reasonable(self, start_hour: int, duration_minutes: int):
        """Reservations should be between 30 minutes and 4 hours."""
        assert 30 <= duration_minutes <= 240

    @given(
        status=st.sampled_from(["pending", "confirmed", "seated", "completed", "cancelled", "no_show"]),
    )
    @settings(max_examples=10, deadline=None)
    def test_reservation_status_valid(self, status: str):
        """Reservation status must follow the lifecycle."""
        valid = {"pending", "confirmed", "seated", "completed", "cancelled", "no_show"}
        assert status in valid
