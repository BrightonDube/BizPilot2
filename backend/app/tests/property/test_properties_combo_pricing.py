"""Property-based tests for combo pricing and savings calculations.

Task 5.4 — Validates that ComboService.calculate_combo_price and
calculate_savings produce correct, non-negative results for any
combo deal configuration.

Why property tests for combo pricing?
Savings calculations involve subtraction which can go negative if the
combo price exceeds the original price (a configuration error).
Property tests verify the invariant that savings are always ≥ 0
and that the combo price is always ≤ the original price.
"""

from decimal import Decimal
from hypothesis import given, strategies as st, assume, settings
from unittest.mock import MagicMock

from app.services.combo_service import ComboService


# ---------------------------------------------------------------------------
# Strategy
# ---------------------------------------------------------------------------
price_st = st.decimals(
    min_value=Decimal("0.01"),
    max_value=Decimal("99999.99"),
    places=2,
    allow_nan=False,
    allow_infinity=False,
)


def _make_combo(*, original_price: Decimal, combo_price: Decimal):
    """Build a mock ComboDeal with the given prices."""
    combo = MagicMock()
    combo.original_price = original_price
    combo.combo_price = combo_price
    return combo


# ---------------------------------------------------------------------------
# Property 1: combo price is always non-negative
# ---------------------------------------------------------------------------
@given(combo_price=price_st)
@settings(max_examples=200, deadline=None)
def test_combo_price_is_non_negative(combo_price: Decimal):
    """Property: calculate_combo_price never returns a negative value."""
    combo = _make_combo(
        original_price=combo_price + Decimal("10.00"),
        combo_price=combo_price,
    )
    # Use a fresh service instance (no DB needed for pure price calc).
    service = ComboService.__new__(ComboService)
    result = service.calculate_combo_price(combo)
    assert result >= Decimal("0")


# ---------------------------------------------------------------------------
# Property 2: savings = original − combo price
# ---------------------------------------------------------------------------
@given(original=price_st, discount=price_st)
@settings(max_examples=200, deadline=None)
def test_savings_equals_difference(original: Decimal, discount: Decimal):
    """Property: savings = original_price − combo_price, for any valid
    combo where combo_price ≤ original_price.
    """
    assume(discount <= original)
    combo = _make_combo(original_price=original, combo_price=discount)

    service = ComboService.__new__(ComboService)
    savings = service.calculate_savings(combo)

    expected = original - discount
    # Allow ±0.01 for quantization rounding.
    assert abs(savings - expected) <= Decimal("0.01"), (
        f"savings={savings}, expected={expected}"
    )


# ---------------------------------------------------------------------------
# Property 3: savings are non-negative for valid combos
# ---------------------------------------------------------------------------
@given(original=price_st, discount=price_st)
@settings(max_examples=200, deadline=None)
def test_savings_non_negative(original: Decimal, discount: Decimal):
    """Property: when combo_price ≤ original_price, savings ≥ 0."""
    assume(discount <= original)
    combo = _make_combo(original_price=original, combo_price=discount)

    service = ComboService.__new__(ComboService)
    savings = service.calculate_savings(combo)
    assert savings >= Decimal("0")


# ---------------------------------------------------------------------------
# Property 4: zero discount means zero savings
# ---------------------------------------------------------------------------
@given(price=price_st)
@settings(max_examples=50, deadline=None)
def test_no_discount_means_zero_savings(price: Decimal):
    """Property: when combo_price == original_price, savings == 0."""
    combo = _make_combo(original_price=price, combo_price=price)

    service = ComboService.__new__(ComboService)
    savings = service.calculate_savings(combo)
    assert savings == Decimal("0") or savings == Decimal("0.00")
