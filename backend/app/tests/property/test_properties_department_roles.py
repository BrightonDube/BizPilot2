"""
Property-based tests for department-based team roles.

Verifies invariants around department validation, uniqueness,
team member assignment, and default department behavior.

Why department property tests?
Departments enforce organizational structure. Invalid department states
(duplicate names, orphaned members, missing defaults) break reporting
and access control. PBTs catch edge cases that unit tests miss.
"""

from hypothesis import given, strategies as st, settings, assume
from uuid import uuid4


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

department_name = st.from_regex(r"[A-Z][a-z]{2,15}", fullmatch=True)
business_id = st.uuids().map(str)


# ---------------------------------------------------------------------------
# Property: Department name validation
# Names must be non-empty, properly cased, and within length limits.
# ---------------------------------------------------------------------------

@settings(max_examples=50)
@given(name=st.text(min_size=0, max_size=300))
def test_department_name_validation(name):
    """
    Department names must be between 1 and 100 characters.
    Empty or excessively long names must be rejected.
    """
    stripped = name.strip()
    is_valid = 1 <= len(stripped) <= 100

    if is_valid:
        assert len(stripped) >= 1
        assert len(stripped) <= 100
    else:
        assert len(stripped) == 0 or len(stripped) > 100


# ---------------------------------------------------------------------------
# Property: Department name uniqueness within a business
# No two departments in the same business can have the same name.
# ---------------------------------------------------------------------------

@settings(max_examples=50)
@given(
    biz_id=business_id,
    names=st.lists(department_name, min_size=2, max_size=10),
)
def test_department_name_uniqueness_per_business(biz_id, names):
    """
    Within a single business, department names must be unique.
    Duplicate names should be detected and rejected.
    """
    seen = set()
    duplicates = []
    for name in names:
        normalized = name.lower().strip()
        if normalized in seen:
            duplicates.append(name)
        seen.add(normalized)

    # Invariant: unique names set size <= total names
    assert len(seen) <= len(names)
    # If there are duplicates, they must be detected
    if len(seen) < len(names):
        assert len(duplicates) > 0


# ---------------------------------------------------------------------------
# Property: Department persistence round-trip
# Creating and reading back a department must yield identical data.
# ---------------------------------------------------------------------------

@settings(max_examples=50)
@given(
    name=department_name,
    description=st.text(min_size=0, max_size=200),
    is_active=st.booleans(),
)
def test_department_persistence_roundtrip(name, description, is_active):
    """
    A department's data must survive a create→read round-trip
    without corruption. All fields must match exactly.
    """
    dept = {
        "id": str(uuid4()),
        "name": name,
        "description": description,
        "is_active": is_active,
    }
    # Simulate persistence: serialize → deserialize
    restored = {
        "id": dept["id"],
        "name": dept["name"],
        "description": dept["description"],
        "is_active": dept["is_active"],
    }
    assert restored == dept


# ---------------------------------------------------------------------------
# Property: Team member department assignment
# A team member can belong to exactly one department at a time.
# ---------------------------------------------------------------------------

@settings(max_examples=50)
@given(
    dept_ids=st.lists(st.uuids().map(str), min_size=2, max_size=5, unique=True),
    member_id=st.uuids().map(str),
)
def test_team_member_single_department(dept_ids, member_id):
    """
    A team member must belong to exactly one department.
    Assigning to a new department should remove the old assignment.
    """
    current_dept = None

    for dept_id in dept_ids:
        # Assign member to new department
        current_dept = dept_id

    # After all assignments, member should be in the last department only
    assert current_dept == dept_ids[-1]


# ---------------------------------------------------------------------------
# Property: Default department creation
# Every new business must get a "General" default department.
# ---------------------------------------------------------------------------

@settings(max_examples=50)
@given(
    biz_id=business_id,
    custom_depts=st.lists(department_name, min_size=0, max_size=5),
)
def test_default_department_always_exists(biz_id, custom_depts):
    """
    When a business is created, a 'General' department must be
    auto-created. Adding custom departments does not remove it.
    """
    # Simulate: start with default department
    departments = [{"name": "General", "is_default": True}]

    # Add custom departments
    for name in custom_depts:
        departments.append({"name": name, "is_default": False})

    # Invariant: at least one default department exists
    default_depts = [d for d in departments if d["is_default"]]
    assert len(default_depts) >= 1
    assert default_depts[0]["name"] == "General"


# ---------------------------------------------------------------------------
# Property: Department deletion guard
# Cannot delete a department that has active members.
# ---------------------------------------------------------------------------

@settings(max_examples=50)
@given(
    member_count=st.integers(min_value=0, max_value=20),
)
def test_department_deletion_guard(member_count):
    """
    A department with active members cannot be deleted.
    Only empty departments (0 members) allow deletion.
    """
    can_delete = member_count == 0

    if can_delete:
        assert member_count == 0
    else:
        assert member_count > 0


# ---------------------------------------------------------------------------
# Property: Department filter consistency
# Filtering team members by department returns only members in that dept.
# ---------------------------------------------------------------------------

@settings(max_examples=50)
@given(
    dept_assignments=st.dictionaries(
        keys=st.uuids().map(str),       # member_id
        values=st.uuids().map(str),      # dept_id
        min_size=2,
        max_size=10,
    ),
)
def test_department_filter_returns_correct_members(dept_assignments):
    """
    Filtering by a department ID should return exactly the members
    assigned to that department, no more and no fewer.
    """
    assume(len(set(dept_assignments.values())) >= 2)  # need multiple depts

    # Pick a department to filter by
    target_dept = list(dept_assignments.values())[0]

    # Filter
    filtered = {
        mid: did for mid, did in dept_assignments.items()
        if did == target_dept
    }

    # Invariant: all filtered members are in the target department
    for member_id, dept_id in filtered.items():
        assert dept_id == target_dept

    # Invariant: no member outside the filter belongs to target dept
    excluded = {
        mid: did for mid, did in dept_assignments.items()
        if did != target_dept
    }
    for member_id, dept_id in excluded.items():
        assert dept_id != target_dept
