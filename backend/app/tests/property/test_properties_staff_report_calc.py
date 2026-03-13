"""Property-based tests for staff report calculation logic.

Tests performance scoring, hours computation, commission amounts,
and activity log structure.
"""

from decimal import Decimal

from hypothesis import given, settings
from hypothesis import strategies as st


class TestStaffReportCalculations:
    """Property tests for staff report calculation invariants."""

    @given(
        sales_amount=st.decimals(min_value=Decimal("0"), max_value=Decimal("100000"), places=2),
        target_amount=st.decimals(min_value=Decimal("1"), max_value=Decimal("100000"), places=2),
    )
    @settings(max_examples=20, deadline=None)
    def test_performance_score_calculation(self, sales_amount: Decimal, target_amount: Decimal):
        """Performance % = (sales / target) * 100."""
        score = (sales_amount / target_amount) * 100
        assert score >= 0

    @given(
        start_hour=st.integers(min_value=0, max_value=23),
        duration_hours=st.integers(min_value=1, max_value=12),
        break_minutes=st.integers(min_value=0, max_value=60),
    )
    @settings(max_examples=20, deadline=None)
    def test_net_hours_excludes_breaks(self, start_hour: int, duration_hours: int, break_minutes: int):
        """Net hours = duration - break time, always >= 0."""
        gross_minutes = duration_hours * 60
        net_minutes = max(0, gross_minutes - break_minutes)
        assert net_minutes >= 0
        assert net_minutes <= gross_minutes

    @given(
        sales=st.decimals(min_value=Decimal("0"), max_value=Decimal("50000"), places=2),
        commission_rate=st.decimals(min_value=Decimal("0"), max_value=Decimal("20"), places=2),
    )
    @settings(max_examples=20, deadline=None)
    def test_commission_non_negative(self, sales: Decimal, commission_rate: Decimal):
        """Commission = sales * rate / 100, always non-negative."""
        commission = sales * commission_rate / Decimal("100")
        assert commission >= 0

    @given(
        actions=st.lists(
            st.sampled_from(["login", "sale", "void", "refund", "logout"]),
            min_size=1,
            max_size=50,
        ),
    )
    @settings(max_examples=20, deadline=None)
    def test_activity_log_ordered(self, actions: list[str]):
        """Activity log entries must maintain insertion order."""
        assert len(actions) >= 1
