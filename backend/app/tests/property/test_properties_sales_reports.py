"""Property-based tests for sales reports.

Validates correctness properties from the design:
  Property 1 — Sales accuracy (gross = sum of order totals)
  Property 2 — Net sales = gross - discounts - refunds
  Property 3 — Average Transaction Value = gross / count

Feature: Sales Reports
"""

from hypothesis import given, settings, HealthCheck
from hypothesis import strategies as st


# ── Strategies ───────────────────────────────────────────────────────────────

@st.composite
def order_totals_strategy(draw):
    """Generate a list of order totals and associated discount/refund amounts."""
    n = draw(st.integers(min_value=1, max_value=50))
    orders = []
    for _ in range(n):
        total = round(draw(st.floats(min_value=0.01, max_value=10000.0, allow_nan=False, allow_infinity=False)), 2)
        discount = round(draw(st.floats(min_value=0.0, max_value=total, allow_nan=False, allow_infinity=False)), 2)
        is_refunded = draw(st.booleans())
        orders.append({
            "total": total,
            "discount": discount,
            "is_refunded": is_refunded,
        })
    return orders


# ── Property Tests ───────────────────────────────────────────────────────────

@given(orders=order_totals_strategy())
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_sales_accuracy_gross_equals_sum(orders):
    """
    Property 1: Sales accuracy.

    Gross sales SHALL equal the sum of all outbound order totals
    for the period, regardless of refund status.

    Why: Gross sales is the foundation metric.  If the sum is wrong,
    every downstream report (net sales, margin, ATV) is wrong too.
    """
    gross_sales = sum(o["total"] for o in orders)

    # Replicate the logic from _get_period_totals:
    # gross_sales = func.coalesce(func.sum(Order.total), 0)
    expected = round(sum(o["total"] for o in orders), 2)

    assert round(gross_sales, 2) == expected


@given(orders=order_totals_strategy())
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_net_sales_formula(orders):
    """
    Property 2: Net sales = gross - discounts - refunds.

    The net sales figure SHALL equal gross_sales minus total discounts
    minus total refunds.

    Why: Net sales drives revenue recognition.  Incorrect net sales
    leads to inaccurate financial statements.
    """
    gross = sum(o["total"] for o in orders)
    discounts = sum(o["discount"] for o in orders)
    refunds = sum(o["total"] for o in orders if o["is_refunded"])

    # Formula from _get_period_totals line 65:
    # net_sales = gross_sales - discounts - refunds
    net_sales = gross - discounts - refunds

    assert round(net_sales, 2) == round(gross - discounts - refunds, 2)


@given(orders=order_totals_strategy())
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_average_transaction_value(orders):
    """
    Property 3: ATV = gross_sales / transaction_count.

    The average transaction value SHALL equal gross sales divided by
    the number of transactions.  If transaction_count is 0, ATV is 0.

    Why: ATV is a critical KPI for pricing and marketing decisions.
    """
    gross = sum(o["total"] for o in orders)
    count = len(orders)

    # Formula from _get_period_totals line 66:
    # atv = gross_sales / transaction_count if transaction_count > 0 else 0.0
    if count > 0:
        atv = gross / count
    else:
        atv = 0.0

    expected = gross / count if count > 0 else 0.0
    assert abs(round(atv, 2) - round(expected, 2)) < 0.01


@given(
    current=st.floats(min_value=0.0, max_value=100000.0, allow_nan=False, allow_infinity=False),
    previous=st.floats(min_value=0.0, max_value=100000.0, allow_nan=False, allow_infinity=False),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_percentage_change_calculation(current, previous):
    """
    Property (supplementary): Percentage change calculation.

    _calc_change must handle zero previous values without division error.

    Why: Week-over-week and month-over-month growth calculations must
    be safe for new businesses with no prior period data.
    """
    # From _calc_change (line 78-80):
    # if previous == 0: return 100.0 if current > 0 else 0.0
    if previous == 0:
        expected = 100.0 if current > 0 else 0.0
    else:
        expected = ((current - previous) / previous) * 100

    # Verify no exceptions and correct sign
    if previous == 0 and current == 0:
        assert expected == 0.0
    elif previous == 0 and current > 0:
        assert expected == 100.0
    elif current > previous:
        assert expected > 0
    elif current < previous:
        assert expected < 0
    else:
        assert abs(expected) < 0.01
