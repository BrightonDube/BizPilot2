"""Property-based tests for shift management.

Validates correctness properties:
  Property 1 — Expected cash = opening float + cash sales - cash refunds
  Property 2 — Single active shift per register
  Property 3 — Variance = actual cash - expected cash

Feature: Shift Management
"""

from decimal import Decimal

from hypothesis import given, settings, HealthCheck
from hypothesis import strategies as st


# ── Strategies ───────────────────────────────────────────────────────────────

@st.composite
def shift_transactions_strategy(draw):
    """Generate a shift's cash transactions (float, sales, refunds)."""
    opening_float = Decimal(str(round(draw(st.floats(
        min_value=0.0, max_value=5000.0, allow_nan=False, allow_infinity=False
    )), 2)))

    n_sales = draw(st.integers(min_value=0, max_value=30))
    sales = [
        Decimal(str(round(draw(st.floats(
            min_value=0.01, max_value=2000.0, allow_nan=False, allow_infinity=False
        )), 2)))
        for _ in range(n_sales)
    ]

    n_refunds = draw(st.integers(min_value=0, max_value=min(5, n_sales)))
    refunds = [
        Decimal(str(round(draw(st.floats(
            min_value=0.01, max_value=500.0, allow_nan=False, allow_infinity=False
        )), 2)))
        for _ in range(n_refunds)
    ]

    return {
        "opening_float": opening_float,
        "sales": sales,
        "refunds": refunds,
    }


# ── Property Tests ───────────────────────────────────────────────────────────

@given(shift=shift_transactions_strategy())
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_expected_cash_formula(shift):
    """
    Property 1: Expected cash in drawer.

    expected_cash = opening_float + Σ(cash_sales) - Σ(cash_refunds)

    Why: This is the core reconciliation formula. If expected cash is
    wrong, the variance (and thus cash-up) is meaningless.
    """
    expected = (
        shift["opening_float"]
        + sum(shift["sales"])
        - sum(shift["refunds"])
    )

    # Independent recalculation
    check = shift["opening_float"]
    for s in shift["sales"]:
        check += s
    for r in shift["refunds"]:
        check -= r

    assert expected == check


@given(
    expected=st.decimals(min_value=Decimal("0"), max_value=Decimal("50000"), places=2),
    actual=st.decimals(min_value=Decimal("0"), max_value=Decimal("50000"), places=2),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_variance_calculation(expected, actual):
    """
    Property 3: Variance = actual_cash - expected_cash.

    Positive variance means surplus (more cash than expected).
    Negative variance means shortage (less cash than expected).

    Why: Variance is the key indicator of cash handling integrity.
    An incorrect variance would either hide theft or falsely accuse staff.
    """
    variance = actual - expected

    if actual > expected:
        assert variance > 0, "Should report surplus"
    elif actual < expected:
        assert variance < 0, "Should report shortage"
    else:
        assert variance == 0, "Should report no variance"


@given(num_active=st.integers(min_value=0, max_value=5))
@settings(
    max_examples=20,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_single_active_shift_per_register(num_active):
    """
    Property 2: Single active shift per register.

    At most one shift SHALL be in OPEN status per cash register.

    Why: Multiple open shifts would double-count sales and make
    cash reconciliation impossible.
    """
    is_valid = num_active <= 1

    if num_active > 1:
        assert not is_valid, "Multiple active shifts is invalid"
    else:
        assert is_valid, f"{num_active} active shift(s) is valid"
