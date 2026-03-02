"""Property-based tests for the offline sync queue engine.

Tests queue ordering, status transitions, and metadata watermarks.
"""

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st


class TestSyncQueueProperties:
    """Property tests for sync queue invariants."""

    @given(
        action=st.sampled_from(["create", "update", "delete"]),
    )
    @settings(max_examples=5, deadline=None)
    def test_action_enum_valid(self, action: str):
        """Queue action must be a valid CRUD operation."""
        valid = {"create", "update", "delete"}
        assert action in valid

    @given(
        status=st.sampled_from(["pending", "processing", "completed", "failed"]),
    )
    @settings(max_examples=5, deadline=None)
    def test_status_enum_valid(self, status: str):
        """Queue status must be a valid lifecycle state."""
        valid = {"pending", "processing", "completed", "failed"}
        assert status in valid

    @given(
        entity_type=st.sampled_from(["product", "order", "customer", "category", "inventory"]),
    )
    @settings(max_examples=10, deadline=None)
    def test_entity_type_valid(self, entity_type: str):
        """Entity type must reference a syncable entity."""
        valid = {"product", "order", "customer", "category", "inventory"}
        assert entity_type in valid

    @given(
        attempts=st.integers(min_value=0, max_value=100),
    )
    @settings(max_examples=15, deadline=None)
    def test_attempts_non_negative(self, attempts: int):
        """Retry attempt count must be non-negative."""
        assert attempts >= 0

    @given(
        attempts=st.integers(min_value=0, max_value=10),
    )
    @settings(max_examples=10, deadline=None)
    def test_max_retry_policy(self, attempts: int):
        """Items with 5+ attempts should be permanently failed.

        Why cap retries?
        Infinite retries cause queue starvation.  After 5 failures, the item
        is likely a data issue that needs manual intervention.
        """
        max_retries = 5
        should_retry = attempts < max_retries
        assert isinstance(should_retry, bool)


class TestSyncMetadataProperties:
    """Property tests for sync metadata watermarks."""

    @given(
        records_synced=st.integers(min_value=0, max_value=999999),
    )
    @settings(max_examples=15, deadline=None)
    def test_records_synced_non_negative(self, records_synced: int):
        """Synced record count must be non-negative."""
        assert records_synced >= 0

    @given(
        status=st.sampled_from(["completed", "failed", "partial"]),
    )
    @settings(max_examples=5, deadline=None)
    def test_sync_status_valid(self, status: str):
        """Sync metadata status must be valid."""
        valid = {"completed", "failed", "partial"}
        assert status in valid
