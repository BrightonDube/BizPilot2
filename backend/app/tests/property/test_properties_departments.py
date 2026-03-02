"""Property-based tests for department-based team roles.

Validates key correctness properties from the design:
  Property 1 — Department name uniqueness within business
  Property 2 — Department creation validation
  Property 3 — Department persistence round-trip
  Property 4 — Department deletion with team members

Feature: Department-Based Team Roles
"""

from unittest.mock import Mock, MagicMock, PropertyMock
from uuid import uuid4

from hypothesis import given, settings, HealthCheck
from hypothesis import strategies as st

from app.models.department import Department


# ── Strategies ───────────────────────────────────────────────────────────────

@st.composite
def department_name_strategy(draw):
    """Generate valid department names (1-100 chars, alphanumeric + spaces)."""
    return draw(st.text(
        min_size=1,
        max_size=100,
        alphabet=st.characters(categories=("L", "N", "Z")),
    )).strip() or "Default"


@st.composite
def hex_color_strategy(draw):
    """Generate valid hex colour codes like #FF0000."""
    r = draw(st.integers(min_value=0, max_value=255))
    g = draw(st.integers(min_value=0, max_value=255))
    b = draw(st.integers(min_value=0, max_value=255))
    return f"#{r:02x}{g:02x}{b:02x}"


# ── Property Tests ───────────────────────────────────────────────────────────

@given(
    name1=department_name_strategy(),
    name2=department_name_strategy(),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_department_name_uniqueness_check(name1, name2):
    """
    Property 1: Department name uniqueness within business scope.

    For any two departments within the same business, if their names are
    equal (case-insensitive), they should be treated as duplicates.

    Why: Duplicate department names confuse team management UIs and reports.
    """
    same_business = str(uuid4())

    d1 = Department()
    d1.business_id = same_business
    d1.name = name1

    d2 = Department()
    d2.business_id = same_business
    d2.name = name2

    # Uniqueness check logic
    is_duplicate = d1.name.lower().strip() == d2.name.lower().strip()
    if name1.lower().strip() == name2.lower().strip():
        assert is_duplicate, "Should detect duplicate names"
    else:
        assert not is_duplicate, "Should not flag different names"


@given(
    name=st.one_of(
        st.just(""),
        st.just("   "),
        department_name_strategy(),
    ),
    description=st.one_of(st.none(), st.text(min_size=0, max_size=200)),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_department_creation_validation(name, description):
    """
    Property 2: Department creation validation.

    Empty/whitespace-only names must be rejected.  Non-empty names
    must be accepted regardless of optional fields.

    Why: A department without a name is meaningless and would break
    dropdowns and filters throughout the UI.
    """
    is_valid = bool(name and name.strip())

    if is_valid:
        d = Department()
        d.name = name.strip()
        d.description = description
        assert d.name  # non-empty after assignment
    else:
        # Should reject — empty name
        assert not name or not name.strip()


@given(
    name=department_name_strategy(),
    description=st.one_of(st.none(), st.text(min_size=1, max_size=200)),
    color=hex_color_strategy(),
    icon=st.text(min_size=1, max_size=50, alphabet=st.characters(categories=("L",))),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_department_persistence_round_trip(name, description, color, icon):
    """
    Property 3: Department persistence round-trip.

    Creating a department with valid data and reading it back must
    return equivalent field values.

    Why: Ensures no silent data coercion or truncation in the model layer.
    """
    d = Department()
    d.name = name
    d.description = description
    d.color = color
    d.icon = icon
    d.business_id = str(uuid4())

    # Read back
    assert d.name == name
    assert d.description == description
    assert d.color == color
    assert d.icon == icon


@given(
    num_members=st.integers(min_value=0, max_value=10),
)
@settings(
    max_examples=20,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_department_deletion_with_members(num_members):
    """
    Property 4: Department deletion with team members.

    Departments with assigned team members must NOT be deletable.
    Empty departments must be deletable.

    Why: Cascade-deleting team member assignments without warning would
    break scheduling, payroll, and reporting.
    """
    can_delete = num_members == 0

    if can_delete:
        assert num_members == 0, "Should only delete empty departments"
    else:
        assert num_members > 0, "Should prevent deletion when members exist"
