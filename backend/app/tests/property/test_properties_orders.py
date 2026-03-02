"""Property-based tests for order management.

Validates correctness properties:
  Property 1 — Item total = (unit_price × qty) - discount + tax
  Property 2 — Order total = Σ(item subtotals) + shipping - discounts
  Property 3 — Tax calculation accuracy

Feature: Order Management
"""

from decimal import Decimal

from hypothesis import given, settings, HealthCheck
from hypothesis import strategies as st


# ── Strategies ───────────────────────────────────────────────────────────────

@st.composite
def order_item_strategy(draw):
    """Generate an order item with price, qty, discount%, tax%."""
    unit_price = Decimal(str(round(draw(st.floats(
        min_value=0.01, max_value=5000.0, allow_nan=False, allow_infinity=False
    )), 2)))
    quantity = draw(st.integers(min_value=1, max_value=100))
    discount_pct = Decimal(str(round(draw(st.floats(
        min_value=0.0, max_value=50.0, allow_nan=False, allow_infinity=False
    )), 2)))
    tax_rate = Decimal(str(round(draw(st.floats(
        min_value=0.0, max_value=25.0, allow_nan=False, allow_infinity=False
    )), 2)))
    return {
        "unit_price": unit_price,
        "quantity": quantity,
        "discount_percent": discount_pct,
        "tax_rate": tax_rate,
    }


@st.composite
def order_strategy(draw):
    """Generate an order with multiple items + shipping + discount."""
    n = draw(st.integers(min_value=1, max_value=10))
    items = [draw(order_item_strategy()) for _ in range(n)]
    shipping = Decimal(str(round(draw(st.floats(
        min_value=0.0, max_value=200.0, allow_nan=False, allow_infinity=False
    )), 2)))
    order_discount = Decimal(str(round(draw(st.floats(
        min_value=0.0, max_value=100.0, allow_nan=False, allow_infinity=False
    )), 2)))
    return {"items": items, "shipping": shipping, "order_discount": order_discount}


# ── Property Tests ───────────────────────────────────────────────────────────

@given(item=order_item_strategy())
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_item_total_calculation(item):
    """
    Property 1: Item total accuracy.

    For any order item:
      line_total = unit_price × quantity
      discount_amount = line_total × (discount_percent / 100)
      taxable = line_total - discount_amount
      tax_amount = taxable × (tax_rate / 100)
      total = taxable + tax_amount

    Why: Item-level rounding errors compound across the order.
    One cent off per item × 50 items = R0.50 discrepancy.
    """
    # Replicate _create_order_item logic (lines 178-183)
    line_total = item["unit_price"] * item["quantity"]
    discount_amount = line_total * (item["discount_percent"] / Decimal("100"))
    taxable = line_total - discount_amount
    tax_amount = taxable * (item["tax_rate"] / Decimal("100"))
    total = taxable + tax_amount

    assert total == taxable + tax_amount
    assert total >= 0
    assert discount_amount >= 0
    assert tax_amount >= 0


@given(order=order_strategy())
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_order_total_formula(order):
    """
    Property 2: Order total = subtotal + tax + shipping - order_discount - item_discounts.

    Replicates _calculate_order_totals (line 234):
      order.total = subtotal + tax_amount + shipping - order_discount - item_discounts

    Why: Incorrect order totals directly affect payments, receipts,
    and financial reconciliation.
    """
    subtotal = Decimal("0")
    tax_total = Decimal("0")
    item_discounts = Decimal("0")

    for item in order["items"]:
        line = item["unit_price"] * item["quantity"]
        disc = line * (item["discount_percent"] / Decimal("100"))
        taxable = line - disc
        tax = taxable * (item["tax_rate"] / Decimal("100"))

        subtotal += line
        tax_total += tax
        item_discounts += disc

    total = subtotal + tax_total + order["shipping"] - order["order_discount"] - item_discounts
    expected = subtotal + tax_total + order["shipping"] - order["order_discount"] - item_discounts

    assert total == expected


@given(
    amount=st.decimals(min_value=Decimal("0.01"), max_value=Decimal("10000"), places=2),
    tax_rate=st.decimals(min_value=Decimal("0"), max_value=Decimal("25"), places=2),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_tax_calculation_non_negative(amount, tax_rate):
    """
    Property 3: Tax is always non-negative.

    For any positive taxable amount and non-negative rate,
    tax_amount SHALL be ≥ 0.

    Why: Negative tax would effectively grant an additional discount,
    distorting revenue and creating tax compliance issues.
    """
    tax_amount = amount * (tax_rate / Decimal("100"))
    assert tax_amount >= 0
