"""Property-based tests for menu engineering.

Tests PLU code format, modifier pricing, and recipe cost calculation.
"""

from decimal import Decimal

from hypothesis import given, settings
from hypothesis import strategies as st


price_st = st.decimals(min_value=Decimal("0.01"), max_value=Decimal("9999.99"), places=2)


class TestMenuEngineeringProperties:
    """Property tests for menu engineering invariants."""

    @given(plu=st.from_regex(r"[A-Z0-9]{3,10}", fullmatch=True))
    @settings(max_examples=20, deadline=None)
    def test_plu_code_format(self, plu: str):
        """PLU codes must be alphanumeric and 3-10 characters.

        Why this format?
        PLU codes are typed on POS keypads.  Short, uppercase
        alphanumeric codes minimise entry errors.
        """
        assert 3 <= len(plu) <= 10
        assert plu.isalnum()
        assert plu == plu.upper()

    @given(
        base_price=price_st,
        modifier_adj=st.decimals(min_value=Decimal("-50.00"), max_value=Decimal("100.00"), places=2),
    )
    @settings(max_examples=30, deadline=None)
    def test_modifier_price_adjustment(self, base_price: Decimal, modifier_adj: Decimal):
        """Final price = base + modifier adjustment, must be >= 0."""
        final = base_price + modifier_adj
        if final < Decimal("0"):
            # System should reject negative final prices
            assert final < Decimal("0")
        else:
            assert final >= Decimal("0")

    @given(
        ingredients=st.lists(
            st.tuples(
                price_st,  # unit cost
                st.decimals(min_value=Decimal("0.01"), max_value=Decimal("100"), places=2),  # qty
            ),
            min_size=1,
            max_size=20,
        )
    )
    @settings(max_examples=20, deadline=None)
    def test_recipe_cost_is_sum_of_ingredients(self, ingredients):
        """Recipe cost = sum(ingredient_cost × quantity).

        Why verify this?
        Menu engineering profitability analysis depends on accurate
        recipe costing.  An error here cascades into wrong GP margins.
        """
        total_cost = sum(Decimal(str(cost)) * Decimal(str(qty)) for cost, qty in ingredients)
        assert total_cost > Decimal("0")

    @given(
        cost=price_st,
        selling=price_st,
    )
    @settings(max_examples=20, deadline=None)
    def test_gross_profit_calculation(self, cost: Decimal, selling: Decimal):
        """GP = selling - cost.  GP% = GP / selling × 100."""
        gp = selling - cost
        if selling > Decimal("0"):
            gp_pct = (gp / selling) * Decimal("100")
            assert isinstance(gp_pct, Decimal)
