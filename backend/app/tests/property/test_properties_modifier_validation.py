"""Property-based tests for modifier selection constraint enforcement.

Task 3.9 — Validates that ModifierValidationService.validate_group_selection
correctly enforces min/max constraints for any group configuration and any
set of selected modifier IDs.

Why property tests here?
Selection constraints involve combinatorial inputs (min_selections,
max_selections, number of selected items).  Exhaustive enumeration is
impractical; property tests cover the space probabilistically.
"""

from hypothesis import given, strategies as st, assume, settings
from unittest.mock import MagicMock
from uuid import uuid4

from app.services.modifier_validation_service import ModifierValidationService


# ---------------------------------------------------------------------------
# Helpers to build mock ModifierGroup objects
# ---------------------------------------------------------------------------

def _make_group(
    *,
    min_selections: int,
    max_selections: int,
    is_required: bool,
    modifier_count: int,
):
    """Build a mock ModifierGroup with *modifier_count* child modifiers."""
    group = MagicMock()
    group.id = uuid4()
    group.name = "Test Group"
    group.min_selections = min_selections
    group.max_selections = max_selections
    group.is_required = is_required

    modifiers = []
    for _ in range(modifier_count):
        m = MagicMock()
        m.id = uuid4()
        m.is_active = True
        modifiers.append(m)

    group.modifiers = modifiers
    return group


# ---------------------------------------------------------------------------
# Property 1: selecting exactly min_selections is always valid when ≤ max
# ---------------------------------------------------------------------------
@given(
    min_sel=st.integers(min_value=0, max_value=10),
    extra_max=st.integers(min_value=0, max_value=10),
)
@settings(max_examples=100, deadline=None)
def test_selecting_min_is_valid(min_sel: int, extra_max: int):
    """Property: if the user selects exactly min_selections items
    (and min ≤ max), validation should produce no 'too few' errors.
    """
    max_sel = min_sel + extra_max  # guarantee max >= min
    modifier_count = max(max_sel, 1)  # enough modifiers to choose from

    group = _make_group(
        min_selections=min_sel,
        max_selections=max_sel,
        is_required=(min_sel > 0),
        modifier_count=modifier_count,
    )

    selected_ids = [str(m.id) for m in group.modifiers[:min_sel]]

    service = ModifierValidationService.__new__(ModifierValidationService)
    errors = service.validate_group_selection(group, selected_ids)

    # There should be no "too few" style errors.
    too_few_errors = [e for e in errors if "minimum" in str(e).lower() or "at least" in str(e).lower()]
    assert too_few_errors == [], f"Unexpected errors when selecting min: {errors}"


# ---------------------------------------------------------------------------
# Property 2: selecting more than max_selections always produces an error
# ---------------------------------------------------------------------------
@given(
    max_sel=st.integers(min_value=1, max_value=10),
    overshoot=st.integers(min_value=1, max_value=5),
)
@settings(max_examples=100, deadline=None)
def test_exceeding_max_is_invalid(max_sel: int, overshoot: int):
    """Property: if the user selects more than max_selections,
    validation should produce at least one error.
    """
    count = max_sel + overshoot
    group = _make_group(
        min_selections=0,
        max_selections=max_sel,
        is_required=False,
        modifier_count=count,
    )

    selected_ids = [str(m.id) for m in group.modifiers[:count]]

    service = ModifierValidationService.__new__(ModifierValidationService)
    errors = service.validate_group_selection(group, selected_ids)

    assert len(errors) > 0, (
        f"Expected error when selecting {count} items with max {max_sel}"
    )


# ---------------------------------------------------------------------------
# Property 3: empty selection on a required group produces an error
# ---------------------------------------------------------------------------
@given(
    min_sel=st.integers(min_value=1, max_value=10),
    max_sel=st.integers(min_value=1, max_value=20),
)
@settings(max_examples=50, deadline=None)
def test_empty_selection_on_required_group_is_invalid(
    min_sel: int, max_sel: int
):
    """Property: selecting zero items when min_selections > 0 always fails."""
    assume(max_sel >= min_sel)

    group = _make_group(
        min_selections=min_sel,
        max_selections=max_sel,
        is_required=True,
        modifier_count=max_sel,
    )

    service = ModifierValidationService.__new__(ModifierValidationService)
    errors = service.validate_group_selection(group, [])

    assert len(errors) > 0, "Required group with empty selection should error"


# ---------------------------------------------------------------------------
# Property 4: zero selection on optional group with min=0 is valid
# ---------------------------------------------------------------------------
@given(max_sel=st.integers(min_value=1, max_value=20))
@settings(max_examples=50, deadline=None)
def test_empty_selection_on_optional_group_is_valid(max_sel: int):
    """Property: selecting nothing when min_selections=0 is always OK."""
    group = _make_group(
        min_selections=0,
        max_selections=max_sel,
        is_required=False,
        modifier_count=max_sel,
    )

    service = ModifierValidationService.__new__(ModifierValidationService)
    errors = service.validate_group_selection(group, [])

    constraint_errors = [e for e in errors if "minimum" in str(e).lower() or "required" in str(e).lower()]
    assert constraint_errors == [], f"Unexpected errors on optional empty: {errors}"
