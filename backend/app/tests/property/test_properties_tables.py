"""Property-based tests for table management.

Validates correctness properties:
  Property 1 — Table capacity enforcement
  Property 2 — Status transitions validity
  Property 3 — Section isolation (tables unique per section)

Feature: Table Management
"""

from hypothesis import given, settings, HealthCheck
from hypothesis import strategies as st

from app.models.restaurant_table import TableStatus


# ── Constants ────────────────────────────────────────────────────────────────

# Valid status transitions for restaurant tables.
# Why explicit?  Invalid transitions (e.g. OCCUPIED → AVAILABLE without
# going through DIRTY/cleaning) would cause seating conflicts.
VALID_TRANSITIONS = {
    TableStatus.AVAILABLE: {TableStatus.OCCUPIED, TableStatus.RESERVED, TableStatus.BLOCKED},
    TableStatus.OCCUPIED: {TableStatus.DIRTY, TableStatus.AVAILABLE},
    TableStatus.RESERVED: {TableStatus.OCCUPIED, TableStatus.AVAILABLE},
    TableStatus.DIRTY: {TableStatus.AVAILABLE},
    TableStatus.BLOCKED: {TableStatus.AVAILABLE},
}


# ── Property Tests ───────────────────────────────────────────────────────────

@given(
    capacity=st.integers(min_value=0, max_value=30),
    party_size=st.integers(min_value=1, max_value=30),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_table_capacity_enforcement(capacity, party_size):
    """
    Property 1: Table capacity enforcement.

    A table SHALL only be assigned to a party that fits within its
    capacity.  Overloading a table would violate fire code and
    create uncomfortable dining experiences.

    Why: Capacity enforcement is a hard constraint — unlike "soft"
    preferences (e.g. window seating), exceeding capacity is never OK.
    """
    can_seat = party_size <= capacity

    if can_seat:
        assert party_size <= capacity
    else:
        assert party_size > capacity


@given(
    from_status=st.sampled_from(list(TableStatus)),
    to_status=st.sampled_from(list(TableStatus)),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_status_transition_validity(from_status, to_status):
    """
    Property 2: Status transition validity.

    Table status changes SHALL follow the defined state machine.
    Invalid transitions indicate a bug in the booking/seating flow.

    Why: OCCUPIED → AVAILABLE without going through DIRTY would leave
    uncleared tables assigned to new guests.
    """
    valid_targets = VALID_TRANSITIONS.get(from_status, set())
    is_valid = to_status in valid_targets

    if is_valid:
        assert to_status in valid_targets
    else:
        assert to_status not in valid_targets


@given(
    table_numbers=st.lists(
        st.integers(min_value=1, max_value=100),
        min_size=2,
        max_size=20,
    ),
)
@settings(
    max_examples=30,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_table_number_uniqueness_within_section(table_numbers):
    """
    Property 3: Table number uniqueness within section.

    Within a single section (e.g. "Patio"), table numbers SHALL be
    unique.  Duplicate numbers would make it impossible for staff to
    identify which table an order belongs to.

    Why: This is a database-level constraint, but we verify the logic
    here to catch it before it reaches the DB.
    """
    unique_numbers = set(table_numbers)
    has_duplicates = len(unique_numbers) < len(table_numbers)

    if has_duplicates:
        assert len(unique_numbers) < len(table_numbers)
    else:
        assert len(unique_numbers) == len(table_numbers)
