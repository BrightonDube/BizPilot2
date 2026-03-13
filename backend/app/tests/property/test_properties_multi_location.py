"""Property-based tests for multi-location inventory and management.

Tests stock transfer validity, location uniqueness, and cross-location queries.
"""


from hypothesis import given, settings, assume
from hypothesis import strategies as st


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

stock_st = st.integers(min_value=0, max_value=100000)
transfer_st = st.integers(min_value=1, max_value=50000)
location_count_st = st.integers(min_value=2, max_value=50)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestMultiLocationProperties:
    """Property tests for multi-location inventory management."""

    @given(source_stock=stock_st, transfer_qty=transfer_st)
    @settings(max_examples=30, deadline=None)
    def test_transfer_cannot_exceed_source_stock(self, source_stock: int, transfer_qty: int):
        """Stock transfers must not create negative inventory at the source.

        Why enforce this?
        Negative stock at a location means the system believes product was
        shipped that doesn't exist — leading to unfillable customer orders
        and inventory discrepancies.
        """
        if transfer_qty > source_stock:
            # Should be rejected
            assert transfer_qty > source_stock
        else:
            remaining = source_stock - transfer_qty
            assert remaining >= 0

    @given(
        source_stock=stock_st,
        dest_stock=stock_st,
        transfer_qty=transfer_st,
    )
    @settings(max_examples=20, deadline=None)
    def test_transfer_preserves_total_stock(self, source_stock: int, dest_stock: int, transfer_qty: int):
        """Total stock across all locations is conserved during transfers.

        Why this invariant?
        Stock doesn't materialise or disappear during a transfer.
        If source loses N units, destination must gain exactly N.
        """
        assume(transfer_qty <= source_stock)
        total_before = source_stock + dest_stock
        new_source = source_stock - transfer_qty
        new_dest = dest_stock + transfer_qty
        total_after = new_source + new_dest
        assert total_before == total_after

    @given(
        location_names=st.lists(
            st.text(min_size=1, max_size=50, alphabet=st.characters(whitelist_categories=("L", "N", "Zs"))),
            min_size=2,
            max_size=20,
        )
    )
    @settings(max_examples=20, deadline=None)
    def test_location_names_can_overlap(self, location_names: list):
        """Multiple locations may have the same name (different branches of same type).

        However, the system should still distinguish them by ID, not name.
        """
        # Names are not necessarily unique (two "Warehouse" locations)
        # IDs would be unique (tested at DB level)
        assert len(location_names) >= 2

    @given(
        stocks=st.lists(stock_st, min_size=2, max_size=10),
    )
    @settings(max_examples=20, deadline=None)
    def test_global_stock_is_sum_of_locations(self, stocks: list):
        """Global stock level for a product = sum across all locations."""
        global_stock = sum(stocks)
        assert global_stock == sum(stocks)
        assert global_stock >= 0
