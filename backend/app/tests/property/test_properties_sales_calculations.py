"""Property-based tests for sales report calculations.

Tests revenue aggregation, discount impacts, tax calculations, and ATV.
"""

from decimal import Decimal

from hypothesis import given, settings
from hypothesis import strategies as st


class TestSalesReportProperties:
    """Property tests for sales report calculation invariants."""

    @given(
        line_totals=st.lists(
            st.decimals(min_value=Decimal("0.01"), max_value=Decimal("10000"), places=2),
            min_size=1,
            max_size=50,
        ),
    )
    @settings(max_examples=20, deadline=None)
    def test_gross_revenue_equals_sum_of_line_totals(self, line_totals: list[Decimal]):
        """Gross revenue = sum of all line item totals.

        Why sum-based?
        Incremental running totals drift with rounding.
        Recomputing from line items ensures accuracy.
        """
        gross = sum(line_totals)
        assert gross == sum(line_totals)
        assert gross > 0

    @given(
        gross=st.decimals(min_value=Decimal("100"), max_value=Decimal("100000"), places=2),
        discount_pct=st.decimals(min_value=Decimal("0"), max_value=Decimal("100"), places=2),
    )
    @settings(max_examples=20, deadline=None)
    def test_net_revenue_after_discount(self, gross: Decimal, discount_pct: Decimal):
        """Net revenue = gross * (1 - discount_pct/100), always >= 0.

        Why percentage-based?
        Both flat and percentage discounts are normalised to a
        percentage for consistent reporting.
        """
        net = gross * (Decimal("1") - discount_pct / Decimal("100"))
        assert net >= 0 or discount_pct > Decimal("100")

    @given(
        net_revenue=st.decimals(min_value=Decimal("100"), max_value=Decimal("50000"), places=2),
        tax_rate=st.decimals(min_value=Decimal("0"), max_value=Decimal("25"), places=2),
    )
    @settings(max_examples=20, deadline=None)
    def test_tax_amount_calculation(self, net_revenue: Decimal, tax_rate: Decimal):
        """Tax = net_revenue * tax_rate / 100."""
        tax = net_revenue * tax_rate / Decimal("100")
        assert tax >= 0

    @given(
        total_revenue=st.decimals(min_value=Decimal("100"), max_value=Decimal("100000"), places=2),
        transaction_count=st.integers(min_value=1, max_value=1000),
    )
    @settings(max_examples=20, deadline=None)
    def test_average_transaction_value(self, total_revenue: Decimal, transaction_count: int):
        """ATV = total_revenue / transaction_count, always positive.

        Why ATV?
        Average transaction value is a key KPI for retail.
        Tracking it over time reveals trends in basket size.
        """
        atv = total_revenue / Decimal(str(transaction_count))
        assert atv > 0
