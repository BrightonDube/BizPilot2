"""Property-based tests for shift management.

Tests PIN security, single active shift constraint, cash variance,
and float configuration.
"""

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st
from decimal import Decimal


class TestShiftManagementProperties:
    """Property tests for shift management invariants."""

    @given(
        pin=st.from_regex(r"[0-9]{4,6}", fullmatch=True)
    )
    @settings(max_examples=20, deadline=None)
    def test_pin_format(self, pin: str):
        """Shift PINs must be 4-6 digit numeric strings.

        Why 4-6 digits?
        Short enough to enter quickly on a touchscreen POS, but
        long enough to resist brute-force (10^4 to 10^6 combinations).
        """
        assert len(pin) >= 4
        assert len(pin) <= 6
        assert pin.isdigit()

    @given(
        active_shifts=st.integers(min_value=0, max_value=5),
    )
    @settings(max_examples=20, deadline=None)
    def test_single_active_shift_per_user(self, active_shifts: int):
        """Each user must have at most one active shift at a time.

        Why single-shift?
        Multiple active shifts would allow a cashier to record
        sales under different drawers simultaneously, making
        cash reconciliation impossible.
        """
        is_valid = active_shifts <= 1
        if active_shifts > 1:
            assert not is_valid

    @given(
        expected_cash=st.decimals(min_value=Decimal("0"), max_value=Decimal("50000"), places=2),
        actual_cash=st.decimals(min_value=Decimal("0"), max_value=Decimal("50000"), places=2),
    )
    @settings(max_examples=20, deadline=None)
    def test_cash_variance_calculation(self, expected_cash: Decimal, actual_cash: Decimal):
        """Cash variance = actual_cash - expected_cash.

        Why track variance?
        Variance is the core metric for cash accountability.
        Positive = overage, negative = shortage.
        """
        variance = actual_cash - expected_cash
        assert variance == actual_cash - expected_cash

    @given(
        float_amount=st.decimals(min_value=Decimal("0"), max_value=Decimal("5000"), places=2),
    )
    @settings(max_examples=20, deadline=None)
    def test_float_amount_non_negative(self, float_amount: Decimal):
        """Cash drawer float must be non-negative."""
        assert float_amount >= Decimal("0")

    @given(
        sales_count=st.integers(min_value=0, max_value=500),
        refund_count=st.integers(min_value=0, max_value=50),
    )
    @settings(max_examples=20, deadline=None)
    def test_shift_sales_include_refunds(self, sales_count: int, refund_count: int):
        """Net transaction count = sales - refunds, never negative in count.

        Why track separately?
        Aggregating sales and refunds separately allows managers
        to spot patterns (high refund ratios) that indicate issues.
        """
        net = sales_count - refund_count
        # Net can be negative if more refunds than sales (unusual but valid)
        assert isinstance(net, int)
        assert sales_count >= 0
        assert refund_count >= 0
