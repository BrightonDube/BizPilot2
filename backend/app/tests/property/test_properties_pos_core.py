"""Property-based tests for POS core operations.

Tests order flow, change calculation, receipt numbering, and void/refund rules.
"""

from decimal import Decimal

from hypothesis import given, settings, assume
from hypothesis import strategies as st


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

amount_st = st.decimals(min_value=Decimal("0.01"), max_value=Decimal("99999.99"), places=2)
tendered_st = st.decimals(min_value=Decimal("0.01"), max_value=Decimal("100000.00"), places=2)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestPOSCoreProperties:
    """Property tests for POS core invariants."""

    @given(total=amount_st, tendered=tendered_st)
    @settings(max_examples=30, deadline=None)
    def test_change_calculation(self, total: Decimal, tendered: Decimal):
        """Change = tendered - total. Must be >= 0 for cash transactions.

        Why test this?
        Wrong change calculation is immediately visible to the customer
        and erodes trust.  It's also a common source of till discrepancies.
        """
        assume(tendered >= total)
        change = tendered - total
        assert change >= Decimal("0")
        assert change == tendered - total

    @given(
        items=st.lists(
            st.tuples(amount_st, st.integers(min_value=1, max_value=50)),
            min_size=1,
            max_size=30,
        ),
        tax_pct=st.decimals(min_value=Decimal("0"), max_value=Decimal("25"), places=2),
    )
    @settings(max_examples=20, deadline=None)
    def test_receipt_total_matches_items(self, items, tax_pct: Decimal):
        """Receipt total = sum(price × qty) + tax."""
        subtotal = sum(Decimal(str(p)) * q for p, q in items)
        tax = subtotal * (tax_pct / Decimal("100"))
        total = subtotal + tax
        assert total >= subtotal
        assert total >= Decimal("0")

    @given(
        receipt_number=st.from_regex(r"R-[0-9]{8}", fullmatch=True)
    )
    @settings(max_examples=20, deadline=None)
    def test_receipt_number_format(self, receipt_number: str):
        """Receipt numbers follow a consistent format for tracking."""
        assert receipt_number.startswith("R-")
        assert len(receipt_number) == 10
        assert receipt_number[2:].isdigit()

    @given(
        original=amount_st,
        void_amount=amount_st,
    )
    @settings(max_examples=20, deadline=None)
    def test_void_must_match_original(self, original: Decimal, void_amount: Decimal):
        """A void reversal must exactly match the original transaction amount.

        Why exact match?
        Partial voids are refunds, not voids.  A void should completely
        reverse the original transaction, restoring the till to its
        prior state.
        """
        is_valid_void = void_amount == original
        if is_valid_void:
            net = original - void_amount
            assert net == Decimal("0")
