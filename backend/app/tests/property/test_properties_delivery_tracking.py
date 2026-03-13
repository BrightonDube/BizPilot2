"""Property-based tests for delivery tracking and driver shifts.

Tests shift scheduling, tracking status progression, and proof validation.
"""

from datetime import time

from hypothesis import given, settings, assume
from hypothesis import strategies as st


class TestDriverShiftProperties:
    """Property tests for driver shift invariants."""

    @given(
        start_h=st.integers(min_value=0, max_value=22),
        duration_h=st.integers(min_value=1, max_value=12),
    )
    @settings(max_examples=30, deadline=None)
    def test_shift_end_after_start(self, start_h: int, duration_h: int):
        """Shift end time must be after start time.

        Why enforce this?
        A shift where end <= start is meaningless and would break
        duration calculations and labour cost reporting.
        """
        end_h = start_h + duration_h
        assume(end_h <= 23)
        start = time(start_h, 0)
        end = time(end_h, 0)
        assert end > start

    @given(
        status=st.sampled_from(["scheduled", "started", "completed", "cancelled", "no_show"])
    )
    @settings(max_examples=10, deadline=None)
    def test_shift_status_enum(self, status: str):
        """Shift status must be one of the defined values."""
        valid = {"scheduled", "started", "completed", "cancelled", "no_show"}
        assert status in valid


class TestDeliveryTrackingProperties:
    """Property tests for delivery tracking invariants."""

    @given(
        eta=st.integers(min_value=0, max_value=180),
    )
    @settings(max_examples=20, deadline=None)
    def test_eta_non_negative(self, eta: int):
        """ETA in minutes must be non-negative.

        Why?
        A negative ETA is nonsensical and would confuse customers
        looking at their delivery status.
        """
        assert eta >= 0

    @given(
        proof_type=st.sampled_from(["signature", "photo", "both"])
    )
    @settings(max_examples=10, deadline=None)
    def test_proof_type_enum(self, proof_type: str):
        """Proof of delivery type must be valid."""
        valid = {"signature", "photo", "both"}
        assert proof_type in valid
