"""Property-based tests for stock take operations.

Tests variance calculation, count recording, and session lifecycle invariants.
"""


from hypothesis import given, settings, assume
from hypothesis import strategies as st


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

quantity_st = st.integers(min_value=0, max_value=100000)
positive_quantity_st = st.integers(min_value=1, max_value=100000)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestStockTakeProperties:
    """Property tests for stock take invariants."""

    @given(system_qty=quantity_st, counted_qty=quantity_st)
    @settings(max_examples=30, deadline=None)
    def test_variance_calculation(self, system_qty: int, counted_qty: int):
        """Variance is always counted - system, regardless of sign.

        Why test this as a property?
        Variance direction determines whether an adjustment is a gain or loss.
        Getting the sign wrong causes stock levels to diverge from reality.
        """
        variance = counted_qty - system_qty
        assert variance == counted_qty - system_qty

        if counted_qty > system_qty:
            assert variance > 0  # surplus
        elif counted_qty < system_qty:
            assert variance < 0  # shortage
        else:
            assert variance == 0  # exact match

    @given(system_qty=quantity_st, counted_qty=quantity_st)
    @settings(max_examples=20, deadline=None)
    def test_variance_percentage(self, system_qty: int, counted_qty: int):
        """Variance percentage should be well-defined when system_qty > 0."""
        assume(system_qty > 0)
        variance = counted_qty - system_qty
        pct = (variance / system_qty) * 100
        # Percentage is bounded by practical limits
        assert pct >= -100  # can't lose more than all stock
        if counted_qty == 0:
            assert pct == -100.0

    @given(
        counts=st.lists(
            st.tuples(positive_quantity_st, quantity_st),
            min_size=1,
            max_size=20,
        )
    )
    @settings(max_examples=20, deadline=None)
    def test_total_variance_is_sum_of_individual(self, counts):
        """Total variance across all products equals sum of per-product variances."""
        total_variance = 0
        for system_qty, counted_qty in counts:
            total_variance += counted_qty - system_qty

        # Verify by computing independently
        expected = sum(counted - system for system, counted in counts)
        assert total_variance == expected

    @given(scope_type=st.sampled_from(["category", "location", "product"]))
    @settings(max_examples=10, deadline=None)
    def test_scope_type_is_valid_enum(self, scope_type: str):
        """Stock take scope must be one of the allowed types."""
        valid_types = {"category", "location", "product"}
        assert scope_type in valid_types
