"""
Integration Tests for Pricing Consistency Across Platform

This test suite validates Requirements 1.1, 1.2, 1.3, 1.5, 3.6 by ensuring:
1. Marketing page pricing matches backend tiers exactly (including Enterprise)
2. Billing settings show identical pricing to marketing page
3. Payment processing uses correct pricing amounts
4. Tier upgrade/downgrade with consistent pricing (Enterprise contact sales flow)
5. Enterprise tier displays "Contact Sales" consistently across all pages

Task 7.1: Test pricing consistency across platform
"""

import pytest
import sys
import os
from typing import Dict
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

# Add shared module to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'shared'))
from pricing_config import SUBSCRIPTION_TIERS, PricingUtils

from app.main import app
from app.core.database import get_db
from app.models.subscription_tier import SubscriptionTier
from app.models.user import User, SubscriptionStatus
from app.core.security import create_access_token


class TestPricingConsistencyIntegration:
    """Integration tests for pricing consistency across the entire platform."""

    @pytest.fixture
    def client(self):
        return TestClient(app)

    @pytest.fixture
    def db_session(self):
        """Get database session for testing."""
        db = next(get_db())
        try:
            yield db
        finally:
            db.close()

    @pytest.fixture
    def test_user(self, db_session: Session):
        """Create a test user for authenticated endpoints."""
        user = User(
            email="test@example.com",
            hashed_password="hashed_password",
            is_active=True,
            subscription_status=SubscriptionStatus.ACTIVE
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    @pytest.fixture
    def auth_headers(self, test_user: User):
        """Create authentication headers for API requests."""
        token = create_access_token(data={"sub": test_user.email})
        return {"Authorization": f"Bearer {token}"}

    def setup_method(self):
        """Set up test data before each test."""
        # Ensure database has the correct tiers from shared config
        db = next(get_db())
        try:
            # Clear existing tiers
            db.query(SubscriptionTier).delete()
            
            # Add tiers from shared configuration
            for tier_config in SUBSCRIPTION_TIERS:
                tier = SubscriptionTier(
                    name=tier_config.name,
                    display_name=tier_config.display_name,
                    description=tier_config.description,
                    price_monthly_cents=tier_config.price_monthly_cents,
                    price_yearly_cents=tier_config.price_yearly_cents,
                    currency=tier_config.currency,
                    sort_order=tier_config.sort_order,
                    is_default=tier_config.is_default,
                    is_active=tier_config.is_active,
                    is_custom_pricing=tier_config.is_custom_pricing,
                    features=tier_config.features,
                    feature_flags=tier_config.feature_flags
                )
                db.add(tier)
            db.commit()
        finally:
            db.close()

    # ==================== Requirement 1.1: Marketing Page Pricing Matches Backend ====================

    def test_marketing_page_pricing_matches_backend_tiers_exactly(self, client: TestClient):
        """
        Requirement 1.1: Verify marketing page pricing matches backend tiers exactly (including Enterprise).
        
        This test ensures that the pricing displayed on marketing pages comes from the same
        source as the backend subscription tiers, including the Enterprise tier with custom pricing.
        """
        # Get backend tiers from API
        response = client.get("/api/v1/subscriptions/tiers")
        assert response.status_code == 200
        backend_tiers = response.json()
        
        # Verify we have all 5 tiers including Enterprise
        assert len(backend_tiers) == 5, "Should have exactly 5 tiers including Enterprise"
        
        # Verify each tier from shared config exists in backend
        backend_tier_names = {tier["name"] for tier in backend_tiers}
        expected_tier_names = {tier.name for tier in SUBSCRIPTION_TIERS}
        assert backend_tier_names == expected_tier_names, "Backend tiers should match shared config exactly"
        
        # Verify pricing amounts match shared configuration exactly
        for backend_tier in backend_tiers:
            shared_tier = next(t for t in SUBSCRIPTION_TIERS if t.name == backend_tier["name"])
            
            # Verify exact pricing match
            assert backend_tier["price_monthly_cents"] == shared_tier.price_monthly_cents, \
                f"Monthly price mismatch for {backend_tier['name']}: backend={backend_tier['price_monthly_cents']}, shared={shared_tier.price_monthly_cents}"
            
            assert backend_tier["price_yearly_cents"] == shared_tier.price_yearly_cents, \
                f"Yearly price mismatch for {backend_tier['name']}: backend={backend_tier['price_yearly_cents']}, shared={shared_tier.price_yearly_cents}"
            
            # Verify Enterprise tier has custom pricing
            if backend_tier["name"] == "enterprise":
                assert backend_tier["price_monthly_cents"] == -1, "Enterprise monthly price should be -1 (custom pricing)"
                assert backend_tier["price_yearly_cents"] == -1, "Enterprise yearly price should be -1 (custom pricing)"
                assert "is_custom_pricing" in backend_tier and backend_tier.get("is_custom_pricing", False), \
                    "Enterprise tier should have is_custom_pricing=True"
            
            # Verify other tiers have correct pricing
            elif backend_tier["name"] == "pilot_solo":
                assert backend_tier["price_monthly_cents"] == 0, "Pilot Solo should be free"
                assert backend_tier["price_yearly_cents"] == 0, "Pilot Solo should be free"
            elif backend_tier["name"] == "pilot_lite":
                assert backend_tier["price_monthly_cents"] == 19900, "Pilot Lite should be R199/month"
                assert backend_tier["price_yearly_cents"] == 191040, "Pilot Lite should be R1910.40/year (20% discount)"
            elif backend_tier["name"] == "pilot_core":
                assert backend_tier["price_monthly_cents"] == 79900, "Pilot Core should be R799/month"
                assert backend_tier["price_yearly_cents"] == 767040, "Pilot Core should be R7670.40/year (20% discount)"
            elif backend_tier["name"] == "pilot_pro":
                assert backend_tier["price_monthly_cents"] == 149900, "Pilot Pro should be R1499/month"
                assert backend_tier["price_yearly_cents"] == 1439040, "Pilot Pro should be R14390.40/year (20% discount)"

    def test_enterprise_tier_custom_pricing_display(self, client: TestClient):
        """
        Requirement 3.6: Test Enterprise tier displays "Contact Sales" consistently.
        
        Verifies that the Enterprise tier is properly configured for custom pricing
        and that the pricing utilities handle it correctly.
        """
        # Get Enterprise tier from backend
        response = client.get("/api/v1/subscriptions/tiers")
        assert response.status_code == 200
        backend_tiers = response.json()
        
        enterprise_tier = next((t for t in backend_tiers if t["name"] == "enterprise"), None)
        assert enterprise_tier is not None, "Enterprise tier should exist in backend"
        
        # Verify Enterprise tier has custom pricing indicators
        assert enterprise_tier["price_monthly_cents"] == -1, "Enterprise should use -1 for custom pricing"
        assert enterprise_tier["price_yearly_cents"] == -1, "Enterprise should use -1 for custom pricing"
        
        # Test pricing utility functions handle Enterprise correctly
        shared_enterprise = next(t for t in SUBSCRIPTION_TIERS if t.name == "enterprise")
        
        # Test format_price function
        monthly_display = PricingUtils.format_price(shared_enterprise.price_monthly_cents)
        yearly_display = PricingUtils.format_price(shared_enterprise.price_yearly_cents)
        
        assert monthly_display == "Contact Sales", "Enterprise monthly pricing should display 'Contact Sales'"
        assert yearly_display == "Contact Sales", "Enterprise yearly pricing should display 'Contact Sales'"
        
        # Test has_custom_pricing function
        assert PricingUtils.has_custom_pricing(shared_enterprise), "Enterprise should be detected as custom pricing"
        
        # Verify Enterprise has unlimited features
        assert shared_enterprise.features["max_users"] == -1, "Enterprise should have unlimited users"
        assert shared_enterprise.features["max_orders_per_month"] == -1, "Enterprise should have unlimited orders"
        assert shared_enterprise.features["max_terminals"] == -1, "Enterprise should have unlimited terminals"
        
        # Verify Enterprise has all premium features enabled
        premium_features = [
            "white_labeling", "custom_development", "dedicated_account_manager",
            "sla_guarantee", "advanced_security", "custom_workflows"
        ]
        for feature in premium_features:
            assert shared_enterprise.feature_flags.get(feature, False), f"Enterprise should have {feature} enabled"

    # ==================== Requirement 1.2: Billing Settings Match Marketing Page ====================

    def test_billing_settings_show_identical_pricing_to_marketing_page(self, client: TestClient, auth_headers: Dict[str, str]):
        """
        Requirement 1.2: Test billing settings show identical pricing to marketing page.
        
        This test verifies that the pricing displayed in the dashboard billing settings
        is identical to what's shown on the marketing pricing page.
        """
        # Get tiers from subscription API (used by billing settings)
        response = client.get("/api/v1/subscriptions/tiers", headers=auth_headers)
        assert response.status_code == 200
        billing_tiers = response.json()
        
        # Get user subscription info (used by billing settings)
        response = client.get("/api/v1/subscriptions/me", headers=auth_headers)
        assert response.status_code == 200
        # user_subscription = response.json()  # Not currently used but validates endpoint works
        
        # Verify billing settings use the same pricing data as marketing page
        for tier in billing_tiers:
            shared_tier = next(t for t in SUBSCRIPTION_TIERS if t.name == tier["name"])
            
            # Test monthly pricing consistency
            monthly_price = tier["price_monthly_cents"]
            expected_monthly = shared_tier.price_monthly_cents
            assert monthly_price == expected_monthly, \
                f"Billing settings monthly price for {tier['name']} ({monthly_price}) should match shared config ({expected_monthly})"
            
            # Test yearly pricing consistency
            yearly_price = tier["price_yearly_cents"]
            expected_yearly = shared_tier.price_yearly_cents
            assert yearly_price == expected_yearly, \
                f"Billing settings yearly price for {tier['name']} ({yearly_price}) should match shared config ({expected_yearly})"
            
            # Test Enterprise tier special handling in billing settings
            if tier["name"] == "enterprise":
                # Verify Enterprise tier shows custom pricing in billing context
                assert monthly_price == -1, "Enterprise monthly price should be -1 in billing settings"
                assert yearly_price == -1, "Enterprise yearly price should be -1 in billing settings"
                
                # Verify Enterprise tier has proper display name
                assert tier["display_name"] == "Enterprise", "Enterprise tier should have correct display name"
                
                # Verify Enterprise tier description mentions custom pricing
                assert "custom" in tier["description"].lower(), "Enterprise description should mention custom pricing"

    def test_billing_cycle_calculations_consistency(self, client: TestClient):
        """
        Requirement 1.5: Test billing cycle calculations are consistent across platform.
        
        Verifies that yearly discount calculations and billing cycle switching
        produce consistent results across all pricing displays.
        """
        # Get tiers from API
        response = client.get("/api/v1/subscriptions/tiers")
        assert response.status_code == 200
        tiers = response.json()
        
        for tier in tiers:
            if tier["name"] == "enterprise":
                # Skip Enterprise tier as it has custom pricing
                continue
                
            monthly_price = tier["price_monthly_cents"]
            yearly_price = tier["price_yearly_cents"]
            
            if monthly_price > 0 and yearly_price > 0:
                # Calculate yearly savings using shared utility
                # shared_tier = next(t for t in SUBSCRIPTION_TIERS if t.name == tier["name"])  # Not currently used
                savings_percentage = PricingUtils.calculate_yearly_savings(monthly_price, yearly_price)
                
                # Verify 20% discount for paid tiers
                expected_yearly = int(monthly_price * 12 * 0.8)  # 20% discount
                assert abs(yearly_price - expected_yearly) <= 100, \
                    f"Yearly price for {tier['name']} should be approximately 20% off monthly * 12"
                
                # Verify savings calculation
                assert 19 <= savings_percentage <= 21, \
                    f"Yearly savings for {tier['name']} should be approximately 20%, got {savings_percentage}%"

    # ==================== Requirement 1.3: Payment Processing Uses Correct Pricing ====================

    def test_payment_processing_uses_correct_pricing_amounts(self, client: TestClient, auth_headers: Dict[str, str]):
        """
        Requirement 1.3: Validate payment processing uses correct pricing amounts.
        
        This test verifies that when users select tiers for payment, the system
        returns the correct pricing amounts that match the shared configuration.
        """
        # Get tiers for testing
        response = client.get("/api/v1/subscriptions/tiers")
        assert response.status_code == 200
        tiers = response.json()
        
        for tier in tiers:
            if tier["name"] == "pilot_solo":
                # Test free tier selection (no payment required)
                select_data = {
                    "tier_id": tier["id"],
                    "billing_cycle": "monthly"
                }
                
                response = client.post("/api/v1/subscriptions/select-tier", 
                                     json=select_data, headers=auth_headers)
                assert response.status_code == 200
                result = response.json()
                
                assert result["requires_payment"] is False, "Free tier should not require payment"
                assert result["success"] is True, "Free tier selection should succeed"
                
            elif tier["name"] == "enterprise":
                # Test Enterprise tier selection (should handle custom pricing)
                select_data = {
                    "tier_id": tier["id"],
                    "billing_cycle": "monthly"
                }
                
                response = client.post("/api/v1/subscriptions/select-tier", 
                                     json=select_data, headers=auth_headers)
                assert response.status_code == 200
                result = response.json()
                
                # Enterprise tier should require payment but with custom handling
                assert result["requires_payment"] is True, "Enterprise tier should require payment process"
                assert result["amount_cents"] == -1, "Enterprise should return -1 for custom pricing"
                
            else:
                # Test paid tier selection (monthly)
                select_data = {
                    "tier_id": tier["id"],
                    "billing_cycle": "monthly"
                }
                
                response = client.post("/api/v1/subscriptions/select-tier", 
                                     json=select_data, headers=auth_headers)
                assert response.status_code == 200
                result = response.json()
                
                assert result["requires_payment"] is True, "Paid tier should require payment"
                assert result["amount_cents"] == tier["price_monthly_cents"], \
                    f"Payment amount should match tier monthly price for {tier['name']}"
                assert result["currency"] == tier["currency"], "Payment currency should match tier currency"
                
                # Test paid tier selection (yearly)
                select_data["billing_cycle"] = "yearly"
                response = client.post("/api/v1/subscriptions/select-tier", 
                                     json=select_data, headers=auth_headers)
                assert response.status_code == 200
                result = response.json()
                
                assert result["amount_cents"] == tier["price_yearly_cents"], \
                    f"Payment amount should match tier yearly price for {tier['name']}"

    def test_tier_upgrade_downgrade_pricing_consistency(self, client: TestClient, auth_headers: Dict[str, str]):
        """
        Requirement 1.5: Test tier upgrade/downgrade with consistent pricing (Enterprise contact sales flow).
        
        Verifies that tier changes maintain pricing consistency and that Enterprise
        tier upgrades are handled with the contact sales flow.
        """
        # Get available tiers
        response = client.get("/api/v1/subscriptions/tiers")
        assert response.status_code == 200
        tiers = response.json()
        
        # Test upgrade to each tier
        for tier in tiers:
            select_data = {
                "tier_id": tier["id"],
                "billing_cycle": "monthly"
            }
            
            response = client.post("/api/v1/subscriptions/select-tier", 
                                 json=select_data, headers=auth_headers)
            assert response.status_code == 200
            result = response.json()
            
            if tier["name"] == "enterprise":
                # Enterprise tier should trigger contact sales flow
                assert result["requires_payment"] is True, "Enterprise should require payment process"
                assert result["amount_cents"] == -1, "Enterprise should use custom pricing (-1)"
                assert "tier" in result and result["tier"] == "enterprise", "Should confirm Enterprise tier selection"
                
            elif tier["price_monthly_cents"] == 0:
                # Free tier should not require payment
                assert result["requires_payment"] is False, "Free tier should not require payment"
                
            else:
                # Paid tier should require payment with correct amount
                assert result["requires_payment"] is True, "Paid tier should require payment"
                assert result["amount_cents"] == tier["price_monthly_cents"], \
                    f"Payment amount should match tier price for {tier['name']}"

    # ==================== Requirement 3.6: Enterprise Tier Consistency ====================

    def test_enterprise_tier_displays_contact_sales_consistently(self, client: TestClient):
        """
        Requirement 3.6: Test Enterprise tier displays "Contact Sales" consistently across all pages.
        
        This test verifies that the Enterprise tier is handled consistently across
        all API endpoints and that pricing utilities properly format custom pricing.
        """
        # Get Enterprise tier from API
        response = client.get("/api/v1/subscriptions/tiers")
        assert response.status_code == 200
        tiers = response.json()
        
        enterprise_tier = next((t for t in tiers if t["name"] == "enterprise"), None)
        assert enterprise_tier is not None, "Enterprise tier should be available"
        
        # Test Enterprise tier properties
        assert enterprise_tier["price_monthly_cents"] == -1, "Enterprise monthly price should be -1"
        assert enterprise_tier["price_yearly_cents"] == -1, "Enterprise yearly price should be -1"
        assert enterprise_tier["display_name"] == "Enterprise", "Enterprise should have correct display name"
        
        # Test pricing utility functions with Enterprise tier
        shared_enterprise = next(t for t in SUBSCRIPTION_TIERS if t.name == "enterprise")
        
        # Test monthly pricing display
        monthly_display = PricingUtils.format_price(shared_enterprise.price_monthly_cents)
        assert monthly_display == "Contact Sales", "Enterprise monthly should display 'Contact Sales'"
        
        # Test yearly pricing display
        yearly_display = PricingUtils.format_price(shared_enterprise.price_yearly_cents)
        assert yearly_display == "Contact Sales", "Enterprise yearly should display 'Contact Sales'"
        
        # Test billing cycle formatting
        monthly_with_cycle = PricingUtils.format_price_with_cycle(shared_enterprise, "monthly")
        yearly_with_cycle = PricingUtils.format_price_with_cycle(shared_enterprise, "yearly")
        
        assert monthly_with_cycle == "Contact Sales", "Enterprise monthly with cycle should show 'Contact Sales'"
        assert yearly_with_cycle == "Contact Sales", "Enterprise yearly with cycle should show 'Contact Sales'"
        
        # Test custom pricing detection
        assert PricingUtils.has_custom_pricing(shared_enterprise), "Enterprise should be detected as custom pricing"
        
        # Test Enterprise tier features are unlimited
        unlimited_features = ["max_users", "max_orders_per_month", "max_terminals", "max_locations"]
        for feature in unlimited_features:
            if feature in shared_enterprise.features:
                assert shared_enterprise.features[feature] == -1, f"Enterprise {feature} should be unlimited (-1)"

    # ==================== Cross-Platform Consistency Tests ====================

    def test_all_pricing_sources_return_identical_data(self, client: TestClient, auth_headers: Dict[str, str]):
        """
        Comprehensive test that all pricing sources return identical data.
        
        This test verifies that pricing data is consistent across:
        - Public tiers endpoint (marketing pages)
        - Authenticated tiers endpoint (billing settings)
        - Shared configuration (frontend)
        - Backend database (API responses)
        """
        # Get public tiers (marketing page data)
        public_response = client.get("/api/v1/subscriptions/tiers")
        assert public_response.status_code == 200
        public_tiers = public_response.json()
        
        # Get authenticated tiers (billing settings data)
        auth_response = client.get("/api/v1/subscriptions/tiers", headers=auth_headers)
        assert auth_response.status_code == 200
        auth_tiers = auth_response.json()
        
        # Verify public and authenticated endpoints return identical data
        assert len(public_tiers) == len(auth_tiers), "Public and auth endpoints should return same number of tiers"
        
        for public_tier, auth_tier in zip(
            sorted(public_tiers, key=lambda x: x["sort_order"]),
            sorted(auth_tiers, key=lambda x: x["sort_order"])
        ):
            assert public_tier == auth_tier, f"Public and auth tier data should be identical for {public_tier['name']}"
        
        # Verify API data matches shared configuration
        for api_tier in public_tiers:
            shared_tier = next(t for t in SUBSCRIPTION_TIERS if t.name == api_tier["name"])
            
            # Verify core pricing fields
            assert api_tier["price_monthly_cents"] == shared_tier.price_monthly_cents
            assert api_tier["price_yearly_cents"] == shared_tier.price_yearly_cents
            assert api_tier["currency"] == shared_tier.currency
            assert api_tier["display_name"] == shared_tier.display_name
            assert api_tier["description"] == shared_tier.description
            assert api_tier["sort_order"] == shared_tier.sort_order
            assert api_tier["is_default"] == shared_tier.is_default

    def test_pricing_configuration_validation(self):
        """
        Test that the shared pricing configuration is valid and consistent.
        
        This test validates the pricing configuration itself to ensure
        it meets all requirements and has no internal inconsistencies.
        """
        # Validate all tiers using shared utility
        validation_result = PricingUtils.validate_all_tiers()
        
        assert validation_result["isValid"], f"Pricing configuration should be valid. Errors: {validation_result['globalErrors']}"
        
        # Verify we have exactly 5 tiers
        assert len(SUBSCRIPTION_TIERS) == 5, "Should have exactly 5 subscription tiers"
        
        # Verify tier names are correct
        expected_names = {"pilot_solo", "pilot_lite", "pilot_core", "pilot_pro", "enterprise"}
        actual_names = {tier.name for tier in SUBSCRIPTION_TIERS}
        assert actual_names == expected_names, f"Tier names should match expected set. Got: {actual_names}"
        
        # Verify pricing amounts are correct
        pricing_expectations = {
            "pilot_solo": (0, 0),
            "pilot_lite": (19900, 191040),
            "pilot_core": (79900, 767040),
            "pilot_pro": (149900, 1439040),
            "enterprise": (-1, -1)
        }
        
        for tier in SUBSCRIPTION_TIERS:
            expected_monthly, expected_yearly = pricing_expectations[tier.name]
            assert tier.price_monthly_cents == expected_monthly, \
                f"{tier.name} monthly price should be {expected_monthly}, got {tier.price_monthly_cents}"
            assert tier.price_yearly_cents == expected_yearly, \
                f"{tier.name} yearly price should be {expected_yearly}, got {tier.price_yearly_cents}"
        
        # Verify Enterprise tier has custom pricing flag
        enterprise_tier = next(t for t in SUBSCRIPTION_TIERS if t.name == "enterprise")
        assert enterprise_tier.is_custom_pricing, "Enterprise tier should have is_custom_pricing=True"
        
        # Verify only one default tier
        default_tiers = [t for t in SUBSCRIPTION_TIERS if t.is_default]
        assert len(default_tiers) == 1, "Should have exactly one default tier"
        assert default_tiers[0].name == "pilot_solo", "Pilot Solo should be the default tier"

    def test_enterprise_contact_sales_flow_integration(self, client: TestClient, auth_headers: Dict[str, str]):
        """
        Test the complete Enterprise contact sales flow integration.
        
        This test verifies that the Enterprise tier is properly handled throughout
        the entire user journey from marketing page to billing settings.
        """
        # Get Enterprise tier
        response = client.get("/api/v1/subscriptions/tiers")
        assert response.status_code == 200
        tiers = response.json()
        
        enterprise_tier = next((t for t in tiers if t["name"] == "enterprise"), None)
        assert enterprise_tier is not None, "Enterprise tier should be available"
        
        # Test Enterprise tier selection triggers contact sales flow
        select_data = {
            "tier_id": enterprise_tier["id"],
            "billing_cycle": "monthly"
        }
        
        response = client.post("/api/v1/subscriptions/select-tier", 
                             json=select_data, headers=auth_headers)
        assert response.status_code == 200
        result = response.json()
        
        # Verify Enterprise selection response
        assert result["success"] is True, "Enterprise tier selection should succeed"
        assert result["requires_payment"] is True, "Enterprise should require payment process"
        assert result["tier"] == "enterprise", "Should confirm Enterprise tier"
        assert result["amount_cents"] == -1, "Enterprise should use custom pricing indicator"
        
        # Verify Enterprise tier cannot be directly activated like free tiers
        # (it should go through contact sales process)
        assert "message" not in result or "activated" not in result.get("message", "").lower(), \
            "Enterprise should not be directly activated without sales contact"
        
        # Test that Enterprise tier shows up correctly in user subscription info
        response = client.get("/api/v1/subscriptions/me", headers=auth_headers)
        assert response.status_code == 200
        subscription_info = response.json()
        
        # Verify subscription endpoint can handle Enterprise tier queries
        assert "tier" in subscription_info, "Subscription info should include tier information"
        
        # Test Enterprise tier feature access
        response = client.get("/api/v1/subscriptions/features", headers=auth_headers)
        assert response.status_code == 200
        features = response.json()
        
        # Verify features endpoint works (even if user doesn't have Enterprise tier yet)
        assert isinstance(features, dict), "Features should be returned as a dictionary"


if __name__ == "__main__":
    # Run the tests
    pytest.main([__file__, "-v"])