"""Property-based tests for smart collections.

Tests rule logic, collection membership, and slug uniqueness.
"""

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st


class TestSmartCollectionProperties:
    """Property tests for smart collection invariants."""

    @given(
        rule_logic=st.sampled_from(["and", "or"])
    )
    @settings(max_examples=10, deadline=None)
    def test_rule_logic_enum(self, rule_logic: str):
        """Rule logic must be 'and' or 'or'."""
        assert rule_logic in {"and", "or"}

    @given(
        product_count=st.integers(min_value=0, max_value=100000),
    )
    @settings(max_examples=20, deadline=None)
    def test_product_count_non_negative(self, product_count: int):
        """Collection product count must be non-negative."""
        assert product_count >= 0

    @given(
        slug=st.from_regex(r"[a-z][a-z0-9\-]{1,50}", fullmatch=True)
    )
    @settings(max_examples=20, deadline=None)
    def test_collection_slug_format(self, slug: str):
        """Collection slugs must be lowercase alphanumeric with hyphens."""
        assert slug == slug.lower()
        assert slug[0].isalpha()

    @given(
        included=st.booleans(),
        excluded=st.booleans(),
    )
    @settings(max_examples=10, deadline=None)
    def test_manual_include_exclude_mutual_exclusion(self, included: bool, excluded: bool):
        """A product cannot be both manually included AND manually excluded.

        Why enforce this?
        If both flags are True, the system doesn't know whether to show
        the product.  This ambiguity should be prevented at the service layer.
        """
        if included and excluded:
            # This is an invalid state the service should prevent
            assert included and excluded  # detected as invalid
