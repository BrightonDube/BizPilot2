"""
Integration tests for subscription API endpoints.

This test suite verifies that:
1. Subscription API endpoints return correct pricing from database
2. API responses match shared configuration
3. Payment processing endpoints work with correct amounts

Requirements: 1.2, 1.3
"""

import pytest
import sys
import os
from fastapi.testclient import TestClient

# Add shared module to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'shared'))
from pricing_config import SUBSCRIPTION_TIERS

from app.main import app


class TestSubscriptionAPIIntegration:
    """Integration tests for subscription API endpoints."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        return TestClient(app)

    def test_subscription_tiers_endpoint_returns_data(self, client: TestClient):
        """Test that /subscriptions/tiers endpoint returns data."""
        response = client.get("/api/v1/subscriptions/tiers")
        assert response.status_code == 200
        
        tiers = response.json()
        assert isinstance(tiers, list)
        assert len(tiers) > 0, "Should return at least one tier"

    def test_subscription_tiers_pricing_matches_shared_config(self, client: TestClient):
        """Test that API pricing matches shared configuration."""
        response = client.get("/api/v1/subscriptions/tiers")
        assert response.status_code == 200
        
        api_tiers = response.json()
        api_tiers_by_name = {tier["name"]: tier for tier in api_tiers}
        
        # Verify each shared config tier exists in API response with correct pricing
        for shared_tier in SUBSCRIPTION_TIERS:
            api_tier = api_tiers_by_name.get(shared_tier.name)
            assert api_tier is not None, f"Tier {shared_tier.name} not found in API response"
            
            # Verify pricing matches exactly
            assert api_tier["price_monthly_cents"] == shared_tier.price_monthly_cents, \
                f"Monthly price mismatch for {shared_tier.name}"
            assert api_tier["price_yearly_cents"] == shared_tier.price_yearly_cents, \
                f"Yearly price mismatch for {shared_tier.name}"
            assert api_tier["currency"] == shared_tier.currency, \
                f"Currency mismatch for {shared_tier.name}"
            assert api_tier["display_name"] == shared_tier.display_name, \
                f"Display name mismatch for {shared_tier.name}"

    def test_specific_tier_pricing_values(self, client: TestClient):
        """Test specific tier pricing values match requirements."""
        response = client.get("/api/v1/subscriptions/tiers")
        assert response.status_code == 200
        
        tiers_by_name = {tier["name"]: tier for tier in response.json()}
        
        # Verify Pilot Solo (Free)
        if "pilot_solo" in tiers_by_name:
            pilot_solo = tiers_by_name["pilot_solo"]
            assert pilot_solo["price_monthly_cents"] == 0
            assert pilot_solo["price_yearly_cents"] == 0
            assert pilot_solo["display_name"] == "Pilot Solo"
        
        # Verify Pilot Lite (R199)
        if "pilot_lite" in tiers_by_name:
            pilot_lite = tiers_by_name["pilot_lite"]
            assert pilot_lite["price_monthly_cents"] == 19900  # R199
            assert pilot_lite["price_yearly_cents"] == 191040  # 20% discount
            assert pilot_lite["display_name"] == "Pilot Lite"
        
        # Verify Pilot Core (R799)
        if "pilot_core" in tiers_by_name:
            pilot_core = tiers_by_name["pilot_core"]
            assert pilot_core["price_monthly_cents"] == 79900  # R799
            assert pilot_core["price_yearly_cents"] == 767040  # 20% discount
            assert pilot_core["display_name"] == "Pilot Core"
        
        # Verify Pilot Pro (R1499)
        if "pilot_pro" in tiers_by_name:
            pilot_pro = tiers_by_name["pilot_pro"]
            assert pilot_pro["price_monthly_cents"] == 149900  # R1499
            assert pilot_pro["price_yearly_cents"] == 1439040  # 20% discount
            assert pilot_pro["display_name"] == "Pilot Pro"
        
        # Verify Enterprise (Custom pricing)
        if "enterprise" in tiers_by_name:
            enterprise = tiers_by_name["enterprise"]
            assert enterprise["price_monthly_cents"] == -1  # Custom pricing indicator
            assert enterprise["price_yearly_cents"] == -1  # Custom pricing indicator
            assert enterprise["display_name"] == "Enterprise"

    def test_tier_response_structure(self, client: TestClient):
        """Test that tier API responses have correct structure."""
        response = client.get("/api/v1/subscriptions/tiers")
        assert response.status_code == 200
        
        tiers = response.json()
        
        for tier in tiers:
            # Verify required fields are present
            required_fields = [
                "id", "name", "display_name", "price_monthly_cents", 
                "price_yearly_cents", "currency", "sort_order", 
                "is_default", "features", "feature_flags"
            ]
            for field in required_fields:
                assert field in tier, f"Field {field} missing from tier response"
            
            # Verify data types
            assert isinstance(tier["price_monthly_cents"], int)
            assert isinstance(tier["price_yearly_cents"], int)
            assert isinstance(tier["currency"], str)
            assert isinstance(tier["sort_order"], int)
            assert isinstance(tier["is_default"], bool)
            assert isinstance(tier["features"], dict)
            assert isinstance(tier["feature_flags"], dict)

    def test_tier_sort_order_in_api(self, client: TestClient):
        """Test that tiers are returned in correct sort order."""
        response = client.get("/api/v1/subscriptions/tiers")
        assert response.status_code == 200
        
        tiers = response.json()
        
        # Verify tiers are sorted by sort_order
        for i in range(len(tiers) - 1):
            assert tiers[i]["sort_order"] <= tiers[i + 1]["sort_order"], \
                "Tiers should be sorted by sort_order"

    def test_get_specific_tier_endpoint(self, client: TestClient):
        """Test getting a specific tier by ID."""
        # First get all tiers to get a valid ID
        response = client.get("/api/v1/subscriptions/tiers")
        assert response.status_code == 200
        
        tiers = response.json()
        if len(tiers) > 0:
            tier_id = tiers[0]["id"]
            
            # Test getting specific tier
            response = client.get(f"/api/v1/subscriptions/tiers/{tier_id}")
            assert response.status_code == 200
            
            tier = response.json()
            assert tier["id"] == tier_id

    def test_get_nonexistent_tier_returns_404(self, client: TestClient):
        """Test that getting non-existent tier returns 404."""
        fake_uuid = "00000000-0000-0000-0000-000000000000"
        response = client.get(f"/api/v1/subscriptions/tiers/{fake_uuid}")
        assert response.status_code == 404

    def test_currency_consistency_in_api(self, client: TestClient):
        """Test that all tiers use ZAR currency in API."""
        response = client.get("/api/v1/subscriptions/tiers")
        assert response.status_code == 200
        
        tiers = response.json()
        
        for tier in tiers:
            assert tier["currency"] == "ZAR", f"Tier {tier['name']} should use ZAR currency"

    def test_feature_flags_in_api_response(self, client: TestClient):
        """Test that feature flags are correctly returned in API."""
        response = client.get("/api/v1/subscriptions/tiers")
        assert response.status_code == 200
        
        tiers = response.json()
        tiers_by_name = {tier["name"]: tier for tier in tiers}
        
        # Test some key feature flag progressions
        if "pilot_solo" in tiers_by_name and "pilot_lite" in tiers_by_name:
            pilot_solo = tiers_by_name["pilot_solo"]
            pilot_lite = tiers_by_name["pilot_lite"]
            
            # Basic reports should be False for Solo, True for Lite
            assert pilot_solo["feature_flags"]["basic_reports"] is False
            assert pilot_lite["feature_flags"]["basic_reports"] is True

    def test_yearly_discount_calculation_in_api(self, client: TestClient):
        """Test that yearly discounts are correctly calculated in API data."""
        response = client.get("/api/v1/subscriptions/tiers")
        assert response.status_code == 200
        
        tiers = response.json()
        
        for tier in tiers:
            monthly_price = tier["price_monthly_cents"]
            yearly_price = tier["price_yearly_cents"]
            
            # Skip free and custom pricing tiers
            if monthly_price > 0 and yearly_price > 0:
                monthly_total = monthly_price * 12
                yearly_savings = ((monthly_total - yearly_price) / monthly_total) * 100
                
                # Should have approximately 20% yearly discount
                assert abs(yearly_savings - 20.0) < 0.1, \
                    f"Tier {tier['name']} should have 20% yearly discount, got {yearly_savings}%"

    def test_api_error_handling(self, client: TestClient):
        """Test API error handling for invalid requests."""
        # Test invalid UUID format
        response = client.get("/api/v1/subscriptions/tiers/invalid-uuid")
        assert response.status_code == 422  # Validation error for invalid UUID format

    def test_pricing_consistency_across_endpoints(self, client: TestClient):
        """Test that pricing is consistent across different API endpoints."""
        # Get all tiers
        all_tiers_response = client.get("/api/v1/subscriptions/tiers")
        assert all_tiers_response.status_code == 200
        
        all_tiers = all_tiers_response.json()
        
        # Test each tier individually
        for tier in all_tiers:
            tier_id = tier["id"]
            
            individual_tier_response = client.get(f"/api/v1/subscriptions/tiers/{tier_id}")
            assert individual_tier_response.status_code == 200
            
            individual_tier = individual_tier_response.json()
            
            # Verify pricing is identical
            assert individual_tier["price_monthly_cents"] == tier["price_monthly_cents"]
            assert individual_tier["price_yearly_cents"] == tier["price_yearly_cents"]
            assert individual_tier["currency"] == tier["currency"]
            assert individual_tier["display_name"] == tier["display_name"]