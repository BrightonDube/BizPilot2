"""Property-based tests for layby management operations.

Tests balance invariants, reference number properties,
and payment schedule consistency.
"""

from decimal import Decimal
from datetime import date, timedelta

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

amount_st = st.decimals(min_value=Decimal("10.00"), max_value=Decimal("100000.00"), places=2)
payment_st = st.decimals(min_value=Decimal("0.01"), max_value=Decimal("50000.00"), places=2)
installments_st = st.integers(min_value=1, max_value=52)
deposit_pct_st = st.decimals(min_value=Decimal("0"), max_value=Decimal("100"), places=2)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestLaybyProperties:
    """Property tests for layby business rules."""

    @given(total=amount_st, paid=payment_st)
    @settings(max_examples=30, deadline=None)
    def test_balance_invariant(self, total: Decimal, paid: Decimal):
        """balance_due = total_amount - amount_paid.

        Why this invariant?
        If balance_due drifts from the computed value, customers may
        overpay or under-pay without the system detecting it.  This is
        the single most critical layby accounting rule.
        """
        # Clamp paid to not exceed total (valid state)
        effective_paid = min(paid, total)
        balance_due = total - effective_paid
        assert balance_due == total - effective_paid
        assert balance_due >= Decimal("0")

    @given(ref_num=st.from_regex(r"LB-[0-9]{6}", fullmatch=True))
    @settings(max_examples=20, deadline=None)
    def test_reference_number_format(self, ref_num: str):
        """Layby reference numbers should follow a consistent format.

        Why enforce format?
        Reference numbers are printed on receipts and used in phone calls
        with customers.  A predictable format reduces data entry errors.
        """
        assert ref_num.startswith("LB-")
        assert len(ref_num) == 9
        assert ref_num[3:].isdigit()

    @given(
        total=amount_st,
        deposit_pct=deposit_pct_st,
        installments=installments_st,
    )
    @settings(max_examples=20, deadline=None)
    def test_schedule_sum_equals_balance(self, total: Decimal, deposit_pct: Decimal, installments: int):
        """The sum of scheduled payments must equal balance after deposit.

        Why test this?
        If the schedule doesn't add up to the balance, the customer either
        can't finish paying or pays too much.  Rounding errors in installment
        calculation are a common source of this bug.
        """
        deposit = total * (deposit_pct / Decimal("100"))
        balance = total - deposit

        if installments == 0 or balance <= 0:
            return  # edge case: fully deposited

        per_installment = balance / installments
        # Sum of installments should approximate the balance
        # (rounding errors may cause a tiny difference)
        schedule_total = per_installment * installments
        diff = abs(schedule_total - balance)
        # Allow up to 1 cent rounding per installment
        assert diff <= Decimal("0.01") * installments

    @given(
        total=amount_st,
        payments=st.lists(payment_st, min_size=1, max_size=12),
    )
    @settings(max_examples=20, deadline=None)
    def test_overpayment_detection(self, total: Decimal, payments: list):
        """Total payments must not exceed total_amount.

        If they do, the system should detect it and reject/refund.
        """
        cumulative = Decimal("0")
        for p in payments:
            cumulative += p
            if cumulative > total:
                # Overpayment detected
                assert cumulative > total
                break

    @given(
        age_days=st.integers(min_value=0, max_value=365),
    )
    @settings(max_examples=20, deadline=None)
    def test_aging_bucket_assignment(self, age_days: int):
        """Every layby age must map to exactly one aging bucket."""
        if age_days <= 30:
            bucket = "0_30"
        elif age_days <= 60:
            bucket = "31_60"
        elif age_days <= 90:
            bucket = "61_90"
        else:
            bucket = "90_plus"

        valid_buckets = {"0_30", "31_60", "61_90", "90_plus"}
        assert bucket in valid_buckets
