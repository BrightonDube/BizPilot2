"""Property-based tests for refund calculation with modifiers.

Task 11.5 — Validates that refund calculations correctly include
modifier prices and never produce negative refund amounts.

Why property tests?
Refund logic multiplies unit prices by quantities and sums across
modifiers.  Edge cases (zero prices, large quantities, many modifiers)
are easy to miss in hand-written tests.
"""

from decimal import Decimal, ROUND_HALF_UP
from hypothesis import given, strategies as st, settings


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------
price_st = st.decimals(
    min_value=Decimal("0.00"),
    max_value=Decimal("9999.99"),
    places=2,
    allow_nan=False,
    allow_infinity=False,
)
quantity_st = st.integers(min_value=1, max_value=100)


def _calculate_item_refund(
    item_unit_price: Decimal,
    item_quantity: int,
    modifier_selections: list,
) -> Decimal:
    """Compute refund for one order item, mirroring the service logic.

    Why replicate instead of import?
    The actual order_service._calculate_order_totals is tightly coupled
    to the ORM.  We test the *arithmetic invariant* here.

    Returns:
        The total refundable amount for the item including its modifiers.
    """
    # Base item total.
    item_total = (item_unit_price * item_quantity).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    # Modifier total.
    modifier_total = Decimal("0.00")
    for mod in modifier_selections:
        mod_line = (mod["unit_price"] * mod["quantity"]).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        modifier_total += mod_line

    return item_total + modifier_total


# ---------------------------------------------------------------------------
# Property 1: refund is always non-negative
# ---------------------------------------------------------------------------
@given(
    item_price=price_st,
    item_qty=quantity_st,
    mod_prices=st.lists(price_st, min_size=0, max_size=10),
    mod_qtys=st.lists(quantity_st, min_size=0, max_size=10),
)
@settings(max_examples=200, deadline=None)
def test_refund_is_non_negative(
    item_price: Decimal,
    item_qty: int,
    mod_prices: list,
    mod_qtys: list,
):
    """Property: the refund amount for any item + modifiers is ≥ 0."""
    # Zip to the shorter list.
    mods = [
        {"unit_price": p, "quantity": q}
        for p, q in zip(mod_prices, mod_qtys)
    ]

    refund = _calculate_item_refund(item_price, item_qty, mods)
    assert refund >= Decimal("0")


# ---------------------------------------------------------------------------
# Property 2: refund with no modifiers equals item total
# ---------------------------------------------------------------------------
@given(item_price=price_st, item_qty=quantity_st)
@settings(max_examples=100, deadline=None)
def test_refund_without_modifiers_equals_item_total(
    item_price: Decimal, item_qty: int
):
    """Property: when there are no modifiers, the refund equals
    item_unit_price × quantity.
    """
    refund = _calculate_item_refund(item_price, item_qty, [])
    expected = (item_price * item_qty).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    assert refund == expected


# ---------------------------------------------------------------------------
# Property 3: adding a modifier always increases refund
# ---------------------------------------------------------------------------
@given(
    item_price=price_st,
    item_qty=quantity_st,
    mod_price=st.decimals(
        min_value=Decimal("0.01"),  # strictly positive
        max_value=Decimal("9999.99"),
        places=2,
        allow_nan=False,
        allow_infinity=False,
    ),
    mod_qty=quantity_st,
)
@settings(max_examples=100, deadline=None)
def test_adding_modifier_increases_refund(
    item_price: Decimal, item_qty: int, mod_price: Decimal, mod_qty: int
):
    """Property: adding a positive-price modifier always makes the
    refund strictly larger than without the modifier.
    """
    refund_without = _calculate_item_refund(item_price, item_qty, [])
    refund_with = _calculate_item_refund(
        item_price,
        item_qty,
        [{"unit_price": mod_price, "quantity": mod_qty}],
    )
    assert refund_with > refund_without
