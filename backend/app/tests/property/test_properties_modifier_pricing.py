"""Property-based tests for modifier pricing calculations.

Task 3.7 — Validates that ModifierPricingService produces correct,
non-negative prices for any combination of inputs and pricing types.

Why property tests for pricing?
Pricing arithmetic is deceptively tricky (rounding, percentages of
zero, huge quantities).  Property tests catch edge cases that manual
test matrices would miss.
"""

from decimal import Decimal, ROUND_HALF_UP
from hypothesis import given, strategies as st, assume, settings

from app.services.modifier_pricing_service import ModifierPricingService


# ---------------------------------------------------------------------------
# Reusable strategies
# ---------------------------------------------------------------------------
# Prices and quantities encountered in a real restaurant/retail POS.
price_st = st.decimals(min_value=0, max_value=99999, places=2, allow_nan=False, allow_infinity=False)
quantity_st = st.integers(min_value=1, max_value=1000)
percent_st = st.decimals(min_value=0, max_value=100, places=2, allow_nan=False, allow_infinity=False)


# ---------------------------------------------------------------------------
# Property 1: Fixed pricing — result is always price * quantity
# ---------------------------------------------------------------------------
@given(price=price_st, quantity=quantity_st)
@settings(max_examples=200, deadline=None)
def test_fixed_pricing_equals_price_times_quantity(price: Decimal, quantity: int):
    """Property: for 'fixed' pricing, total = price_value × quantity,
    regardless of the base item price.
    """
    result = ModifierPricingService.calculate_modifier_price(
        pricing_type="fixed",
        price_value=price,
        base_item_price=Decimal("100.00"),  # irrelevant for fixed
        quantity=quantity,
    )
    expected = (price * quantity).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    assert result == expected


# ---------------------------------------------------------------------------
# Property 2: Percentage pricing — result is non-negative
# ---------------------------------------------------------------------------
@given(percent=percent_st, base_price=price_st, quantity=quantity_st)
@settings(max_examples=200, deadline=None)
def test_percentage_pricing_is_non_negative(
    percent: Decimal, base_price: Decimal, quantity: int
):
    """Property: percentage pricing never produces a negative result."""
    result = ModifierPricingService.calculate_modifier_price(
        pricing_type="percentage",
        price_value=percent,
        base_item_price=base_price,
        quantity=quantity,
    )
    assert result >= Decimal("0")


# ---------------------------------------------------------------------------
# Property 3: Zero price always yields zero total
# ---------------------------------------------------------------------------
@given(quantity=quantity_st)
@settings(max_examples=50, deadline=None)
def test_zero_price_yields_zero(quantity: int):
    """Property: a modifier with price_value 0 always costs 0."""
    for pricing_type in ("fixed", "percentage"):
        result = ModifierPricingService.calculate_modifier_price(
            pricing_type=pricing_type,
            price_value=Decimal("0"),
            base_item_price=Decimal("50.00"),
            quantity=quantity,
        )
        assert result == Decimal("0") or result == Decimal("0.00")


# ---------------------------------------------------------------------------
# Property 4: Aggregate total is sum of individual prices
# ---------------------------------------------------------------------------
@given(
    prices=st.lists(price_st, min_size=0, max_size=20),
    base_price=price_st,
)
@settings(max_examples=100, deadline=None)
def test_total_is_sum_of_individual_prices(
    prices: list, base_price: Decimal
):
    """Property: calculate_total_modifier_price returns the sum of
    individual calculate_modifier_price calls for each selection.
    """
    selections = [
        {"pricing_type": "fixed", "price_value": p, "quantity": 1}
        for p in prices
    ]

    total = ModifierPricingService.calculate_total_modifier_price(
        selections=selections,
        base_item_price=base_price,
    )

    expected = sum(
        ModifierPricingService.calculate_modifier_price(
            pricing_type="fixed",
            price_value=p,
            base_item_price=base_price,
            quantity=1,
        )
        for p in prices
    )

    # Allow for rounding at the final step.
    assert abs(total - expected) <= Decimal("0.01") * len(prices)


# ---------------------------------------------------------------------------
# Property 5: First-N-free rule — free items cost nothing
# ---------------------------------------------------------------------------
@given(
    total_qty=st.integers(min_value=1, max_value=50),
    free_count=st.integers(min_value=0, max_value=50),
    price_per_additional=price_st,
)
@settings(max_examples=100, deadline=None)
def test_first_n_free_never_negative(
    total_qty: int, free_count: int, price_per_additional: Decimal
):
    """Property: first-N-free rule never returns a negative price."""
    result = ModifierPricingService.apply_first_n_free_rule(
        quantities=total_qty,
        free_count=free_count,
        price_per_additional=price_per_additional,
    )
    assert result >= Decimal("0")
