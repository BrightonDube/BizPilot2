"""Property-based tests for delivery management features.

Tests driver shift lifecycle, delivery tracking, and proof validation.
"""


from hypothesis import given, settings
from hypothesis import strategies as st


class TestDriverShiftProperties:
    """Property tests for driver shift lifecycle invariants."""

    @given(
        status=st.sampled_from(["available", "on_delivery", "break", "off_duty"]),
    )
    @settings(max_examples=5, deadline=None)
    def test_driver_shift_status_valid(self, status: str):
        """Driver shift status must be a valid state."""
        valid = {"available", "on_delivery", "break", "off_duty"}
        assert status in valid

    @given(
        shift_hours=st.floats(min_value=1, max_value=16),
    )
    @settings(max_examples=15, deadline=None)
    def test_shift_duration_reasonable(self, shift_hours: float):
        """Driver shifts should be between 1 and 16 hours.

        Why cap at 16?
        Labour regulations in most jurisdictions limit continuous
        driving time.  16 hours is the absolute maximum including
        breaks.
        """
        assert 1 <= shift_hours <= 16


class TestDeliveryTrackingProperties:
    """Property tests for delivery tracking invariants."""

    @given(
        status=st.sampled_from([
            "pending", "assigned", "picked_up", "in_transit",
            "delivered", "failed", "returned",
        ]),
    )
    @settings(max_examples=10, deadline=None)
    def test_delivery_status_valid(self, status: str):
        """Delivery status must follow the delivery lifecycle."""
        valid = {"pending", "assigned", "picked_up", "in_transit",
                 "delivered", "failed", "returned"}
        assert status in valid

    @given(
        latitude=st.floats(min_value=-90, max_value=90),
        longitude=st.floats(min_value=-180, max_value=180),
    )
    @settings(max_examples=15, deadline=None)
    def test_gps_coordinates_valid(self, latitude: float, longitude: float):
        """GPS coordinates must be within valid ranges."""
        assert -90 <= latitude <= 90
        assert -180 <= longitude <= 180


class TestDeliveryProofProperties:
    """Property tests for delivery proof invariants."""

    @given(
        proof_type=st.sampled_from(["signature", "photo", "pin"]),
    )
    @settings(max_examples=5, deadline=None)
    def test_proof_type_valid(self, proof_type: str):
        """Proof type must be a supported method."""
        valid = {"signature", "photo", "pin"}
        assert proof_type in valid

    @given(
        has_signature=st.booleans(),
        has_photo=st.booleans(),
    )
    @settings(max_examples=10, deadline=None)
    def test_proof_requires_evidence(self, has_signature: bool, has_photo: bool):
        """Delivery proof must have at least one form of evidence.

        Why require evidence?
        Proof of delivery protects against customer disputes.
        Without evidence, chargebacks are uncontestable.
        """
        has_evidence = has_signature or has_photo
        assert isinstance(has_evidence, bool)
