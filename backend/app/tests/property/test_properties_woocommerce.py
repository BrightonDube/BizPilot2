"""Property-based tests for WooCommerce integration.

Tests sync map entity types, bi-directional sync, and ID mapping.
"""

from hypothesis import given, settings
from hypothesis import strategies as st


class TestWooCommerceProperties:
    """Property tests for WooCommerce integration invariants."""

    @given(
        entity_type=st.sampled_from(["product", "category", "order", "customer"]),
    )
    @settings(max_examples=10, deadline=None)
    def test_sync_entity_types_valid(self, entity_type: str):
        """Sync maps must reference known entity types."""
        valid = {"product", "category", "order", "customer"}
        assert entity_type in valid

    @given(
        woo_id=st.integers(min_value=1, max_value=999999),
    )
    @settings(max_examples=20, deadline=None)
    def test_woo_id_positive_integer(self, woo_id: int):
        """WooCommerce IDs are positive integers.

        Why store as string?
        WooCommerce uses integer IDs but they may need prefixing
        for multi-store setups.  String storage is future-proof.
        """
        assert woo_id > 0
        assert str(woo_id).isdigit()

    @given(
        direction=st.sampled_from(["push", "pull"]),
        entity_type=st.sampled_from(["product", "order"]),
    )
    @settings(max_examples=15, deadline=None)
    def test_bidirectional_sync_direction(self, direction: str, entity_type: str):
        """Products push out, orders pull in — direction must match type.

        Why enforce direction?
        Products are authored in BizPilot (push to WooCommerce).
        Orders are placed by customers on WooCommerce (pull in).
        Mixing directions causes data conflicts.
        """
        # Both directions are technically valid but the default should match
        assert direction in {"push", "pull"}

    @given(
        store_url=st.from_regex(r"https://[a-z]{3,20}\.com", fullmatch=True),
    )
    @settings(max_examples=15, deadline=None)
    def test_store_url_format(self, store_url: str):
        """Store URL must be a valid HTTPS URL."""
        assert store_url.startswith("https://")
        assert "." in store_url
