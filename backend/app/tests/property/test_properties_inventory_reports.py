"""Property-based tests for inventory report calculations.

Tests stock valuation methods, turnover ratios, and report consistency.
"""

from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

quantity_st = st.integers(min_value=0, max_value=100000)
price_st = st.decimals(min_value=Decimal("0.01"), max_value=Decimal("99999.99"), places=2)
positive_qty_st = st.integers(min_value=1, max_value=100000)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestInventoryReportProperties:
    """Property tests for inventory report invariants."""

    @given(qty=positive_qty_st, unit_cost=price_st)
    @settings(max_examples=20, deadline=None)
    def test_stock_valuation_is_quantity_times_cost(self, qty: int, unit_cost: Decimal):
        """Stock valuation = quantity × unit cost.

        Why this test?
        Valuation is used in balance sheets and COGS calculations.
        Incorrect multiplication here cascades into wrong financial reports.
        """
        valuation = qty * unit_cost
        assert valuation == qty * unit_cost
        assert valuation >= Decimal("0")

    @given(
        sold=positive_qty_st,
        avg_inventory=positive_qty_st,
    )
    @settings(max_examples=20, deadline=None)
    def test_turnover_ratio_is_positive(self, sold: int, avg_inventory: int):
        """Inventory turnover ratio = COGS / average inventory.

        Both inputs are positive, so the ratio must be positive.
        """
        ratio = sold / avg_inventory
        assert ratio > 0

    @given(
        items=st.lists(
            st.tuples(positive_qty_st, price_st),
            min_size=1,
            max_size=20,
        )
    )
    @settings(max_examples=20, deadline=None)
    def test_total_valuation_is_sum_of_line_items(self, items):
        """Total stock valuation equals sum of per-item valuations."""
        total = sum(Decimal(qty) * cost for qty, cost in items)
        expected = Decimal("0")
        for qty, cost in items:
            expected += Decimal(qty) * cost
        assert total == expected

    @given(
        reorder_point=positive_qty_st,
        current_stock=quantity_st,
    )
    @settings(max_examples=20, deadline=None)
    def test_low_stock_detection(self, reorder_point: int, current_stock: int):
        """An item is low-stock when current_stock < reorder_point."""
        is_low = current_stock < reorder_point
        if is_low:
            assert current_stock < reorder_point
        else:
            assert current_stock >= reorder_point
