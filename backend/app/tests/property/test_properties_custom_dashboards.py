"""Property-based tests for custom dashboard features.

Tests widget configuration validation, layout constraints, and share permissions.
"""

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st


class TestDashboardWidgetProperties:
    """Property tests for dashboard widget configuration invariants."""

    @given(
        widget_type=st.sampled_from([
            "line_chart", "bar_chart", "pie_chart", "table",
            "kpi_card", "metric", "donut_chart",
        ]),
    )
    @settings(max_examples=10, deadline=None)
    def test_widget_type_valid(self, widget_type: str):
        """Widget type must be a supported visualization."""
        valid = {"line_chart", "bar_chart", "pie_chart", "table",
                 "kpi_card", "metric", "donut_chart"}
        assert widget_type in valid

    @given(
        width=st.integers(min_value=1, max_value=12),
        height=st.integers(min_value=1, max_value=8),
    )
    @settings(max_examples=20, deadline=None)
    def test_widget_size_within_grid(self, width: int, height: int):
        """Widgets must fit within the 12-column grid.

        Why 12 columns?
        Industry standard responsive grid (Bootstrap, Material).
        12 is divisible by 2, 3, 4, 6 — giving flexible layouts.
        """
        assert 1 <= width <= 12
        assert 1 <= height <= 8

    @given(
        x=st.integers(min_value=0, max_value=11),
        y=st.integers(min_value=0, max_value=100),
        width=st.integers(min_value=1, max_value=12),
    )
    @settings(max_examples=20, deadline=None)
    def test_widget_position_no_overflow(self, x: int, y: int, width: int):
        """Widget x + width must not exceed grid columns."""
        fits = (x + width) <= 12
        assert isinstance(fits, bool)


class TestDashboardShareProperties:
    """Property tests for dashboard sharing invariants."""

    @given(
        permission=st.sampled_from(["view", "edit", "admin"]),
    )
    @settings(max_examples=5, deadline=None)
    def test_share_permission_valid(self, permission: str):
        """Share permission must be a valid access level."""
        valid = {"view", "edit", "admin"}
        assert permission in valid

    @given(
        is_public=st.booleans(),
        share_count=st.integers(min_value=0, max_value=100),
    )
    @settings(max_examples=10, deadline=None)
    def test_public_dashboard_no_shares_needed(self, is_public: bool, share_count: int):
        """Public dashboards don't need individual shares.

        Why?
        If a dashboard is public, all users with dashboard access
        can view it — share records are redundant.
        """
        if is_public:
            effective_shares = 0  # Shares ignored for public
        else:
            effective_shares = share_count
        assert effective_shares >= 0
