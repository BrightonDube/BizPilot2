"""
Unit tests for pricing consistency verification.

This test suite verifies that:
1. Shared pricing configuration is consistent and correct
2. Pricing utility functions work correctly
3. Backend pricing matches requirements exactly
4. All tiers have correct pricing structure

Requirements: 1.2, 1.3
"""

import sys
import os

# Add shared module to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'shared'))
from pricing_config import SUBSCRIPTION_TIERS, PricingUtils


class TestPricingConsistencyUnit:
    """Unit tests for pricing consistency."""

    def test_subscription_tiers_structure(self):
        """Test that subscription tiers have correct structure."""
        assert len(SUBSCRIPTION_TIERS) == 5, "Should have exactly 5 subscription tiers"
        
        # Verify all required tiers exist
        tier_names = [tier.name for tier in SUBSCRIPTION_TIERS]
        expected_tiers = ["pilot_solo", "pilot_lite", "pilot_core", "pilot_pro", "enterprise"]
        
        for expected_tier in expected_tiers:
            assert expected_tier in tier_names, f"Missing tier: {expected_tier}"

    def test_pilot_solo_pricing(self):
        """Test Pilot Solo (Free) tier pricing."""
        pilot_solo = next(tier for tier in SUBSCRIPTION_TIERS if tier.name == "pilot_solo")
        
        assert pilot_solo.price_monthly_cents == 0, "Pilot Solo should be free (monthly)"
        assert pilot_solo.price_yearly_cents == 0, "Pilot Solo should be free (yearly)"
        assert pilot_solo.currency == "ZAR", "Should use ZAR currency"
        assert pilot_solo.is_default is True, "Should be the default tier"
        assert pilot_solo.is_custom_pricing is False, "Should not have custom pricing"
        assert pilot_solo.display_name == "Pilot Solo", "Should have correct display name"

    def test_pilot_lite_pricing(self):
        """Test Pilot Lite tier pricing matches requirements (R199)."""
        pilot_lite = next(tier for tier in SUBSCRIPTION_TIERS if tier.name == "pilot_lite")
        
        assert pilot_lite.price_monthly_cents == 19900, "Pilot Lite should be R199 monthly (19900 cents)"
        assert pilot_lite.price_yearly_cents == 191040, "Pilot Lite yearly should have 20% discount"
        assert pilot_lite.currency == "ZAR", "Should use ZAR currency"
        assert pilot_lite.is_custom_pricing is False, "Should not have custom pricing"
        assert pilot_lite.display_name == "Pilot Lite", "Should have correct display name"
        
        # Verify 20% yearly discount
        monthly_total = pilot_lite.price_monthly_cents * 12
        yearly_savings = ((monthly_total - pilot_lite.price_yearly_cents) / monthly_total) * 100
        assert abs(yearly_savings - 20.0) < 0.1, "Should have 20% yearly discount"

    def test_pilot_core_pricing(self):
        """Test Pilot Core tier pricing matches requirements (R799)."""
        pilot_core = next(tier for tier in SUBSCRIPTION_TIERS if tier.name == "pilot_core")
        
        assert pilot_core.price_monthly_cents == 79900, "Pilot Core should be R799 monthly (79900 cents)"
        assert pilot_core.price_yearly_cents == 767040, "Pilot Core yearly should have 20% discount"
        assert pilot_core.currency == "ZAR", "Should use ZAR currency"
        assert pilot_core.is_custom_pricing is False, "Should not have custom pricing"
        assert pilot_core.display_name == "Pilot Core", "Should have correct display name"
        
        # Verify 20% yearly discount
        monthly_total = pilot_core.price_monthly_cents * 12
        yearly_savings = ((monthly_total - pilot_core.price_yearly_cents) / monthly_total) * 100
        assert abs(yearly_savings - 20.0) < 0.1, "Should have 20% yearly discount"

    def test_pilot_pro_pricing(self):
        """Test Pilot Pro tier pricing matches requirements (R1499)."""
        pilot_pro = next(tier for tier in SUBSCRIPTION_TIERS if tier.name == "pilot_pro")
        
        assert pilot_pro.price_monthly_cents == 149900, "Pilot Pro should be R1499 monthly (149900 cents)"
        assert pilot_pro.price_yearly_cents == 1439040, "Pilot Pro yearly should have 20% discount"
        assert pilot_pro.currency == "ZAR", "Should use ZAR currency"
        assert pilot_pro.is_custom_pricing is False, "Should not have custom pricing"
        assert pilot_pro.display_name == "Pilot Pro", "Should have correct display name"
        
        # Verify 20% yearly discount
        monthly_total = pilot_pro.price_monthly_cents * 12
        yearly_savings = ((monthly_total - pilot_pro.price_yearly_cents) / monthly_total) * 100
        assert abs(yearly_savings - 20.0) < 0.1, "Should have 20% yearly discount"

    def test_enterprise_pricing(self):
        """Test Enterprise tier has custom pricing."""
        enterprise = next(tier for tier in SUBSCRIPTION_TIERS if tier.name == "enterprise")
        
        assert enterprise.price_monthly_cents == -1, "Enterprise should have custom pricing indicator (-1)"
        assert enterprise.price_yearly_cents == -1, "Enterprise should have custom pricing indicator (-1)"
        assert enterprise.currency == "ZAR", "Should use ZAR currency"
        assert enterprise.is_custom_pricing is True, "Should have custom pricing flag"
        assert enterprise.display_name == "Enterprise", "Should have correct display name"

    def test_tier_sort_order(self):
        """Test that tiers are in correct sort order."""
        sorted_tiers = sorted(SUBSCRIPTION_TIERS, key=lambda t: t.sort_order)
        expected_order = ["pilot_solo", "pilot_lite", "pilot_core", "pilot_pro", "enterprise"]
        actual_order = [tier.name for tier in sorted_tiers]
        
        assert actual_order == expected_order, f"Tier order should be {expected_order}, got {actual_order}"

    def test_feature_flags_progression(self):
        """Test that feature flags progress logically across tiers."""
        pilot_solo = next(t for t in SUBSCRIPTION_TIERS if t.name == "pilot_solo")
        pilot_lite = next(t for t in SUBSCRIPTION_TIERS if t.name == "pilot_lite")
        pilot_core = next(t for t in SUBSCRIPTION_TIERS if t.name == "pilot_core")
        pilot_pro = next(t for t in SUBSCRIPTION_TIERS if t.name == "pilot_pro")
        enterprise = next(t for t in SUBSCRIPTION_TIERS if t.name == "enterprise")

        # Basic reports should be available from Pilot Lite onwards
        assert pilot_solo.feature_flags["basic_reports"] is False
        assert pilot_lite.feature_flags["basic_reports"] is True
        assert pilot_core.feature_flags["basic_reports"] is True
        assert pilot_pro.feature_flags["basic_reports"] is True
        assert enterprise.feature_flags["basic_reports"] is True

        # Inventory tracking should be available from Pilot Core onwards
        assert pilot_solo.feature_flags["inventory_tracking"] is False
        assert pilot_lite.feature_flags["inventory_tracking"] is False
        assert pilot_core.feature_flags["inventory_tracking"] is True
        assert pilot_pro.feature_flags["inventory_tracking"] is True
        assert enterprise.feature_flags["inventory_tracking"] is True

        # AI insights should only be available in Pilot Pro and Enterprise
        assert pilot_solo.feature_flags["ai_insights"] is False
        assert pilot_lite.feature_flags["ai_insights"] is False
        assert pilot_core.feature_flags["ai_insights"] is False
        assert pilot_pro.feature_flags["ai_insights"] is True
        assert enterprise.feature_flags["ai_insights"] is True

        # Enterprise-only features
        assert enterprise.feature_flags["white_labeling"] is True
        assert enterprise.feature_flags["custom_development"] is True
        assert enterprise.feature_flags["dedicated_account_manager"] is True

    def test_pricing_utility_format_price(self):
        """Test price formatting utility function."""
        # Test free pricing
        assert PricingUtils.format_price(0) == "Free"
        
        # Test custom pricing
        assert PricingUtils.format_price(-1) == "Contact Sales"
        
        # Test ZAR formatting
        assert PricingUtils.format_price(19900, "ZAR") == "R199"
        assert PricingUtils.format_price(79900, "ZAR") == "R799"
        assert PricingUtils.format_price(149900, "ZAR") == "R1,499"
        
        # Test USD formatting
        assert PricingUtils.format_price(19900, "USD") == "$199"
        
        # Test EUR formatting
        assert PricingUtils.format_price(19900, "EUR") == "€199"

    def test_pricing_utility_yearly_savings(self):
        """Test yearly savings calculation."""
        # Test Pilot Lite savings (20%)
        monthly_price = 19900  # R199
        yearly_price = 191040  # 20% discount
        savings = PricingUtils.calculate_yearly_savings(monthly_price, yearly_price)
        assert savings == 20, "Should calculate 20% savings"
        
        # Test zero prices
        assert PricingUtils.calculate_yearly_savings(0, 0) == 0
        
        # Test custom pricing
        assert PricingUtils.calculate_yearly_savings(-1, -1) == 0

    def test_pricing_utility_get_price_for_cycle(self):
        """Test getting price for specific billing cycle."""
        pilot_lite = next(t for t in SUBSCRIPTION_TIERS if t.name == "pilot_lite")
        
        monthly_price = PricingUtils.get_price_for_cycle(pilot_lite, "monthly")
        yearly_price = PricingUtils.get_price_for_cycle(pilot_lite, "yearly")
        
        assert monthly_price == 19900
        assert yearly_price == 191040

    def test_pricing_utility_format_price_with_cycle(self):
        """Test formatting price with billing cycle."""
        pilot_lite = next(t for t in SUBSCRIPTION_TIERS if t.name == "pilot_lite")
        enterprise = next(t for t in SUBSCRIPTION_TIERS if t.name == "enterprise")
        pilot_solo = next(t for t in SUBSCRIPTION_TIERS if t.name == "pilot_solo")
        
        # Test regular pricing
        assert PricingUtils.format_price_with_cycle(pilot_lite, "monthly") == "R199/mo"
        assert PricingUtils.format_price_with_cycle(pilot_lite, "yearly") == "R1,910/yr"
        
        # Test free pricing
        assert PricingUtils.format_price_with_cycle(pilot_solo, "monthly") == "Free"
        assert PricingUtils.format_price_with_cycle(pilot_solo, "yearly") == "Free"
        
        # Test custom pricing
        assert PricingUtils.format_price_with_cycle(enterprise, "monthly") == "Contact Sales"
        assert PricingUtils.format_price_with_cycle(enterprise, "yearly") == "Contact Sales"

    def test_pricing_utility_get_tier_by_id(self):
        """Test getting tier by ID."""
        pilot_lite = PricingUtils.get_tier_by_id("pilot_lite")
        assert pilot_lite is not None
        assert pilot_lite.name == "pilot_lite"
        assert pilot_lite.price_monthly_cents == 19900
        
        # Test non-existent tier
        non_existent = PricingUtils.get_tier_by_id("non_existent")
        assert non_existent is None

    def test_pricing_utility_get_default_tier(self):
        """Test getting default tier."""
        default_tier = PricingUtils.get_default_tier()
        assert default_tier is not None
        assert default_tier.is_default is True
        assert default_tier.name == "pilot_solo"

    def test_pricing_utility_has_custom_pricing(self):
        """Test custom pricing detection."""
        enterprise = next(t for t in SUBSCRIPTION_TIERS if t.name == "enterprise")
        pilot_lite = next(t for t in SUBSCRIPTION_TIERS if t.name == "pilot_lite")
        
        assert PricingUtils.has_custom_pricing(enterprise) is True
        assert PricingUtils.has_custom_pricing(pilot_lite) is False

    def test_pricing_utility_get_active_tiers(self):
        """Test getting active tiers."""
        active_tiers = PricingUtils.get_active_tiers()
        
        # All tiers should be active
        assert len(active_tiers) == 5
        
        # Should be sorted by sort_order
        for i in range(len(active_tiers) - 1):
            assert active_tiers[i].sort_order <= active_tiers[i + 1].sort_order

    def test_currency_consistency(self):
        """Test that all tiers use ZAR currency."""
        for tier in SUBSCRIPTION_TIERS:
            assert tier.currency == "ZAR", f"Tier {tier.name} should use ZAR currency"

    def test_feature_limits_consistency(self):
        """Test that feature limits are consistent and logical."""
        pilot_solo = next(t for t in SUBSCRIPTION_TIERS if t.name == "pilot_solo")
        pilot_lite = next(t for t in SUBSCRIPTION_TIERS if t.name == "pilot_lite")
        pilot_core = next(t for t in SUBSCRIPTION_TIERS if t.name == "pilot_core")
        pilot_pro = next(t for t in SUBSCRIPTION_TIERS if t.name == "pilot_pro")
        enterprise = next(t for t in SUBSCRIPTION_TIERS if t.name == "enterprise")

        # User limits should increase or stay unlimited (-1)
        assert pilot_solo.features["max_users"] == 1
        assert pilot_lite.features["max_users"] == 3
        assert pilot_core.features["max_users"] == -1  # Unlimited
        assert pilot_pro.features["max_users"] == -1  # Unlimited
        assert enterprise.features["max_users"] == -1  # Unlimited

        # Terminal limits should increase
        assert pilot_solo.features["max_terminals"] == 1
        assert pilot_lite.features["max_terminals"] == 1
        assert pilot_core.features["max_terminals"] == 2
        assert pilot_pro.features["max_terminals"] == -1  # Unlimited
        assert enterprise.features["max_terminals"] == -1  # Unlimited

    def test_pricing_amounts_match_requirements(self):
        """Test that pricing amounts exactly match the requirements."""
        # Requirements specify: Pilot Solo (R0), Pilot Lite (R199), Pilot Core (R799), Pilot Pro (R1499), Enterprise (Custom)
        
        pilot_solo = next(t for t in SUBSCRIPTION_TIERS if t.name == "pilot_solo")
        pilot_lite = next(t for t in SUBSCRIPTION_TIERS if t.name == "pilot_lite")
        pilot_core = next(t for t in SUBSCRIPTION_TIERS if t.name == "pilot_core")
        pilot_pro = next(t for t in SUBSCRIPTION_TIERS if t.name == "pilot_pro")
        enterprise = next(t for t in SUBSCRIPTION_TIERS if t.name == "enterprise")

        # Test monthly prices in cents
        assert pilot_solo.price_monthly_cents == 0  # R0
        assert pilot_lite.price_monthly_cents == 19900  # R199
        assert pilot_core.price_monthly_cents == 79900  # R799
        assert pilot_pro.price_monthly_cents == 149900  # R1499
        assert enterprise.price_monthly_cents == -1  # Custom pricing

        # Test yearly prices have 20% discount (except free and custom)
        assert pilot_solo.price_yearly_cents == 0  # Free
        assert pilot_lite.price_yearly_cents == 191040  # R199 * 12 * 0.8
        assert pilot_core.price_yearly_cents == 767040  # R799 * 12 * 0.8
        assert pilot_pro.price_yearly_cents == 1439040  # R1499 * 12 * 0.8
        assert enterprise.price_yearly_cents == -1  # Custom pricing

    def test_backend_pricing_consistency_with_shared_config(self):
        """Test that backend can import and use shared pricing configuration."""
        # This test verifies that the shared configuration is accessible to the backend
        # and that the data structure is compatible
        
        # Test that we can import the configuration
        assert SUBSCRIPTION_TIERS is not None
        assert len(SUBSCRIPTION_TIERS) > 0
        
        # Test that each tier has all required fields for backend compatibility
        for tier in SUBSCRIPTION_TIERS:
            # Required fields for backend SubscriptionTier model
            assert hasattr(tier, 'name')
            assert hasattr(tier, 'display_name')
            assert hasattr(tier, 'description')
            assert hasattr(tier, 'price_monthly_cents')
            assert hasattr(tier, 'price_yearly_cents')
            assert hasattr(tier, 'currency')
            assert hasattr(tier, 'sort_order')
            assert hasattr(tier, 'is_default')
            assert hasattr(tier, 'is_active')
            assert hasattr(tier, 'is_custom_pricing')
            assert hasattr(tier, 'features')
            assert hasattr(tier, 'feature_flags')
            
            # Test data types
            assert isinstance(tier.name, str)
            assert isinstance(tier.display_name, str)
            assert isinstance(tier.description, str)
            assert isinstance(tier.price_monthly_cents, int)
            assert isinstance(tier.price_yearly_cents, int)
            assert isinstance(tier.currency, str)
            assert isinstance(tier.sort_order, int)
            assert isinstance(tier.is_default, bool)
            assert isinstance(tier.is_active, bool)
            assert isinstance(tier.is_custom_pricing, bool)
            assert isinstance(tier.features, dict)
            assert isinstance(tier.feature_flags, dict)

    def test_payment_processing_amounts(self):
        """Test that payment processing would use correct amounts."""
        # This simulates what payment processing should use
        
        pilot_core = next(t for t in SUBSCRIPTION_TIERS if t.name == "pilot_core")
        
        # Monthly billing
        monthly_amount = pilot_core.price_monthly_cents
        assert monthly_amount == 79900, "Payment processing should use 79900 cents for monthly Pilot Core"
        
        # Yearly billing
        yearly_amount = pilot_core.price_yearly_cents
        assert yearly_amount == 767040, "Payment processing should use 767040 cents for yearly Pilot Core"
        
        # Verify amounts are in cents (no floating point issues)
        assert monthly_amount % 1 == 0, "Monthly amount should be whole number (cents)"
        assert yearly_amount % 1 == 0, "Yearly amount should be whole number (cents)"

    def test_tier_upgrade_downgrade_logic(self):
        """Test logic for tier upgrades and downgrades."""
        tiers_by_price = []
        
        for tier in SUBSCRIPTION_TIERS:
            if tier.price_monthly_cents >= 0:  # Exclude custom pricing
                tiers_by_price.append((tier.name, tier.price_monthly_cents))
        
        # Sort by price
        tiers_by_price.sort(key=lambda x: x[1])
        
        # Verify upgrade path makes sense
        expected_upgrade_path = [
            ("pilot_solo", 0),
            ("pilot_lite", 19900),
            ("pilot_core", 79900),
            ("pilot_pro", 149900)
        ]
        
        assert tiers_by_price == expected_upgrade_path, "Tier upgrade path should be logical by price"

    def test_enterprise_tier_features(self):
        """Test that Enterprise tier has all premium features."""
        enterprise = next(t for t in SUBSCRIPTION_TIERS if t.name == "enterprise")
        
        # Enterprise should have all standard features enabled
        standard_features = [
            "basic_reports", "inventory_tracking", "cost_calculations",
            "email_support", "export_reports", "ai_insights", "custom_categories",
            "priority_support", "multi_location", "api_access", "team_collaboration"
        ]
        
        for feature in standard_features:
            assert enterprise.feature_flags[feature] is True, f"Enterprise should have {feature} enabled"
        
        # Enterprise should have exclusive features
        enterprise_features = [
            "white_labeling", "custom_development", "dedicated_account_manager",
            "sla_guarantee", "advanced_security", "custom_workflows"
        ]
        
        for feature in enterprise_features:
            assert enterprise.feature_flags[feature] is True, f"Enterprise should have {feature} enabled"
            
            # Verify other tiers don't have these features
            for other_tier in SUBSCRIPTION_TIERS:
                if other_tier.name != "enterprise":
                    assert feature not in other_tier.feature_flags or other_tier.feature_flags[feature] is False, \
                        f"Only Enterprise should have {feature}"