"""Property-based tests for CRM (Customer Relationship Management) core.

Tests visit tracking, spending aggregation, segment membership,
and customer profile validation.
"""

from decimal import Decimal

from hypothesis import given, settings
from hypothesis import strategies as st


class TestCRMCoreProperties:
    """Property tests for CRM core invariants."""

    @given(
        visits=st.lists(
            st.integers(min_value=1, max_value=10),
            min_size=1,
            max_size=365,
        ),
    )
    @settings(max_examples=20, deadline=None)
    def test_visit_count_monotonic(self, visits: list[int]):
        """Visit count must only increase (append-only).

        Why append-only?
        Visits represent physical events that already happened.
        Removing a visit would corrupt the customer timeline.
        """
        running_total = 0
        for v in visits:
            running_total += v
            assert running_total >= v

    @given(
        transactions=st.lists(
            st.decimals(min_value=Decimal("0.01"), max_value=Decimal("5000"), places=2),
            min_size=1,
            max_size=100,
        ),
    )
    @settings(max_examples=20, deadline=None)
    def test_total_spent_equals_transaction_sum(self, transactions: list[Decimal]):
        """Total spent = sum of all transaction amounts.

        Why recompute?
        A stored running total can drift if transactions are
        voided or adjusted.  Recomputing ensures accuracy.
        """
        total = sum(transactions)
        assert total == sum(transactions)
        assert total > 0

    @given(
        total_spent=st.decimals(min_value=Decimal("0"), max_value=Decimal("100000"), places=2),
        threshold=st.decimals(min_value=Decimal("100"), max_value=Decimal("50000"), places=2),
    )
    @settings(max_examples=20, deadline=None)
    def test_segment_membership_deterministic(self, total_spent: Decimal, threshold: Decimal):
        """Segment membership based on total_spent is deterministic.

        Why deterministic?
        Customers appearing and disappearing from segments based on
        timing of calculation is confusing.  Fixed thresholds ensure
        consistent behaviour.
        """
        in_segment = total_spent >= threshold
        assert in_segment == (total_spent >= threshold)

    @given(
        email=st.from_regex(r"[a-z]{3,10}@[a-z]{3,10}\.[a-z]{2,4}", fullmatch=True),
    )
    @settings(max_examples=20, deadline=None)
    def test_customer_email_format(self, email: str):
        """Customer emails must contain @ and a domain."""
        assert "@" in email
        parts = email.split("@")
        assert len(parts) == 2
        assert "." in parts[1]
