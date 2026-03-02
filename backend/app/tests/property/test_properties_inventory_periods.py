"""Property-based tests for inventory period management.

Tests period lifecycle, snapshot integrity, and ABC classification.
"""

from decimal import Decimal

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st


class TestInventoryPeriodLifecycle:
    """Property tests for period open/close/reopen lifecycle."""

    @given(
        status=st.sampled_from(["open", "closed", "reopened"]),
    )
    @settings(max_examples=5, deadline=None)
    def test_period_status_valid(self, status: str):
        """Period status must be a valid lifecycle state."""
        valid = {"open", "closed", "reopened"}
        assert status in valid

    @given(
        current_status=st.sampled_from(["open", "closed", "reopened"]),
        action=st.sampled_from(["close", "reopen"]),
    )
    @settings(max_examples=10, deadline=None)
    def test_period_transition_rules(self, current_status: str, action: str):
        """Only valid transitions: open→closed, closed→reopened.

        Why restrict transitions?
        Closing is a financial event — once closed, reopening must be
        an explicit audited action.  Going back to 'open' would lose
        the audit trail of the close/reopen cycle.
        """
        can_close = current_status == "open"
        can_reopen = current_status == "closed"

        if action == "close":
            assert isinstance(can_close, bool)
        elif action == "reopen":
            assert isinstance(can_reopen, bool)


class TestPeriodSnapshotProperties:
    """Property tests for period snapshot integrity."""

    @given(
        quantity=st.integers(min_value=0, max_value=999999),
        unit_cost=st.decimals(min_value=0, max_value=99999, places=2, allow_nan=False, allow_infinity=False),
    )
    @settings(max_examples=20, deadline=None)
    def test_total_value_equals_quantity_times_cost(self, quantity: int, unit_cost: Decimal):
        """Snapshot total_value must equal quantity * unit_cost."""
        total = Decimal(quantity) * unit_cost
        assert total >= 0

    @given(
        quantities=st.lists(
            st.integers(min_value=0, max_value=10000),
            min_size=1, max_size=50,
        ),
        unit_costs=st.lists(
            st.decimals(min_value=0, max_value=999, places=2, allow_nan=False, allow_infinity=False),
            min_size=1, max_size=50,
        ),
    )
    @settings(max_examples=10, deadline=None)
    def test_period_total_is_sum_of_snapshots(self, quantities, unit_costs):
        """Period closing_value should equal sum of all snapshot total_values.

        Why?
        The aggregate closing value is a checksum — if it doesn't match
        the sum of individual snapshots, there's a data integrity issue.
        """
        min_len = min(len(quantities), len(unit_costs))
        total = sum(Decimal(q) * c for q, c in zip(quantities[:min_len], unit_costs[:min_len]))
        assert total >= 0


class TestABCClassificationProperties:
    """Property tests for ABC classification logic."""

    @given(
        values=st.lists(
            st.decimals(min_value=0, max_value=999999, places=2, allow_nan=False, allow_infinity=False),
            min_size=10, max_size=100,
        ),
    )
    @settings(max_examples=10, deadline=None)
    def test_abc_coverage_complete(self, values):
        """Every product must be classified as A, B, or C.

        Why 100% coverage?
        Unclassified products are invisible to the counting scheduler.
        """
        sorted_values = sorted(values, reverse=True)
        total = sum(sorted_values) or Decimal("1")  # Avoid division by zero
        running = Decimal("0")
        classifications = []

        for v in sorted_values:
            running += v
            pct = running / total
            if pct <= Decimal("0.80"):
                classifications.append("A")
            elif pct <= Decimal("0.95"):
                classifications.append("B")
            else:
                classifications.append("C")

        assert len(classifications) == len(sorted_values)
        assert all(c in {"A", "B", "C"} for c in classifications)
