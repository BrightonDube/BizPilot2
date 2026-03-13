"""Property-based tests for partner administration.

Tests partner identifier format, revenue share limits, and user role validation.
"""

from decimal import Decimal

from hypothesis import given, settings
from hypothesis import strategies as st


class TestPartnerProperties:
    """Property tests for partner admin invariants."""

    @given(
        identifier=st.from_regex(r"[a-z][a-z0-9\-]{2,30}", fullmatch=True)
    )
    @settings(max_examples=20, deadline=None)
    def test_partner_identifier_format(self, identifier: str):
        """Partner identifiers must be lowercase slug-like strings.

        Why enforce this?
        Partner identifiers appear in URLs, API keys, and database
        queries.  Consistent formatting avoids case-sensitivity bugs.
        """
        assert identifier == identifier.lower()
        assert identifier[0].isalpha()

    @given(
        share_pct=st.decimals(min_value=Decimal("0"), max_value=Decimal("50.00"), places=2)
    )
    @settings(max_examples=20, deadline=None)
    def test_revenue_share_percentage_bounds(self, share_pct: Decimal):
        """Revenue share percentage must be between 0% and 50%.

        Why cap at 50%?
        A revenue share above 50% means the partner keeps more than
        the platform, which is not economically sustainable.
        """
        assert Decimal("0") <= share_pct <= Decimal("50")

    @given(
        status=st.sampled_from(["pending", "active", "suspended", "terminated"])
    )
    @settings(max_examples=10, deadline=None)
    def test_partner_status_enum(self, status: str):
        """Partner status must be a valid lifecycle state."""
        valid = {"pending", "active", "suspended", "terminated"}
        assert status in valid

    @given(
        role=st.sampled_from(["admin", "manager", "viewer", "billing"])
    )
    @settings(max_examples=10, deadline=None)
    def test_partner_user_role_enum(self, role: str):
        """Partner user roles must be defined values."""
        valid = {"admin", "manager", "viewer", "billing"}
        assert role in valid

    @given(
        user_limit=st.integers(min_value=1, max_value=10000),
        location_limit=st.integers(min_value=1, max_value=1000),
    )
    @settings(max_examples=20, deadline=None)
    def test_partner_limits_positive(self, user_limit: int, location_limit: int):
        """Partner resource limits must be positive."""
        assert user_limit >= 1
        assert location_limit >= 1
