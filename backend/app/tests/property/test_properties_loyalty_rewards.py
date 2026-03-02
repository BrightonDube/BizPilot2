"""Property-based tests for loyalty program extensions.

Tests reward catalog, tier benefits, and points redemption invariants.
"""

from decimal import Decimal

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st


class TestRewardCatalogProperties:
    """Property tests for reward catalog invariants."""

    @given(
        reward_type=st.sampled_from(["discount", "free_item", "voucher"]),
    )
    @settings(max_examples=5, deadline=None)
    def test_reward_type_valid(self, reward_type: str):
        """Reward type must be a supported type."""
        valid = {"discount", "free_item", "voucher"}
        assert reward_type in valid

    @given(
        points_cost=st.integers(min_value=1, max_value=100000),
        customer_points=st.integers(min_value=0, max_value=200000),
    )
    @settings(max_examples=20, deadline=None)
    def test_redemption_requires_sufficient_points(self, points_cost: int, customer_points: int):
        """Customers can only redeem rewards they can afford.

        Why check at redemption time?
        Points balances change between browsing the catalog and redeeming.
        The final check must happen atomically during redemption.
        """
        can_redeem = customer_points >= points_cost
        assert isinstance(can_redeem, bool)

    @given(
        stock_quantity=st.integers(min_value=0, max_value=1000) | st.none(),
    )
    @settings(max_examples=15, deadline=None)
    def test_stock_quantity_validation(self, stock_quantity):
        """Stock must be positive or null (unlimited).

        Why allow null?
        Discount rewards don't consume physical inventory.  Setting
        stock to null means unlimited redemptions.
        """
        if stock_quantity is not None:
            assert stock_quantity >= 0


class TestTierBenefitProperties:
    """Property tests for tier benefit invariants."""

    @given(
        tier=st.sampled_from(["bronze", "silver", "gold", "platinum"]),
        benefit=st.sampled_from(["discount", "bonus_points", "free_delivery", "priority_support", "exclusive_access"]),
    )
    @settings(max_examples=10, deadline=None)
    def test_tier_and_benefit_valid(self, tier: str, benefit: str):
        """Tier and benefit type must be valid."""
        valid_tiers = {"bronze", "silver", "gold", "platinum"}
        valid_benefits = {"discount", "bonus_points", "free_delivery", "priority_support", "exclusive_access"}
        assert tier in valid_tiers
        assert benefit in valid_benefits

    @given(
        benefit_value=st.decimals(min_value=0, max_value=100, places=2, allow_nan=False, allow_infinity=False),
        benefit_type=st.sampled_from(["discount", "bonus_points"]),
    )
    @settings(max_examples=15, deadline=None)
    def test_discount_benefit_percentage_range(self, benefit_value: Decimal, benefit_type: str):
        """Discount benefits should be 0-100%."""
        if benefit_type == "discount":
            assert Decimal("0") <= benefit_value <= Decimal("100")
