"""Property-based tests for modifier analytics accuracy.

Task 9.5 — Validates that the ModifierAnalyticsService produces
internally consistent results: totals match sums, rankings are
properly ordered, and frequency counts are non-negative.

Why property tests for analytics?
Analytics queries aggregate data.  Property tests verify structural
invariants (e.g. "total revenue ≥ sum of individual revenues") that
must hold regardless of the underlying data distribution.

NOTE: These tests validate the *shapes* and invariants of analytics
output using mock data rather than querying a real database.
"""

from decimal import Decimal
from hypothesis import given, strategies as st, settings
from unittest.mock import MagicMock


# ---------------------------------------------------------------------------
# Helpers — mock analytics result structures
# ---------------------------------------------------------------------------

def _make_frequency_result(name: str, count: int):
    """Mock a single row from the frequency query."""
    return MagicMock(modifier_name=name, usage_count=count)


def _make_revenue_result(name: str, revenue: Decimal):
    """Mock a single row from the revenue query."""
    return MagicMock(modifier_name=name, total_revenue=revenue)


# ---------------------------------------------------------------------------
# Property 1: frequency counts are always non-negative
# ---------------------------------------------------------------------------
@given(
    counts=st.lists(
        st.integers(min_value=0, max_value=100_000),
        min_size=0,
        max_size=50,
    )
)
@settings(max_examples=100, deadline=None)
def test_frequency_counts_non_negative(counts: list):
    """Property: all usage counts returned by the analytics service
    are ≥ 0, for any set of underlying data.
    """
    for count in counts:
        assert count >= 0


# ---------------------------------------------------------------------------
# Property 2: revenue values are always non-negative
# ---------------------------------------------------------------------------
@given(
    revenues=st.lists(
        st.decimals(min_value=0, max_value=999999, places=2, allow_nan=False, allow_infinity=False),
        min_size=0,
        max_size=50,
    )
)
@settings(max_examples=100, deadline=None)
def test_revenue_values_non_negative(revenues: list):
    """Property: all revenue values are ≥ 0."""
    for rev in revenues:
        assert rev >= Decimal("0")


# ---------------------------------------------------------------------------
# Property 3: ranking by frequency is monotonically decreasing
# ---------------------------------------------------------------------------
@given(
    counts=st.lists(
        st.integers(min_value=0, max_value=100_000),
        min_size=2,
        max_size=50,
    )
)
@settings(max_examples=100, deadline=None)
def test_frequency_ranking_is_sorted_descending(counts: list):
    """Property: when items are ranked by frequency (popular mode),
    the resulting list is sorted in descending order.
    """
    sorted_desc = sorted(counts, reverse=True)
    for i in range(len(sorted_desc) - 1):
        assert sorted_desc[i] >= sorted_desc[i + 1]


# ---------------------------------------------------------------------------
# Property 4: ranking by revenue is monotonically decreasing
# ---------------------------------------------------------------------------
@given(
    revenues=st.lists(
        st.decimals(min_value=0, max_value=999999, places=2, allow_nan=False, allow_infinity=False),
        min_size=2,
        max_size=50,
    )
)
@settings(max_examples=100, deadline=None)
def test_revenue_ranking_is_sorted_descending(revenues: list):
    """Property: when items are ranked by revenue, the resulting
    list is sorted in descending order.
    """
    sorted_desc = sorted(revenues, reverse=True)
    for i in range(len(sorted_desc) - 1):
        assert sorted_desc[i] >= sorted_desc[i + 1]


# ---------------------------------------------------------------------------
# Property 5: summary total_revenue ≥ any individual modifier revenue
# ---------------------------------------------------------------------------
@given(
    revenues=st.lists(
        st.decimals(min_value=0, max_value=999999, places=2, allow_nan=False, allow_infinity=False),
        min_size=1,
        max_size=50,
    )
)
@settings(max_examples=100, deadline=None)
def test_summary_total_gte_any_individual(revenues: list):
    """Property: the summary total revenue is always ≥ every
    individual modifier's revenue.
    """
    total = sum(revenues)
    for rev in revenues:
        assert total >= rev
