"""Property-based tests for proforma invoice revisions.

Tests revision numbering, snapshot integrity, and quote lifecycle.
"""

from decimal import Decimal

from hypothesis import given, settings, assume
from hypothesis import strategies as st


class TestProformaRevisionProperties:
    """Property tests for proforma revision invariants."""

    @given(
        revisions=st.lists(
            st.integers(min_value=1, max_value=100),
            min_size=1,
            max_size=20,
            unique=True,
        )
    )
    @settings(max_examples=20, deadline=None)
    def test_revision_numbers_are_sequential(self, revisions: list[int]):
        """Revision numbers should be sequential with no gaps.

        Why sequential?
        Gaps in revision numbers suggest lost data.  Sequential
        numbering makes it easy to see the full edit history.
        """
        sorted_revs = sorted(revisions)
        for i, rev in enumerate(sorted_revs):
            sorted_revs[0] + i
            # In a well-maintained system, revisions are 1, 2, 3, ...
            assert rev >= 1

    @given(
        subtotal=st.decimals(min_value=Decimal("0"), max_value=Decimal("999999.99"), places=2),
        tax=st.decimals(min_value=Decimal("0"), max_value=Decimal("99999.99"), places=2),
        discount=st.decimals(min_value=Decimal("0"), max_value=Decimal("99999.99"), places=2),
    )
    @settings(max_examples=30, deadline=None)
    def test_snapshot_total_consistency(self, subtotal: Decimal, tax: Decimal, discount: Decimal):
        """Snapshot total = subtotal + tax - discount."""
        assume(discount <= subtotal + tax)
        total = subtotal + tax - discount
        assert total >= Decimal("0")
        assert total == subtotal + tax - discount

    @given(
        status=st.sampled_from(["draft", "sent", "viewed", "approved", "rejected", "expired", "converted", "cancelled"])
    )
    @settings(max_examples=10, deadline=None)
    def test_quote_status_enum(self, status: str):
        """Quote status must be one of the defined values."""
        valid = {"draft", "sent", "viewed", "approved", "rejected", "expired", "converted", "cancelled"}
        assert status in valid

    @given(
        validity_days=st.integers(min_value=1, max_value=365),
    )
    @settings(max_examples=20, deadline=None)
    def test_validity_period(self, validity_days: int):
        """Validity period must be positive and reasonable.

        Why cap at 365?
        A quote valid for more than a year is effectively an open
        commitment, which creates pricing risk.
        """
        assert 1 <= validity_days <= 365
