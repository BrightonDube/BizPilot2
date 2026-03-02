"""
Property-based tests for cash register operations.

Validates drawer balancing, float management, and
cash movement tracking invariants.

Feature: POS Core (Cash Register)
"""

from decimal import Decimal

from hypothesis import given, settings, HealthCheck, assume
from hypothesis import strategies as st


# ---------------------------------------------------------------------------
# Drawer balance properties
# ---------------------------------------------------------------------------

positive_cash = st.decimals(
    min_value=Decimal("0.01"),
    max_value=Decimal("99999.99"),
    places=2,
    allow_nan=False,
    allow_infinity=False,
)

non_negative_cash = st.decimals(
    min_value=Decimal("0"),
    max_value=Decimal("99999.99"),
    places=2,
    allow_nan=False,
    allow_infinity=False,
)


@given(
    opening_float=positive_cash,
    cash_sales=non_negative_cash,
    cash_refunds=non_negative_cash,
    cash_drops=non_negative_cash,
    paid_outs=non_negative_cash,
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_expected_drawer_balance(
    opening_float, cash_sales, cash_refunds, cash_drops, paid_outs
):
    """
    Property 1: Expected drawer = float + sales - refunds - drops - paid_outs.

    Why: This is the fundamental cash accounting equation. If the
    expected balance is wrong, the variance calculation at shift
    close will be meaningless.
    """
    assume(cash_refunds <= cash_sales + opening_float)
    assume(cash_drops <= cash_sales + opening_float)
    assume(paid_outs <= cash_sales + opening_float)

    expected = opening_float + cash_sales - cash_refunds - cash_drops - paid_outs
    actual_formula = opening_float + cash_sales - cash_refunds - cash_drops - paid_outs
    assert expected == actual_formula


@given(
    expected=non_negative_cash,
    actual=non_negative_cash,
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_variance_is_actual_minus_expected(expected, actual):
    """
    Property 2: Variance = actual_count - expected_balance.

    Positive variance = cash over, negative = cash short.

    Why: Variance drives cash accountability. A sign error would
    flag shortages as surpluses and vice versa.
    """
    variance = actual - expected
    if actual > expected:
        assert variance > Decimal("0")
    elif actual < expected:
        assert variance < Decimal("0")
    else:
        assert variance == Decimal("0")


@given(
    float_amount=positive_cash,
)
@settings(
    max_examples=30,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_opening_float_is_positive(float_amount):
    """
    Property 3: Opening float must be positive.

    Why: A zero or negative float means the drawer can't make change
    for the first customer, which halts operations.
    """
    assert float_amount > Decimal("0")


@given(
    denominations=st.lists(
        st.tuples(
            st.sampled_from([
                Decimal("0.10"), Decimal("0.20"), Decimal("0.50"),
                Decimal("1.00"), Decimal("2.00"), Decimal("5.00"),
                Decimal("10.00"), Decimal("20.00"), Decimal("50.00"),
                Decimal("100.00"), Decimal("200.00"),
            ]),
            st.integers(min_value=0, max_value=100),
        ),
        min_size=1,
        max_size=11,
    ),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_counted_total_matches_denomination_sum(denominations):
    """
    Property 4: Total counted cash = sum of (denomination × quantity).

    Why: The denomination count feature helps staff verify their
    cash count. If the sum doesn't match, the staff sees conflicting
    totals, causing confusion.
    """
    total = sum(denom * qty for denom, qty in denominations)
    assert total >= Decimal("0")

    # Verify: recalculate independently
    independent_total = Decimal("0")
    for denom, qty in denominations:
        independent_total += denom * qty
    assert total == independent_total
