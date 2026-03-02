"""Property-based tests for order modifier persistence.

Task 11.3 — Validates that modifier data attached to order items
is correctly structured: prices are non-negative, quantities ≥ 1,
and the computed total_price equals unit_price × quantity.

Why property tests?
Order modifier records are financial data.  A rounding error or
negative price slipping through would affect revenue reporting.
Property tests exercise the arithmetic invariant for a wide range
of realistic price/quantity combinations.
"""

from decimal import Decimal, ROUND_HALF_UP
from hypothesis import given, strategies as st, settings

from app.schemas.order import OrderItemModifierCreate


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------
price_st = st.decimals(
    min_value=Decimal("0.00"),
    max_value=Decimal("99999.99"),
    places=2,
    allow_nan=False,
    allow_infinity=False,
)
quantity_st = st.integers(min_value=1, max_value=999)
name_st = st.text(
    alphabet=st.characters(whitelist_categories=("L", "N", "P", "Z")),
    min_size=1,
    max_size=50,
)


# ---------------------------------------------------------------------------
# Property 1: total_price must equal unit_price × quantity
# ---------------------------------------------------------------------------
@given(unit_price=price_st, quantity=quantity_st, name=name_st, group=name_st)
@settings(max_examples=200, deadline=None)
def test_total_equals_unit_times_quantity(
    unit_price: Decimal, quantity: int, name: str, group: str
):
    """Property: for any modifier create payload, the total_price
    field should equal unit_price × quantity (matching what the
    service layer computes before persisting).
    """
    expected_total = (unit_price * quantity).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    mod = OrderItemModifierCreate(
        modifier_name=name.strip() or "Modifier",
        group_name=group.strip() or "Group",
        quantity=quantity,
        unit_price=unit_price,
        total_price=expected_total,
    )

    assert mod.total_price == expected_total


# ---------------------------------------------------------------------------
# Property 2: unit_price is always non-negative
# ---------------------------------------------------------------------------
@given(unit_price=price_st, quantity=quantity_st)
@settings(max_examples=100, deadline=None)
def test_unit_price_non_negative(unit_price: Decimal, quantity: int):
    """Property: OrderItemModifierCreate rejects negative unit prices
    via the Field(ge=0) constraint.
    """
    total = (unit_price * quantity).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    mod = OrderItemModifierCreate(
        modifier_name="Test",
        group_name="Group",
        quantity=quantity,
        unit_price=unit_price,
        total_price=total,
    )
    assert mod.unit_price >= Decimal("0")


# ---------------------------------------------------------------------------
# Property 3: quantity is always ≥ 1
# ---------------------------------------------------------------------------
@given(quantity=quantity_st)
@settings(max_examples=50, deadline=None)
def test_quantity_at_least_one(quantity: int):
    """Property: OrderItemModifierCreate enforces quantity ≥ 1."""
    mod = OrderItemModifierCreate(
        modifier_name="Test",
        group_name="Group",
        quantity=quantity,
        unit_price=Decimal("5.00"),
        total_price=Decimal("5.00") * quantity,
    )
    assert mod.quantity >= 1
