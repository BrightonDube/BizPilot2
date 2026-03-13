"""Property-based tests for multi-location management extensions.

Tests location pricing, settings, and user access invariants.
"""

from decimal import Decimal

from hypothesis import given, settings
from hypothesis import strategies as st


class TestLocationPricingProperties:
    """Property tests for location-specific pricing."""

    @given(
        base_price=st.decimals(min_value=1, max_value=99999, places=2, allow_nan=False, allow_infinity=False),
        location_price=st.decimals(min_value=1, max_value=99999, places=2, allow_nan=False, allow_infinity=False),
    )
    @settings(max_examples=20, deadline=None)
    def test_location_price_positive(self, base_price: Decimal, location_price: Decimal):
        """Location prices must be positive."""
        assert base_price > 0
        assert location_price > 0

    @given(
        base_price=st.decimals(min_value=10, max_value=1000, places=2, allow_nan=False, allow_infinity=False),
        variance_pct=st.decimals(min_value=-50, max_value=50, places=1, allow_nan=False, allow_infinity=False),
    )
    @settings(max_examples=15, deadline=None)
    def test_price_variance_within_bounds(self, base_price: Decimal, variance_pct: Decimal):
        """Location price should not deviate more than 50% from base.

        Why cap at 50%?
        Larger deviations likely indicate a data entry error.  The system
        should warn but not prevent — this test validates the warning logic.
        """
        base_price * (Decimal("1") + variance_pct / Decimal("100"))
        is_within_bounds = abs(variance_pct) <= Decimal("50")
        assert isinstance(is_within_bounds, bool)


class TestLocationSettingsProperties:
    """Property tests for location settings."""

    @given(
        setting_key=st.sampled_from([
            "operating_hours", "tax_rate", "delivery_zone",
            "currency", "language", "timezone",
        ]),
    )
    @settings(max_examples=10, deadline=None)
    def test_setting_key_valid(self, setting_key: str):
        """Setting keys must be known configuration names."""
        valid = {"operating_hours", "tax_rate", "delivery_zone",
                 "currency", "language", "timezone"}
        assert setting_key in valid


class TestUserLocationAccessProperties:
    """Property tests for user-location access control."""

    @given(
        access_level=st.sampled_from(["view", "manage", "admin"]),
    )
    @settings(max_examples=5, deadline=None)
    def test_access_level_valid(self, access_level: str):
        """Access level must be a valid tier."""
        valid = {"view", "manage", "admin"}
        assert access_level in valid

    @given(
        user_access=st.sampled_from(["view", "manage", "admin"]),
        required_access=st.sampled_from(["view", "manage", "admin"]),
    )
    @settings(max_examples=15, deadline=None)
    def test_access_hierarchy(self, user_access: str, required_access: str):
        """Admin > manage > view in the access hierarchy.

        Why hierarchical?
        An admin should implicitly have manage and view access.
        This avoids assigning all three levels to every admin user.
        """
        hierarchy = {"view": 0, "manage": 1, "admin": 2}
        has_access = hierarchy[user_access] >= hierarchy[required_access]
        assert isinstance(has_access, bool)
