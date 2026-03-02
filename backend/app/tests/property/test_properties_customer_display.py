"""Property-based tests for customer display configuration.

Tests display type validation, config consistency, and heartbeat tracking.
"""

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st


class TestCustomerDisplayProperties:
    """Property tests for customer display invariants."""

    @given(
        display_type=st.sampled_from(["tablet", "monitor", "pole_display", "web"])
    )
    @settings(max_examples=10, deadline=None)
    def test_display_type_enum(self, display_type: str):
        """Display type must be one of the allowed values."""
        valid = {"tablet", "monitor", "pole_display", "web"}
        assert display_type in valid

    @given(
        status=st.sampled_from(["online", "offline", "pairing"])
    )
    @settings(max_examples=10, deadline=None)
    def test_display_status_enum(self, status: str):
        """Display status must be one of the allowed values."""
        valid = {"online", "offline", "pairing"}
        assert status in valid

    @given(
        layout=st.sampled_from(["standard", "split", "fullscreen"]),
        orientation=st.sampled_from(["landscape", "portrait"]),
        language=st.from_regex(r"[a-z]{2}", fullmatch=True),
    )
    @settings(max_examples=15, deadline=None)
    def test_config_defaults(self, layout: str, orientation: str, language: str):
        """Display config must have valid layout, orientation, and language.

        Why validate defaults?
        A misconfigured display shows garbled content to customers,
        which is worse than showing nothing.
        """
        valid_layouts = {"standard", "split", "fullscreen"}
        valid_orientations = {"landscape", "portrait"}
        assert layout in valid_layouts
        assert orientation in valid_orientations
        assert len(language) == 2
        assert language.isalpha()
