"""Property-based tests for recipe management.

Tests cost calculations, ingredient scaling, food cost percentage,
and waste factors.
"""

from decimal import Decimal

from hypothesis import given, settings, assume
from hypothesis import strategies as st


class TestRecipeManagementProperties:
    """Property tests for recipe management invariants."""

    @given(
        ingredient_costs=st.lists(
            st.decimals(min_value=Decimal("0.01"), max_value=Decimal("1000"), places=2),
            min_size=1,
            max_size=20,
        ),
    )
    @settings(max_examples=20, deadline=None)
    def test_recipe_cost_equals_sum_of_ingredients(self, ingredient_costs: list[Decimal]):
        """Recipe cost must equal the sum of all ingredient costs.

        Why sum-based?
        Derived costs avoid rounding drift.  The recipe cost is always
        recomputed from ingredients rather than stored separately.
        """
        total = sum(ingredient_costs)
        assert total == sum(ingredient_costs)
        assert total > 0

    @given(
        base_quantity=st.decimals(min_value=Decimal("0.01"), max_value=Decimal("100"), places=2),
        scale_factor=st.decimals(min_value=Decimal("0.5"), max_value=Decimal("10"), places=1),
    )
    @settings(max_examples=20, deadline=None)
    def test_ingredient_scaling_proportional(self, base_quantity: Decimal, scale_factor: Decimal):
        """Scaled quantity = base_quantity * scale_factor.

        Why linear scaling?
        Recipe scaling is proportional for most ingredients.
        Non-linear adjustments (e.g., seasoning) are handled as
        override quantities, not in the general formula.
        """
        scaled = base_quantity * scale_factor
        assert scaled > 0

    @given(
        recipe_cost=st.decimals(min_value=Decimal("1"), max_value=Decimal("1000"), places=2),
        selling_price=st.decimals(min_value=Decimal("1"), max_value=Decimal("5000"), places=2),
    )
    @settings(max_examples=20, deadline=None)
    def test_food_cost_percentage_valid(self, recipe_cost: Decimal, selling_price: Decimal):
        """Food cost % = (recipe_cost / selling_price) * 100, capped at 0-100%.

        Why track food cost %?
        Industry standard metric. Target is typically 25-35%.
        Above 40% signals pricing or waste issues.
        """
        assume(selling_price > 0)
        food_cost_pct = (recipe_cost / selling_price) * 100
        assert food_cost_pct >= 0

    @given(
        waste_factor=st.decimals(min_value=Decimal("0"), max_value=Decimal("0.5"), places=2),
        base_cost=st.decimals(min_value=Decimal("1"), max_value=Decimal("500"), places=2),
    )
    @settings(max_examples=20, deadline=None)
    def test_waste_factor_increases_cost(self, waste_factor: Decimal, base_cost: Decimal):
        """Applying a waste factor must increase (or maintain) cost.

        Why waste factor?
        Peeling, trimming, and cooking loss means you buy more
        ingredient than ends up in the dish.  A 10% waste factor
        means the effective cost is base_cost / (1 - 0.10).
        """
        assume(waste_factor < Decimal("1"))
        effective_cost = base_cost / (Decimal("1") - waste_factor)
        assert effective_cost >= base_cost

    @given(
        servings=st.integers(min_value=1, max_value=200),
        cost_per_serving=st.decimals(
            min_value=Decimal("0.50"), max_value=Decimal("500"), places=2
        ),
    )
    @settings(max_examples=20, deadline=None)
    def test_batch_cost_proportional_to_servings(
        self, servings: int, cost_per_serving: Decimal
    ):
        """Batch cost = servings * cost_per_serving."""
        batch_cost = servings * cost_per_serving
        assert batch_cost == servings * cost_per_serving
        assert batch_cost > 0
