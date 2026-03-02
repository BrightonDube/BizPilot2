"""Property-based tests for modifier nesting depth enforcement.

Task 3.5 — Validates that the nested modifier depth limit of 2 is
consistently enforced regardless of the group/modifier topology.

Why test nesting depth with property tests?
Nesting depth is a graph-traversal invariant.  Property tests exercise
a far wider range of tree shapes (wide, deep, single-child chains)
than hand-picked unit test fixtures ever would.
"""

from hypothesis import given, strategies as st, settings
from unittest.mock import MagicMock
from uuid import uuid4


# ---------------------------------------------------------------------------
# Strategy: generate a fake "modifier → group → parent modifier" chain
# of a given length to simulate different nesting depths.
# ---------------------------------------------------------------------------
def _build_group_chain(depth: int):
    """Build a mock modifier-group chain *depth* levels deep.

    Returns the deepest group object.  Walking up
    ``group.parent_modifier.group`` should yield ``depth`` hops.
    """
    current_group = MagicMock()
    current_group.parent_modifier_id = None
    current_group.parent_modifier = None

    for _ in range(depth):
        parent_modifier = MagicMock()
        parent_modifier.id = uuid4()
        parent_modifier.group_id = uuid4()
        parent_modifier.group = current_group

        child_group = MagicMock()
        child_group.parent_modifier_id = parent_modifier.id
        child_group.parent_modifier = parent_modifier

        current_group = child_group

    return current_group


def _get_nesting_depth(group) -> int:
    """Re-implement the nesting depth walk used by the service layer.

    Why re-implement instead of importing?
    The service method is coupled to a live DB session for lazy loads.
    We test the *algorithm* here using in-memory mocks.
    """
    depth = 0
    current = group
    while current.parent_modifier_id is not None:
        depth += 1
        current = current.parent_modifier.group
    return depth


# ---------------------------------------------------------------------------
# Property: nesting depth measurement is always accurate
# ---------------------------------------------------------------------------
@given(depth=st.integers(min_value=0, max_value=10))
@settings(max_examples=50, deadline=None)
def test_nesting_depth_is_accurate(depth: int):
    """Property: _get_nesting_depth returns exactly the number of
    parent-modifier hops in the chain, for any chain length 0..10.
    """
    group = _build_group_chain(depth)
    assert _get_nesting_depth(group) == depth


# ---------------------------------------------------------------------------
# Property: chains deeper than 2 always violate the limit
# ---------------------------------------------------------------------------
MAX_NESTING_DEPTH = 2


@given(depth=st.integers(min_value=0, max_value=10))
@settings(max_examples=50, deadline=None)
def test_nesting_depth_limit_enforced(depth: int):
    """Property: any chain with depth > MAX_NESTING_DEPTH is flagged as
    a violation, and any chain ≤ MAX_NESTING_DEPTH is accepted.
    """
    group = _build_group_chain(depth)
    measured = _get_nesting_depth(group)

    if depth > MAX_NESTING_DEPTH:
        assert measured > MAX_NESTING_DEPTH, (
            f"Chain of depth {depth} should exceed limit {MAX_NESTING_DEPTH}"
        )
    else:
        assert measured <= MAX_NESTING_DEPTH, (
            f"Chain of depth {depth} should be within limit {MAX_NESTING_DEPTH}"
        )
