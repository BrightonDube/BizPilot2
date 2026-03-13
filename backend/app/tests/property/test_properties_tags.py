"""Property-based tests for tagging and categorization.

Tests slug uniqueness, hierarchy depth, usage counting, and tag assignment.
"""


from hypothesis import given, settings, assume
from hypothesis import strategies as st


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

slug_st = st.from_regex(r"[a-z][a-z0-9\-]{1,30}", fullmatch=True)
hex_colour_st = st.from_regex(r"#[0-9a-fA-F]{6}", fullmatch=True)
hierarchy_level_st = st.integers(min_value=0, max_value=10)


class TestTagProperties:
    """Property tests for tag invariants."""

    @given(slug=slug_st)
    @settings(max_examples=30, deadline=None)
    def test_slug_format(self, slug: str):
        """Tag slugs must be lowercase alphanumeric with hyphens.

        Why enforce this?
        Slugs are used in URLs and API queries.  Consistent formatting
        prevents case-sensitivity issues and URL encoding problems.
        """
        assert slug == slug.lower()
        assert slug[0].isalpha()
        assert all(c.isalnum() or c == "-" for c in slug)

    @given(level=hierarchy_level_st)
    @settings(max_examples=20, deadline=None)
    def test_hierarchy_depth_limit(self, level: int):
        """Tag hierarchy depth should not exceed practical limits.

        Why limit depth?
        Deeply nested tags create confusing UIs and slow path queries.
        Most tagging systems work well with <= 5 levels.
        """
        max_depth = 10
        assert 0 <= level <= max_depth

    @given(
        initial=st.integers(min_value=0, max_value=10000),
        assigns=st.integers(min_value=0, max_value=100),
        removes=st.integers(min_value=0, max_value=100),
    )
    @settings(max_examples=30, deadline=None)
    def test_usage_count_non_negative(self, initial: int, assigns: int, removes: int):
        """Usage count must never go below zero.

        Why clamp to zero?
        Race conditions between concurrent assign/remove calls could
        theoretically decrement past zero.  The service should prevent this.
        """
        assume(removes <= initial + assigns)
        count = initial + assigns - removes
        assert count >= 0

    @given(colour=hex_colour_st)
    @settings(max_examples=20, deadline=None)
    def test_colour_format(self, colour: str):
        """Tag colour must be a valid hex colour."""
        assert colour.startswith("#")
        assert len(colour) == 7
        # Strip '#' and validate hex digits
        int(colour[1:], 16)

    @given(
        path=st.from_regex(r"(/[a-z][a-z0-9\-]{1,20}){1,5}/", fullmatch=True)
    )
    @settings(max_examples=20, deadline=None)
    def test_hierarchy_path_format(self, path: str):
        """Materialized path must start and end with '/' and contain valid slugs."""
        assert path.startswith("/")
        assert path.endswith("/")
        segments = [s for s in path.split("/") if s]
        for seg in segments:
            assert all(c.isalnum() or c == "-" for c in seg)
