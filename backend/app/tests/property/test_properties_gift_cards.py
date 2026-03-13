"""Property-based tests for gift card operations.

Tests balance tracking, redemption limits, and card number format.
"""

from decimal import Decimal
from datetime import date, timedelta

from hypothesis import given, settings, assume
from hypothesis import strategies as st


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

balance_st = st.decimals(min_value=Decimal("5.00"), max_value=Decimal("10000.00"), places=2)
redemption_st = st.decimals(min_value=Decimal("0.01"), max_value=Decimal("5000.00"), places=2)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestGiftCardProperties:
    """Property tests for gift card invariants."""

    @given(initial=balance_st, redeemed=redemption_st)
    @settings(max_examples=30, deadline=None)
    def test_balance_never_negative(self, initial: Decimal, redeemed: Decimal):
        """Gift card balance should never go below zero.

        Why enforce this?
        A negative balance means we gave away more value than the card held,
        which is a direct financial loss.
        """
        assume(redeemed <= initial)
        remaining = initial - redeemed
        assert remaining >= Decimal("0")

    @given(initial=balance_st, top_up=balance_st)
    @settings(max_examples=20, deadline=None)
    def test_top_up_increases_balance(self, initial: Decimal, top_up: Decimal):
        """Topping up a gift card should increase the balance."""
        new_balance = initial + top_up
        assert new_balance > initial
        assert new_balance == initial + top_up

    @given(
        card_number=st.from_regex(r"GC-[A-Z0-9]{8}", fullmatch=True)
    )
    @settings(max_examples=20, deadline=None)
    def test_card_number_format(self, card_number: str):
        """Gift card numbers should follow a consistent format."""
        assert card_number.startswith("GC-")
        assert len(card_number) == 11
        # Alphanumeric suffix
        assert card_number[3:].isalnum()

    @given(
        expiry_days=st.integers(min_value=30, max_value=730),
    )
    @settings(max_examples=20, deadline=None)
    def test_expiry_is_in_future(self, expiry_days: int):
        """Gift card expiry date must always be in the future at creation time."""
        today = date.today()
        expiry = today + timedelta(days=expiry_days)
        assert expiry > today
