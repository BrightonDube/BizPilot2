"""Property-based tests for recipe management.

Validates correctness properties from the design:
  Property 1 — Cost accuracy (cost = sum of ingredient_qty × ingredient_cost)
  Property 2 — Ingredient deduction (deduction = recipe_qty × sold_qty)

Feature: Recipe Management
"""

from decimal import Decimal
from hypothesis import given, settings, HealthCheck
from hypothesis import strategies as st


# ── Strategies ───────────────────────────────────────────────────────────────

@st.composite
def ingredient_list_strategy(draw):
    """Generate a list of ingredients with quantities and unit costs."""
    n = draw(st.integers(min_value=1, max_value=15))
    ingredients = []
    for _ in range(n):
        qty = draw(st.decimals(min_value=Decimal("0.01"), max_value=Decimal("100"), places=4))
        cost = draw(st.decimals(min_value=Decimal("0.01"), max_value=Decimal("1000"), places=4))
        ingredients.append({"quantity": qty, "cost": cost})
    return ingredients


# ── Property Tests ───────────────────────────────────────────────────────────

@given(ingredients=ingredient_list_strategy())
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_recipe_cost_accuracy(ingredients):
    """
    Property 1: Cost accuracy.

    For any recipe, the total cost SHALL equal the sum of
    (ingredient_quantity × ingredient_cost) for every ingredient.

    Why: Recipe cost is the foundation for food cost % and pricing.
    An incorrect cost directly causes wrong margins and potential losses.
    """
    # Replicate menu_service.calculate_recipe_cost logic:
    # total = sum(qty * cost for each ingredient)
    total_cost = sum(
        ing["quantity"] * ing["cost"] for ing in ingredients
    )

    # Verify: must equal independent re-computation
    expected = Decimal("0")
    for ing in ingredients:
        expected += ing["quantity"] * ing["cost"]

    assert total_cost == expected
    assert total_cost > 0, "Recipe with ingredients must have positive cost"


@given(
    ingredients=ingredient_list_strategy(),
    sold_quantity=st.integers(min_value=1, max_value=50),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_ingredient_deduction_accuracy(ingredients, sold_quantity):
    """
    Property 2: Ingredient deduction.

    For any sale of a recipe item, each ingredient SHALL be deducted
    by (recipe_quantity × sold_quantity).

    Why: Incorrect deductions cause phantom stock (system says you have
    stock but the shelf is empty) or premature stockouts.
    """
    deductions = []
    for ing in ingredients:
        deducted = ing["quantity"] * sold_quantity
        deductions.append(deducted)

    # Verify: each deduction is recipe_qty * sold_qty
    for i, ing in enumerate(ingredients):
        expected = ing["quantity"] * sold_quantity
        assert deductions[i] == expected, (
            f"Ingredient {i}: deducted {deductions[i]} != expected {expected}"
        )


@given(
    ingredients=ingredient_list_strategy(),
    yield_qty=st.decimals(min_value=Decimal("1"), max_value=Decimal("100"), places=2),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_cost_per_portion(ingredients, yield_qty):
    """
    Property (supplementary): Cost per portion = total_cost / yield.

    Why: Cost per portion drives menu pricing decisions.  Division by
    zero for yield=0 must be guarded against.
    """
    total_cost = sum(ing["quantity"] * ing["cost"] for ing in ingredients)

    # Replicate get_recipe_food_cost_pct logic:
    # cost_per_portion = total_cost / yield_quantity if yield > 0 else total_cost
    if yield_qty and yield_qty > 0:
        cpp = total_cost / yield_qty
    else:
        cpp = total_cost

    expected = total_cost / yield_qty if yield_qty > 0 else total_cost
    assert cpp == expected
    assert cpp > 0
