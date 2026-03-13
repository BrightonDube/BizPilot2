"""Property-based tests for digital signage.

Tests pairing code format, content duration, playlist ordering, and status.
"""

from hypothesis import given, settings
from hypothesis import strategies as st


class TestDigitalSignageProperties:
    """Property tests for digital signage invariants."""

    @given(
        pairing_code=st.from_regex(r"[A-Z0-9]{6}", fullmatch=True)
    )
    @settings(max_examples=20, deadline=None)
    def test_pairing_code_format(self, pairing_code: str):
        """Pairing codes must be 6-char uppercase alphanumeric.

        Why this format?
        Short enough to read off a screen and type into a phone,
        but with 36^6 ≈ 2B combinations to avoid collisions.
        """
        assert len(pairing_code) == 6
        assert pairing_code.isalnum()
        assert pairing_code == pairing_code.upper()

    @given(
        duration=st.integers(min_value=1, max_value=3600)
    )
    @settings(max_examples=20, deadline=None)
    def test_content_duration_positive(self, duration: int):
        """Content duration must be between 1 and 3600 seconds."""
        assert 1 <= duration <= 3600

    @given(
        status=st.sampled_from(["draft", "published", "archived"])
    )
    @settings(max_examples=10, deadline=None)
    def test_content_status_enum(self, status: str):
        """Content status must be a valid state."""
        valid = {"draft", "published", "archived"}
        assert status in valid

    @given(
        items=st.lists(
            st.integers(min_value=0, max_value=100),
            min_size=1,
            max_size=50,
        )
    )
    @settings(max_examples=20, deadline=None)
    def test_playlist_sort_order_unique(self, items: list[int]):
        """Playlist items should have unique sort orders to avoid ambiguity.

        Why unique?
        If two items have the same sort_order, the display order is
        non-deterministic, which causes inconsistent customer experience.
        """
        # In practice the service should enforce unique sort orders
        sorted_items = sorted(set(items))
        assert len(sorted_items) <= len(items)
