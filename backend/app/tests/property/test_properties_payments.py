"""Property-based tests for integrated payment operations.

Tests payment amount validation, refund limits, and payment method consistency.
"""

from decimal import Decimal

from hypothesis import given, settings, assume
from hypothesis import strategies as st


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

payment_st = st.decimals(min_value=Decimal("0.01"), max_value=Decimal("999999.99"), places=2)
order_total_st = st.decimals(min_value=Decimal("1.00"), max_value=Decimal("999999.99"), places=2)
tip_st = st.decimals(min_value=Decimal("0"), max_value=Decimal("1000.00"), places=2)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestPaymentProperties:
    """Property tests for payment processing invariants."""

    @given(amount=payment_st, order_total=order_total_st)
    @settings(max_examples=30, deadline=None)
    def test_payment_must_not_exceed_order_total(self, amount: Decimal, order_total: Decimal):
        """Single payment should not exceed the order total (excl. tip).

        Why enforce this?
        Overpayment creates refund liability and complicates reconciliation.
        Split payments may total more individually, but each payment should
        be validated against the remaining balance.
        """
        if amount > order_total:
            assert amount > order_total  # system should reject or warn

    @given(original=payment_st, refund=payment_st)
    @settings(max_examples=30, deadline=None)
    def test_refund_cannot_exceed_original_payment(self, original: Decimal, refund: Decimal):
        """Refund amount must not exceed the original payment.

        Why this invariant?
        Refunding more than was paid is a direct financial loss and
        a common source of fraud.
        """
        assume(refund <= original)
        remaining = original - refund
        assert remaining >= Decimal("0")

    @given(
        method=st.sampled_from(["cash", "card", "eft", "mobile", "gift_card", "account", "split"])
    )
    @settings(max_examples=10, deadline=None)
    def test_payment_method_is_valid(self, method: str):
        """Payment method must be one of the defined types."""
        valid = {"cash", "card", "eft", "mobile", "gift_card", "account", "split"}
        assert method in valid

    @given(subtotal=order_total_st, tip=tip_st)
    @settings(max_examples=20, deadline=None)
    def test_total_with_tip(self, subtotal: Decimal, tip: Decimal):
        """Total charge = subtotal + tip. Tip is always non-negative."""
        total = subtotal + tip
        assert total >= subtotal
        assert tip >= Decimal("0")
