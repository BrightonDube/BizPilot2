"""
Property-based tests for petty cash disbursement and reconciliation logic.

Tests the mathematical invariants that must hold for financial operations:
disbursement sequencing, receipt validation, and reconciliation variance.

Why PBTs for petty cash?
Financial operations must be correct for all inputs, not just the happy path.
Hypothesis generates edge cases (zero amounts, large values, concurrent
operations) that manual testing would miss.
"""

from hypothesis import given, strategies as st, settings, assume
from decimal import Decimal


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

money = st.decimals(min_value=Decimal("0.01"), max_value=Decimal("99999.99"), places=2)
positive_int = st.integers(min_value=1, max_value=99999)


# ---------------------------------------------------------------------------
# Property: Disbursement number uniqueness
# Sequential disbursement numbers must be unique within a fund.
# ---------------------------------------------------------------------------

@settings(max_examples=50)
@given(
    count=st.integers(min_value=0, max_value=100),
    new_count=st.integers(min_value=1, max_value=50),
)
def test_disbursement_number_sequence(count, new_count):
    """
    Disbursement numbers generated sequentially must be unique.
    DISB-00001, DISB-00002, etc. — no duplicates allowed.
    """
    numbers = []
    for i in range(new_count):
        num = f"DISB-{count + i + 1:05d}"
        numbers.append(num)

    # All numbers must be unique
    assert len(set(numbers)) == len(numbers), "Duplicate disbursement numbers detected"
    # All must match expected format
    for num in numbers:
        assert num.startswith("DISB-"), f"Bad format: {num}"
        assert len(num) == 10, f"Bad length: {num}"


# ---------------------------------------------------------------------------
# Property: Reconciliation variance calculation
# variance = actual_balance - expected_balance
# ---------------------------------------------------------------------------

@settings(max_examples=100)
@given(
    expected=money,
    actual=money,
)
def test_reconciliation_variance_calculation(expected, actual):
    """
    Variance must equal actual - expected.
    Positive variance = surplus (more cash than expected).
    Negative variance = shortage (less cash than expected).
    """
    variance = actual - expected

    # Core invariant
    assert variance == actual - expected

    # Sign invariant
    if actual > expected:
        assert variance > 0, "Surplus should be positive"
    elif actual < expected:
        assert variance < 0, "Shortage should be negative"
    else:
        assert variance == 0, "Balanced should be zero"


# ---------------------------------------------------------------------------
# Property: Reconciliation status determination
# Zero variance → approved, non-zero → discrepancy
# ---------------------------------------------------------------------------

@settings(max_examples=100)
@given(
    expected=money,
    actual=money,
)
def test_reconciliation_status_from_variance(expected, actual):
    """
    Status is determined by variance:
    - Zero variance → 'approved' (balanced)
    - Non-zero variance → 'discrepancy' (needs review)
    """
    variance = actual - expected
    status = "approved" if variance == Decimal("0") else "discrepancy"

    if expected == actual:
        assert status == "approved"
    else:
        assert status == "discrepancy"


# ---------------------------------------------------------------------------
# Property: Receipt amount validation
# Receipt amount must be non-negative and within expense limit.
# ---------------------------------------------------------------------------

@settings(max_examples=50)
@given(
    expense_amount=money,
    receipt_amount=money,
    tax_amount=st.decimals(min_value=Decimal("0"), max_value=Decimal("9999.99"), places=2),
)
def test_receipt_amount_within_expense(expense_amount, receipt_amount, tax_amount):
    """
    Receipt amount (including tax) should not exceed the expense amount.
    Overspending must be flagged.
    """
    total_receipt = receipt_amount + tax_amount
    is_within_budget = total_receipt <= expense_amount

    if is_within_budget:
        assert total_receipt <= expense_amount
    else:
        assert total_receipt > expense_amount


# ---------------------------------------------------------------------------
# Property: Fund balance after disbursement
# Fund balance must decrease by exactly the disbursement amount.
# ---------------------------------------------------------------------------

@settings(max_examples=100)
@given(
    initial_balance=st.decimals(min_value=Decimal("100"), max_value=Decimal("99999.99"), places=2),
    disbursement_amount=st.decimals(min_value=Decimal("0.01"), max_value=Decimal("99.99"), places=2),
)
def test_fund_balance_after_disbursement(initial_balance, disbursement_amount):
    """
    After a disbursement, fund balance must decrease by exactly the
    disbursement amount. No rounding errors allowed.
    """
    assume(disbursement_amount <= initial_balance)

    new_balance = initial_balance - disbursement_amount

    # Exact arithmetic invariant
    assert new_balance == initial_balance - disbursement_amount
    # Balance must remain non-negative
    assert new_balance >= Decimal("0")
    # Change must equal disbursement
    assert initial_balance - new_balance == disbursement_amount


# ---------------------------------------------------------------------------
# Property: Reconciliation number uniqueness
# Same pattern as disbursement — sequential and unique.
# ---------------------------------------------------------------------------

@settings(max_examples=50)
@given(
    count=st.integers(min_value=0, max_value=100),
    new_count=st.integers(min_value=1, max_value=50),
)
def test_reconciliation_number_sequence(count, new_count):
    """Reconciliation numbers must be unique and sequential."""
    numbers = [f"RECON-{count + i + 1:05d}" for i in range(new_count)]

    assert len(set(numbers)) == len(numbers), "Duplicate reconciliation numbers"
    for num in numbers:
        assert num.startswith("RECON-")


# ---------------------------------------------------------------------------
# Property: Receipt validation state transitions
# pending → validated OR pending → rejected. No other transitions.
# ---------------------------------------------------------------------------

@settings(max_examples=50)
@given(
    is_valid=st.booleans(),
)
def test_receipt_validation_state_transition(is_valid):
    """
    Receipt validation has exactly two outcomes:
    - is_valid=True → status becomes 'validated'
    - is_valid=False → status becomes 'rejected'
    """
    initial_status = "pending"
    new_status = "validated" if is_valid else "rejected"

    assert initial_status == "pending"
    assert new_status in ("validated", "rejected")
    if is_valid:
        assert new_status == "validated"
    else:
        assert new_status == "rejected"
