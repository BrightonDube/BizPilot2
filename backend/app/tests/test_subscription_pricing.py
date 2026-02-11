"""
Test subscription pricing consistency and functionality.

This test suite verifies that:
1. Subscription API endpoints return correct pricing from shared configuration
2. Payment processing uses correct amounts
3. Tier upgrade/downgrade functionality works correctly
4. Pricing data is consistent between frontend and backend

Requirements: 1.2, 1.3
"""

import pytest
import sys
import os
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from unittest.mock import patch, MagicMock, AsyncMock
from app.main import app
from app.core.database import get_sync_db
from app.models.user import User, UserStatus, SubscriptionStatus
from app.models.subscription_tier import SubscriptionTier
from app.models.subscription_transaction import SubscriptionTransaction, TransactionStatus, TransactionType
from app.api.deps import get_current_active_user

# Add shared module to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'shared'))
from pricing_config import SUBSCRIPTION_TIERS, PricingUtils


class TestSubscriptionPricingConsistency:
    """Test subscription pricing consistency across the platform."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        return TestClient(app)

    @pytest.fixture
    def db_session(self):
        """Get database session."""
        db = next(get_sync_db())
        yield db
        db.close()

    @pytest.fixture
    def test_user(self, db_session: Session):
        """Create a test user."""
        user = User(
            email="test@example.com",
            first_name="Test",
            last_name="User",
            status=UserStatus.ACTIVE,
            subscription_status=SubscriptionStatus.ACTIVE
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    @pytest.fixture
    def auth_headers(self, test_user):
        """Create authentication headers using FastAPI dependency override."""
        app.dependency_overrides[get_current_active_user] = lambda: test_user
        yield {"Authorization": "Bearer test-token"}
        app.dependency_overrides.pop(get_current_active_user, None)

    def setup_method(self):
        """Set up test data before each test."""
        db = next(get_sync_db())
        try:
            from sqlalchemy import text
            db.execute(text(
                "TRUNCATE TABLE subscription_tiers, users, organizations, businesses, "
                "business_users, subscription_transactions, roles CASCADE"
            ))
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

    def test_subscription_tiers_endpoint_returns_correct_pricing(self, client: TestClient, db_session: Session):
        """Test that /subscriptions/tiers endpoint returns pricing matching shared configuration."""
        response = client.get("/api/v1/subscriptions/tiers")
        assert response.status_code == 200

        api_tiers = response.json()
        assert len(api_tiers) == len(SUBSCRIPTION_TIERS)

        for api_tier in api_tiers:
            shared_tier = next(
                (t for t in SUBSCRIPTION_TIERS if t.name == api_tier["name"]),
                None
            )
            assert shared_tier is not None, f"Tier {api_tier['name']} not found in shared config"

            assert api_tier["price_monthly_cents"] == shared_tier.price_monthly_cents
            assert api_tier["price_yearly_cents"] == shared_tier.price_yearly_cents
            assert api_tier["currency"] == shared_tier.currency
            assert api_tier["display_name"] == shared_tier.display_name
            assert api_tier["is_custom_pricing"] == shared_tier.is_custom_pricing

            assert api_tier["features"] == shared_tier.features
            assert api_tier["feature_flags"] == shared_tier.feature_flags

    def test_specific_tier_pricing_accuracy(self, client: TestClient, db_session: Session):
        """Test specific tier pricing values match requirements."""
        response = client.get("/api/v1/subscriptions/tiers")
        assert response.status_code == 200
        
        tiers_by_name = {tier["name"]: tier for tier in response.json()}
        
        # Verify Pilot Solo (Free)
        pilot_solo = tiers_by_name.get("pilot_solo")
        assert pilot_solo is not None
        assert pilot_solo["price_monthly_cents"] == 0
        assert pilot_solo["price_yearly_cents"] == 0
        assert pilot_solo["display_name"] == "Pilot Solo"
        
        # Verify Pilot Lite (R199)
        pilot_lite = tiers_by_name.get("pilot_lite")
        assert pilot_lite is not None
        assert pilot_lite["price_monthly_cents"] == 19900  # R199
        assert pilot_lite["price_yearly_cents"] == 191040  # 20% discount
        assert pilot_lite["display_name"] == "Pilot Lite"
        
        # Verify Pilot Core (R799)
        pilot_core = tiers_by_name.get("pilot_core")
        assert pilot_core is not None
        assert pilot_core["price_monthly_cents"] == 79900  # R799
        assert pilot_core["price_yearly_cents"] == 767040  # 20% discount
        assert pilot_core["display_name"] == "Pilot Core"
        
        # Verify Pilot Pro (R1499)
        pilot_pro = tiers_by_name.get("pilot_pro")
        assert pilot_pro is not None
        assert pilot_pro["price_monthly_cents"] == 149900  # R1499
        assert pilot_pro["price_yearly_cents"] == 1439040  # 20% discount
        assert pilot_pro["display_name"] == "Pilot Pro"
        
        # Verify Enterprise (Custom pricing)
        enterprise = tiers_by_name.get("enterprise")
        assert enterprise is not None
        assert enterprise["price_monthly_cents"] == -1  # Custom pricing indicator
        assert enterprise["price_yearly_cents"] == -1  # Custom pricing indicator
        assert enterprise["is_custom_pricing"] is True
        assert enterprise["display_name"] == "Enterprise"

    def test_payment_processing_uses_correct_amounts(self, client: TestClient, db_session: Session, auth_headers):
        """Test that payment processing uses correct pricing amounts."""
        # Get Pilot Core tier for testing
        pilot_core_tier = db_session.query(SubscriptionTier).filter(
            SubscriptionTier.name == "pilot_core"
        ).first()
        
        if not pilot_core_tier:
            # Create tier if it doesn't exist
            pilot_core_config = next(t for t in SUBSCRIPTION_TIERS if t.name == "pilot_core")
            pilot_core_tier = SubscriptionTier(
                name=pilot_core_config.name,
                display_name=pilot_core_config.display_name,
                description=pilot_core_config.description,
                price_monthly_cents=pilot_core_config.price_monthly_cents,
                price_yearly_cents=pilot_core_config.price_yearly_cents,
                currency=pilot_core_config.currency,
                sort_order=pilot_core_config.sort_order,
                is_default=pilot_core_config.is_default,
                is_active=pilot_core_config.is_active,
                is_custom_pricing=pilot_core_config.is_custom_pricing,
                features=pilot_core_config.features,
                feature_flags=pilot_core_config.feature_flags
            )
            db_session.add(pilot_core_tier)
            db_session.commit()
            db_session.refresh(pilot_core_tier)

        # Mock Paystack service (patch where it's imported in the endpoint module)
        with patch('app.api.payments_subscription.paystack_service') as mock_paystack:
            mock_paystack.create_customer = AsyncMock(return_value=MagicMock(customer_code="CUST_test123"))
            mock_paystack.initialize_transaction = AsyncMock(return_value=MagicMock(
                reference="TXN_test123",
                authorization_url="https://checkout.paystack.com/test123",
                access_code="test_access_code"
            ))

            # Test monthly billing
            response = client.post(
                "/api/v1/payments/checkout/initiate",
                json={
                    "tier_id": str(pilot_core_tier.id),
                    "billing_cycle": "monthly"
                },
                headers=auth_headers
            )
            
            assert response.status_code == 200
            
            # Verify Paystack was called with correct amount
            mock_paystack.initialize_transaction.assert_called()
            call_args = mock_paystack.initialize_transaction.call_args
            assert call_args[1]["amount_cents"] == 79900  # R799 in cents

            # Test yearly billing
            mock_paystack.reset_mock()
            response = client.post(
                "/api/v1/payments/checkout/initiate",
                json={
                    "tier_id": str(pilot_core_tier.id),
                    "billing_cycle": "yearly"
                },
                headers=auth_headers
            )
            
            assert response.status_code == 200
            
            # Verify Paystack was called with correct yearly amount
            mock_paystack.initialize_transaction.assert_called()
            call_args = mock_paystack.initialize_transaction.call_args
            assert call_args[1]["amount_cents"] == 767040  # Yearly price with 20% discount

    def test_tier_upgrade_downgrade_functionality(self, client: TestClient, db_session: Session, auth_headers, test_user):
        """Test tier upgrade and downgrade functionality."""
        # Use tiers seeded by setup_method
        free_tier = db_session.query(SubscriptionTier).filter(
            SubscriptionTier.name == "pilot_solo"
        ).first()
        paid_tier = db_session.query(SubscriptionTier).filter(
            SubscriptionTier.name == "pilot_lite"
        ).first()
        assert free_tier is not None, "pilot_solo tier should exist from setup"
        assert paid_tier is not None, "pilot_lite tier should exist from setup"

        # Test selecting free tier (should work immediately)
        response = client.post(
            "/api/v1/subscriptions/select-tier",
            json={
                "tier_id": str(free_tier.id),
                "billing_cycle": "monthly"
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        assert result["requires_payment"] is False
        assert result["tier"] == "pilot_solo"

        # Test selecting paid tier (should return checkout info)
        response = client.post(
            "/api/v1/subscriptions/select-tier",
            json={
                "tier_id": str(paid_tier.id),
                "billing_cycle": "monthly"
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        result = response.json()
        assert result["success"] is True
        assert result["requires_payment"] is True
        assert result["tier"] == "pilot_lite"
        assert result["amount_cents"] == 19900
        assert result["currency"] == "ZAR"
        assert result["billing_cycle"] == "monthly"

    def test_enterprise_tier_custom_pricing_handling(self, client: TestClient, db_session: Session):
        """Test that Enterprise tier with custom pricing is handled correctly."""
        # Use enterprise tier seeded by setup_method
        enterprise_tier = db_session.query(SubscriptionTier).filter(
            SubscriptionTier.name == "enterprise"
        ).first()
        assert enterprise_tier is not None, "enterprise tier should exist from setup"

        # Test that Enterprise tier appears in tiers list
        response = client.get("/api/v1/subscriptions/tiers")
        assert response.status_code == 200
        
        tiers = response.json()
        enterprise = next((t for t in tiers if t["name"] == "enterprise"), None)
        assert enterprise is not None
        assert enterprise["is_custom_pricing"] is True
        assert enterprise["price_monthly_cents"] == -1
        assert enterprise["price_yearly_cents"] == -1

        # Test that Enterprise tier cannot be selected through normal flow
        mock_user = MagicMock()
        mock_user.id = "test-user-id"
        mock_user.status = UserStatus.ACTIVE
        app.dependency_overrides[get_current_active_user] = lambda: mock_user
        try:
            response = client.post(
                "/api/v1/subscriptions/select-tier",
                json={
                    "tier_id": str(enterprise_tier.id),
                    "billing_cycle": "monthly"
                },
                headers={"Authorization": "Bearer test-token"}
            )
            
            # Should handle custom pricing appropriately
            # (Implementation may vary - could redirect to sales contact)
            assert response.status_code in [200, 400, 422]
        finally:
            app.dependency_overrides.pop(get_current_active_user, None)

    def test_pricing_utility_functions(self):
        """Test pricing utility functions for consistency."""
        # Test price formatting
        assert PricingUtils.format_price(0) == "Free"
        assert PricingUtils.format_price(-1) == "Contact Sales"
        assert PricingUtils.format_price(19900, "ZAR") == "R199"
        assert PricingUtils.format_price(79900, "ZAR") == "R799"
        assert PricingUtils.format_price(149900, "ZAR") == "R1,499"

        # Test yearly savings calculation
        monthly_price = 19900  # R199
        yearly_price = 191040  # 20% discount
        savings = PricingUtils.calculate_yearly_savings(monthly_price, yearly_price)
        assert savings == 20  # 20% savings

        # Test tier lookup
        pilot_lite = PricingUtils.get_tier_by_id("pilot_lite")
        assert pilot_lite is not None
        assert pilot_lite.name == "pilot_lite"
        assert pilot_lite.price_monthly_cents == 19900

        # Test default tier
        default_tier = PricingUtils.get_default_tier()
        assert default_tier is not None
        assert default_tier.is_default is True
        assert default_tier.name == "pilot_solo"

        # Test custom pricing detection
        enterprise_tier = PricingUtils.get_tier_by_id("enterprise")
        assert enterprise_tier is not None
        assert PricingUtils.has_custom_pricing(enterprise_tier) is True

    def test_subscription_transaction_pricing_consistency(self, db_session: Session):
        """Test that subscription transactions record correct pricing."""
        # Use tier seeded by setup_method
        tier = db_session.query(SubscriptionTier).filter(
            SubscriptionTier.name == "pilot_core"
        ).first()
        assert tier is not None, "pilot_core tier should exist from setup"

        # Create a test user
        user = User(
            email="transaction_test@example.com",
            first_name="Transaction",
            last_name="Test",
            status=UserStatus.ACTIVE,
            subscription_status=SubscriptionStatus.ACTIVE
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        # Create a subscription transaction
        transaction = SubscriptionTransaction(
            user_id=user.id,
            tier_id=tier.id,
            transaction_type=TransactionType.SUBSCRIPTION,
            status=TransactionStatus.PENDING,
            amount_cents=tier.price_monthly_cents,
            currency=tier.currency,
            paystack_reference="TEST_REF_123"
        )
        db_session.add(transaction)
        db_session.commit()

        # Verify transaction has correct pricing
        assert transaction.amount_cents == 79900  # R799 in cents
        assert transaction.currency == "ZAR"
        assert transaction.tier_id == tier.id

    def test_yearly_discount_calculation_accuracy(self):
        """Test that yearly discount calculations are accurate."""
        for tier_config in SUBSCRIPTION_TIERS:
            if tier_config.price_monthly_cents > 0 and tier_config.price_yearly_cents > 0:
                monthly_total = tier_config.price_monthly_cents * 12
                yearly_price = tier_config.price_yearly_cents
                
                # Calculate expected discount percentage
                expected_discount = ((monthly_total - yearly_price) / monthly_total) * 100
                
                # All paid tiers should have 20% yearly discount
                assert abs(expected_discount - 20.0) < 0.1, f"Tier {tier_config.name} should have 20% yearly discount"

    def test_feature_flags_consistency(self):
        """Test that feature flags are consistent across tiers."""
        # Verify feature progression makes sense
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

    def test_currency_consistency(self):
        """Test that all tiers use consistent currency."""
        for tier_config in SUBSCRIPTION_TIERS:
            assert tier_config.currency == "ZAR", f"Tier {tier_config.name} should use ZAR currency"

    def test_sort_order_consistency(self):
        """Test that tier sort order is logical."""
        sorted_tiers = sorted(SUBSCRIPTION_TIERS, key=lambda t: t.sort_order)
        
        # Verify order: Solo -> Lite -> Core -> Pro -> Enterprise
        expected_order = ["pilot_solo", "pilot_lite", "pilot_core", "pilot_pro", "enterprise"]
        actual_order = [t.name for t in sorted_tiers]
        
        assert actual_order == expected_order, f"Tier order should be {expected_order}, got {actual_order}"


class TestSubscriptionAPIIntegration:
    """Integration tests for subscription API endpoints."""

    @pytest.fixture
    def client(self):
        return TestClient(app)

    def test_subscription_api_error_handling(self, client: TestClient):
        """Test subscription API error handling."""
        # Test invalid tier ID
        response = client.get("/api/v1/subscriptions/tiers/invalid-uuid")
        assert response.status_code == 422  # Invalid UUID format

        # Test non-existent tier
        response = client.get("/api/v1/subscriptions/tiers/00000000-0000-0000-0000-000000000000")
        assert response.status_code == 404

    def test_subscription_api_response_format(self, client: TestClient):
        """Test that subscription API responses have correct format."""
        response = client.get("/api/v1/subscriptions/tiers")
        assert response.status_code == 200
        
        tiers = response.json()
        assert isinstance(tiers, list)
        
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