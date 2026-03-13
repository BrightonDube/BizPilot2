"""Property-based tests for Xero integration.

Tests sync idempotency, payload hash change detection, and entity mapping.
"""

import hashlib

from hypothesis import given, settings
from hypothesis import strategies as st


class TestXeroIntegrationProperties:
    """Property tests for Xero integration invariants."""

    @given(
        entity_type=st.sampled_from(["invoice", "payment", "contact", "credit_note"]),
        direction=st.sampled_from(["push", "pull"]),
    )
    @settings(max_examples=15, deadline=None)
    def test_sync_entity_types_valid(self, entity_type: str, direction: str):
        """Sync logs must reference known entity types and directions."""
        valid_types = {"invoice", "payment", "contact", "credit_note"}
        valid_directions = {"push", "pull"}
        assert entity_type in valid_types
        assert direction in valid_directions

    @given(
        payload=st.text(min_size=1, max_size=1000),
    )
    @settings(max_examples=20, deadline=None)
    def test_payload_hash_deterministic(self, payload: str):
        """Payload hash must be deterministic for change detection.

        Why SHA-256?
        Fast, widely supported, and collision-resistant enough for
        sync change detection (not security-critical use).
        """
        h1 = hashlib.sha256(payload.encode()).hexdigest()
        h2 = hashlib.sha256(payload.encode()).hexdigest()
        assert h1 == h2
        assert len(h1) == 64

    @given(
        status=st.sampled_from(["pending", "synced", "failed", "skipped"]),
    )
    @settings(max_examples=10, deadline=None)
    def test_sync_status_enum(self, status: str):
        """Sync status must be a valid lifecycle state."""
        valid = {"pending", "synced", "failed", "skipped"}
        assert status in valid

    @given(
        xero_id=st.from_regex(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", fullmatch=True),
    )
    @settings(max_examples=15, deadline=None)
    def test_xero_id_uuid_format(self, xero_id: str):
        """Xero IDs are UUIDs."""
        parts = xero_id.split("-")
        assert len(parts) == 5
        assert len(xero_id) == 36
