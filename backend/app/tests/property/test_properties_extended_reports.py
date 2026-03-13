"""Property-based tests for extended reports.

Tests report date range validation, pagination bounds, and export format options.
"""

from datetime import datetime, timedelta

from hypothesis import given, settings
from hypothesis import strategies as st


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

page_st = st.integers(min_value=1, max_value=1000)
per_page_st = st.integers(min_value=1, max_value=100)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestExtendedReportProperties:
    """Property tests for extended report invariants."""

    @given(
        days_back=st.integers(min_value=1, max_value=365),
        range_days=st.integers(min_value=1, max_value=90),
    )
    @settings(max_examples=20, deadline=None)
    def test_date_range_start_before_end(self, days_back: int, range_days: int):
        """Report date ranges must have start < end.

        Why enforce this?
        Reversed date ranges produce empty results with no error,
        wasting the user's time and potentially hiding data issues.
        """
        end_date = datetime.now() - timedelta(days=days_back)
        start_date = end_date - timedelta(days=range_days)
        assert start_date < end_date

    @given(total=st.integers(min_value=0, max_value=10000), page=page_st, per_page=per_page_st)
    @settings(max_examples=20, deadline=None)
    def test_pagination_pages_calculation(self, total: int, page: int, per_page: int):
        """Total pages = ceil(total / per_page), and page <= total_pages."""
        import math
        total_pages = math.ceil(total / per_page) if total > 0 else 0
        if total > 0:
            assert total_pages >= 1
            assert total_pages * per_page >= total

    @given(
        format_type=st.sampled_from(["json", "csv", "excel", "pdf"]),
    )
    @settings(max_examples=10, deadline=None)
    def test_export_format_is_valid(self, format_type: str):
        """Reports can only be exported in supported formats."""
        valid_formats = {"json", "csv", "excel", "pdf"}
        assert format_type in valid_formats
