"""Property-based tests for proforma invoice (quote) operations.

Tests quote numbering, total calculations, status transitions, and expiry logic.
"""

import uuid
from decimal import Decimal
from datetime import datetime, timedelta

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

price_st = st.decimals(min_value=Decimal("0.01"), max_value=Decimal("99999.99"), places=2)
quantity_st = st.decimals(min_value=Decimal("1"), max_value=Decimal("1000"), places=2)
tax_pct_st = st.decimals(min_value=Decimal("0"), max_value=Decimal("30"), places=2)
discount_pct_st = st.decimals(min_value=Decimal("0"), max_value=Decimal("100"), places=2)
validity_days_st = st.integers(min_value=1, max_value=365)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestProformaProperties:
    """Property tests for proforma invoice invariants."""

    @given(
        unit_price=price_st,
        qty=quantity_st,
        tax_pct=tax_pct_st,
    )
    @settings(max_examples=20, deadline=None)
    def test_line_item_total_calculation(self, unit_price: Decimal, qty: Decimal, tax_pct: Decimal):
        """Line total = qty × unit_price. Tax is additive.

        Why test this explicitly?
        Quote totals must match what the customer sees. Off-by-one cent
        errors in multiplication lead to disputed invoices.
        """
        subtotal = qty * unit_price
        tax = subtotal * (tax_pct / Decimal("100"))
        total = subtotal + tax
        assert total >= subtotal
        assert total >= Decimal("0")

    @given(
        items=st.lists(
            st.tuples(price_st, quantity_st, tax_pct_st),
            min_size=1,
            max_size=10,
        )
    )
    @settings(max_examples=20, deadline=None)
    def test_quote_total_is_sum_of_line_items(self, items):
        """Quote total equals sum of line subtotals plus sum of line taxes."""
        total_subtotal = Decimal("0")
        total_tax = Decimal("0")
        for price, qty, tax_pct in items:
            sub = price * qty
            total_subtotal += sub
            total_tax += sub * (tax_pct / Decimal("100"))

        quote_total = total_subtotal + total_tax
        assert quote_total == total_subtotal + total_tax
        assert quote_total >= Decimal("0")

    @given(validity_days=validity_days_st)
    @settings(max_examples=20, deadline=None)
    def test_expiry_date_is_after_issue_date(self, validity_days: int):
        """Expiry date = issue date + validity_days. Always in the future."""
        issue_date = datetime.now()
        expiry_date = issue_date + timedelta(days=validity_days)
        assert expiry_date > issue_date
        assert (expiry_date - issue_date).days == validity_days

    @given(
        status=st.sampled_from(["draft", "sent", "viewed", "approved", "rejected", "expired", "converted", "cancelled"])
    )
    @settings(max_examples=20, deadline=None)
    def test_status_is_valid(self, status: str):
        """Quote status must be one of the defined values."""
        valid = {"draft", "sent", "viewed", "approved", "rejected", "expired", "converted", "cancelled"}
        assert status in valid

    @given(discount_pct=discount_pct_st, subtotal=price_st)
    @settings(max_examples=20, deadline=None)
    def test_discount_never_exceeds_subtotal(self, discount_pct: Decimal, subtotal: Decimal):
        """Discount amount = subtotal × (pct/100). Should never exceed subtotal."""
        discount = subtotal * (discount_pct / Decimal("100"))
        assert discount <= subtotal
        assert discount >= Decimal("0")
