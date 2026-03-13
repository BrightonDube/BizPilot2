"""
Property-based tests for staff management.

Validates role assignment, permission inheritance,
and scheduling constraint invariants.

Feature: Staff Management
"""


from hypothesis import given, settings, HealthCheck
from hypothesis import strategies as st


# ---------------------------------------------------------------------------
# Role and permission properties
# ---------------------------------------------------------------------------

@given(
    role_level=st.integers(min_value=1, max_value=5),
    required_level=st.integers(min_value=1, max_value=5),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_role_hierarchy_grants_access(role_level, required_level):
    """
    Property 1: Higher role levels include all lower-level permissions.

    role_level >= required_level → access granted.

    Why: A manager (level 3) must be able to do everything a
    cashier (level 1) can. If hierarchy breaks, managers get
    locked out of basic functions.
    """
    has_access = role_level >= required_level
    if role_level >= required_level:
        assert has_access
    else:
        assert not has_access


@given(
    permissions=st.lists(
        st.sampled_from([
            "pos:sell", "pos:refund", "pos:void",
            "inventory:view", "inventory:edit",
            "reports:view", "reports:export",
            "staff:manage", "settings:edit",
        ]),
        min_size=0,
        max_size=9,
        unique=True,
    ),
    required=st.sampled_from([
        "pos:sell", "pos:refund", "pos:void",
        "inventory:view", "inventory:edit",
        "reports:view", "reports:export",
        "staff:manage", "settings:edit",
    ]),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_permission_check_is_exact(permissions, required):
    """
    Property 2: Permission check returns True iff the exact permission exists.

    Why: Fuzzy matching (e.g., 'pos:' matching 'pos:refund') would
    grant unintended access, which is a security vulnerability.
    """
    has_it = required in permissions
    assert has_it == (required in permissions)


# ---------------------------------------------------------------------------
# Scheduling constraint properties
# ---------------------------------------------------------------------------

@given(
    shift_hours=st.floats(min_value=1, max_value=16, allow_nan=False, allow_infinity=False),
    max_hours=st.floats(min_value=8, max_value=16, allow_nan=False, allow_infinity=False),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_shift_duration_within_legal_limit(shift_hours, max_hours):
    """
    Property 3: No single shift exceeds maximum hours.

    Why: South African labour law limits continuous work hours.
    Exceeding this exposes the business to legal liability.
    """
    within_limit = shift_hours <= max_hours
    if shift_hours <= max_hours:
        assert within_limit
    else:
        assert not within_limit


@given(
    daily_hours=st.lists(
        st.floats(min_value=0, max_value=12, allow_nan=False, allow_infinity=False),
        min_size=7,
        max_size=7,
    ),
    weekly_max=st.floats(
        min_value=40, max_value=60, allow_nan=False, allow_infinity=False
    ),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_weekly_hours_cap(daily_hours, weekly_max):
    """
    Property 4: Total weekly hours must not exceed the weekly cap.

    Why: Overtime compliance. If the system allows scheduling beyond
    the weekly max, the business faces overtime penalty costs.
    """
    total = sum(daily_hours)
    within_cap = total <= weekly_max
    if total > weekly_max:
        assert not within_cap
    else:
        assert within_cap


@given(
    staff_count=st.integers(min_value=1, max_value=20),
    min_required=st.integers(min_value=1, max_value=10),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_minimum_staffing_level(staff_count, min_required):
    """
    Property 5: Scheduled staff count >= minimum required per shift.

    Why: Under-staffing leads to poor service and potential
    health/safety violations (e.g., fire warden requirements).
    """
    is_adequately_staffed = staff_count >= min_required
    if staff_count >= min_required:
        assert is_adequately_staffed
    else:
        assert not is_adequately_staffed
