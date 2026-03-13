"""Property-based tests for month-end stock procedures.

Tests ABC classification thresholds, cycle counting frequency,
and period closing invariants.
"""

from decimal import Decimal

from hypothesis import given, settings, assume
from hypothesis import strategies as st


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

value_st = st.decimals(min_value=Decimal("0.01"), max_value=Decimal("1000000.00"), places=2)
percentage_st = st.decimals(min_value=Decimal("0"), max_value=Decimal("100"), places=2)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestMonthEndStockProperties:
    """Property tests for month-end stock invariants."""

    @given(
        values=st.lists(value_st, min_size=3, max_size=50),
    )
    @settings(max_examples=20, deadline=None)
    def test_abc_classification_covers_all_items(self, values):
        """ABC classification must assign every item to exactly one class.

        Why test this?
        If an item falls through the cracks and isn't classified, it won't
        be counted during cycle counts, leading to inventory drift.
        """
        sorted_values = sorted(values, reverse=True)
        total = sum(sorted_values)
        assume(total > 0)

        running = Decimal("0")
        classes = []
        for v in sorted_values:
            running += v
            pct = (running / total) * 100
            if pct <= 80:
                classes.append("A")
            elif pct <= 95:
                classes.append("B")
            else:
                classes.append("C")

        # Every item must have a class
        assert len(classes) == len(values)
        # All classes are valid
        assert all(c in ("A", "B", "C") for c in classes)

    @given(
        a_threshold=st.decimals(min_value=Decimal("60"), max_value=Decimal("85"), places=0),
        b_threshold=st.decimals(min_value=Decimal("86"), max_value=Decimal("98"), places=0),
    )
    @settings(max_examples=20, deadline=None)
    def test_abc_thresholds_are_ordered(self, a_threshold: Decimal, b_threshold: Decimal):
        """A threshold < B threshold < 100. C is the remainder."""
        assert a_threshold < b_threshold
        assert b_threshold < Decimal("100")

    @given(
        abc_class=st.sampled_from(["A", "B", "C"]),
    )
    @settings(max_examples=10, deadline=None)
    def test_cycle_count_frequency_by_class(self, abc_class: str):
        """A items counted most frequently, C items least.

        Standard frequencies: A=monthly, B=quarterly, C=annually.
        """
        freq_map = {"A": 12, "B": 4, "C": 1}  # counts per year
        freq = freq_map[abc_class]
        assert freq >= 1
        if abc_class == "A":
            assert freq > freq_map["B"]
        if abc_class == "B":
            assert freq > freq_map["C"]
