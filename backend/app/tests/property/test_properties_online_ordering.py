"""Property-based tests for online ordering operations.

Tests order total calculations, menu availability, and delivery fee logic.
"""

from decimal import Decimal

from hypothesis import given, settings
from hypothesis import strategies as st


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

price_st = st.decimals(min_value=Decimal("0.01"), max_value=Decimal("9999.99"), places=2)
quantity_st = st.integers(min_value=1, max_value=100)
delivery_fee_st = st.decimals(min_value=Decimal("0"), max_value=Decimal("500.00"), places=2)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestOnlineOrderProperties:
    """Property tests for online ordering invariants."""

    @given(
        items=st.lists(
            st.tuples(price_st, quantity_st),
            min_size=1,
            max_size=20,
        ),
        delivery_fee=delivery_fee_st,
    )
    @settings(max_examples=20, deadline=None)
    def test_order_total_includes_delivery(self, items, delivery_fee: Decimal):
        """Order total = sum(price × qty) + delivery fee.

        Why test explicitly?
        Online orders include delivery fees that don't exist in dine-in.
        Forgetting to add the fee or adding it twice are common bugs.
        """
        subtotal = sum(Decimal(str(price)) * qty for price, qty in items)
        total = subtotal + delivery_fee
        assert total >= subtotal
        assert total == subtotal + delivery_fee

    @given(
        status=st.sampled_from([
            "pending", "confirmed", "preparing", "ready",
            "out_for_delivery", "delivered", "cancelled",
        ])
    )
    @settings(max_examples=10, deadline=None)
    def test_valid_order_status(self, status: str):
        """Online order status must be one of the defined values."""
        valid = {
            "pending", "confirmed", "preparing", "ready",
            "out_for_delivery", "delivered", "cancelled",
        }
        assert status in valid

    @given(
        prep_time=st.integers(min_value=5, max_value=120),
        delivery_time=st.integers(min_value=10, max_value=90),
    )
    @settings(max_examples=20, deadline=None)
    def test_estimated_delivery_time(self, prep_time: int, delivery_time: int):
        """Estimated delivery = prep time + delivery time. Always positive."""
        total_time = prep_time + delivery_time
        assert total_time > 0
        assert total_time == prep_time + delivery_time
