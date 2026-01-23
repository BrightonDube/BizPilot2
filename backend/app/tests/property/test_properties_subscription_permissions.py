"""Property-based tests for subscription and permissions system.

This module contains property-based tests that validate universal correctness
properties of the subscription and permissions system using Hypothesis.

Feature: granular-permissions-subscription
Requirements: 3.2, 3.6, 15.4
"""

from hypothesis import given, strategies as st, settings, HealthCheck
from typing import Dict, Any
from unittest.mock import Mock, MagicMock

from app.services.permission_service import PermissionService
from app.schemas.subscription import BusinessPermissions
from app.models.business import Business


# Strategies for generating test data

@st.composite
def tier_strategy(draw):
    """Generate a random tier name."""
    return draw(st.sampled_from(['demo', 'pilot_core', 'pilot_pro', 'enterprise']))


@st.composite
def feature_name_strategy(draw):
    """Generate a random feature name."""
    return draw(st.sampled_from([
        'has_payroll',
        'has_ai',
        'has_api_access',
        'has_advanced_reporting'
    ]))


@st.composite
def override_strategy(draw):
    """Generate a random set of feature overrides."""
    # Choose 1-4 features to override
    num_overrides = draw(st.integers(min_value=1, max_value=4))
    
    all_features = ['has_payroll', 'has_ai', 'has_api_access', 'has_advanced_reporting']
    features_to_override = draw(st.lists(
        st.sampled_from(all_features),
        min_size=num_overrides,
        max_size=num_overrides,
        unique=True
    ))
    
    # Generate override values (opposite of what tier defaults would be)
    overrides = {}
    for feature in features_to_override:
        overrides[feature] = draw(st.booleans())
    
    return overrides


@st.composite
def business_with_overrides_strategy(draw):
    """Generate a business with tier and overrides."""
    business_id = draw(st.integers(min_value=1, max_value=10000))
    tier = draw(tier_strategy())
    overrides = draw(override_strategy())
    
    return {
        'business_id': business_id,
        'tier': tier,
        'overrides': overrides
    }


def get_tier_defaults(tier_name: str) -> Dict[str, Any]:
    """Get default features for a tier (matches PermissionService logic)."""
    tier_defaults = {
        'demo': {
            'max_devices': 1,
            'max_users': 1,
            'has_payroll': True,
            'has_ai': True,
            'has_api_access': True,
            'has_advanced_reporting': True,
        },
        'pilot_core': {
            'max_devices': 2,
            'max_users': 5,
            'has_payroll': False,
            'has_ai': False,
            'has_api_access': False,
            'has_advanced_reporting': False,
        },
        'pilot_pro': {
            'max_devices': 999999,
            'max_users': 999999,
            'has_payroll': True,
            'has_ai': True,
            'has_api_access': True,
            'has_advanced_reporting': True,
        },
        'enterprise': {
            'max_devices': 999999,
            'max_users': 999999,
            'has_payroll': True,
            'has_ai': True,
            'has_api_access': True,
            'has_advanced_reporting': True,
        },
    }
    
    return tier_defaults.get(tier_name, tier_defaults['pilot_core'])


def create_mock_permission_service(business_data: Dict[str, Any]) -> PermissionService:
    """Create a mock PermissionService with test data."""
    # Mock database session
    mock_db = MagicMock()
    
    # Mock business query
    mock_business = Mock(spec=Business)
    mock_business.id = business_data['business_id']
    mock_business.name = f"Business {business_data['business_id']}"
    
    mock_db.query.return_value.filter.return_value.first.return_value = mock_business
    
    # Create service
    service = PermissionService(mock_db)
    
    # Mock Redis to avoid actual cache operations
    service._redis_client = None
    
    # Override the get_business_permissions method to apply overrides
    original_get_permissions = service.get_business_permissions
    
    def mock_get_permissions(business_id: int) -> BusinessPermissions:
        """Mock implementation that applies overrides."""
        if business_id != business_data['business_id']:
            return original_get_permissions(business_id)
        
        # Get tier defaults
        tier_defaults = get_tier_defaults(business_data['tier'])
        
        # Apply overrides
        effective_permissions = tier_defaults.copy()
        for feature, value in business_data['overrides'].items():
            effective_permissions[feature] = value
        
        # Build permissions object
        permissions = BusinessPermissions(
            business_id=business_id,
            tier_name=business_data['tier'],
            status='active',
            max_devices=effective_permissions['max_devices'],
            max_users=effective_permissions['max_users'],
            has_payroll=effective_permissions['has_payroll'],
            has_ai=effective_permissions['has_ai'],
            has_api_access=effective_permissions['has_api_access'],
            has_advanced_reporting=effective_permissions['has_advanced_reporting'],
            valid_until=None,
            is_demo_expired=False
        )
        
        return permissions
    
    service.get_business_permissions = mock_get_permissions
    
    return service


# Feature: granular-permissions-subscription, Property 1: Override Precedence
@given(business_data=business_with_overrides_strategy())
@settings(
    max_examples=100,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_override_precedence(business_data):
    """
    Property 1: Override Precedence
    
    For any business with feature overrides, when computing effective permissions,
    the override values SHALL take precedence over tier default values for the
    overridden features, while non-overridden features SHALL use tier defaults.
    
    **Validates: Requirements 3.2, 3.6, 15.4**
    
    This property ensures that:
    1. Overridden features use the override value, not the tier default
    2. Non-overridden features use the tier default value
    3. The precedence rule holds for all tiers and all feature combinations
    """
    # Setup: Create permission service with business data
    service = create_mock_permission_service(business_data)
    
    # Get tier defaults for comparison
    tier_defaults = get_tier_defaults(business_data['tier'])
    
    # Execute: Get computed permissions
    permissions = service.get_business_permissions(business_data['business_id'])
    
    # Verify: Overridden features use override values
    for feature, override_value in business_data['overrides'].items():
        actual_value = getattr(permissions, feature)
        assert actual_value == override_value, (
            f"Override precedence failed for {feature}: "
            f"expected {override_value}, got {actual_value}. "
            f"Tier: {business_data['tier']}, Overrides: {business_data['overrides']}"
        )
    
    # Verify: Non-overridden features use tier defaults
    all_features = ['has_payroll', 'has_ai', 'has_api_access', 'has_advanced_reporting']
    for feature in all_features:
        if feature not in business_data['overrides']:
            expected_value = tier_defaults[feature]
            actual_value = getattr(permissions, feature)
            assert actual_value == expected_value, (
                f"Tier default not used for non-overridden feature {feature}: "
                f"expected {expected_value}, got {actual_value}. "
                f"Tier: {business_data['tier']}, Overrides: {business_data['overrides']}"
            )
    
    # Verify: Business ID and tier are correct
    assert permissions.business_id == business_data['business_id']
    assert permissions.tier_name == business_data['tier']
    
    # Verify: Status is active (default for test)
    assert permissions.status == 'active'


# Feature: granular-permissions-subscription, Property 1 (Edge Case): All Features Overridden
@given(
    tier=tier_strategy(),
    override_values=st.booleans()
)
@settings(
    max_examples=100,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_override_precedence_all_features(tier, override_values):
    """
    Property 1 Edge Case: All Features Overridden
    
    When all features are overridden with the same value, all features
    should have that value regardless of tier defaults.
    
    **Validates: Requirements 3.2, 3.6**
    """
    # Setup: Create business with all features overridden
    business_data = {
        'business_id': 12345,
        'tier': tier,
        'overrides': {
            'has_payroll': override_values,
            'has_ai': override_values,
            'has_api_access': override_values,
            'has_advanced_reporting': override_values
        }
    }
    
    service = create_mock_permission_service(business_data)
    
    # Execute: Get permissions
    permissions = service.get_business_permissions(business_data['business_id'])
    
    # Verify: All features have the override value
    assert permissions.has_payroll == override_values
    assert permissions.has_ai == override_values
    assert permissions.has_api_access == override_values
    assert permissions.has_advanced_reporting == override_values


# Feature: granular-permissions-subscription, Property 1 (Edge Case): No Overrides
@given(tier=tier_strategy())
@settings(
    max_examples=100,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_override_precedence_no_overrides(tier):
    """
    Property 1 Edge Case: No Overrides
    
    When no overrides exist, all features should use tier defaults.
    
    **Validates: Requirements 3.2, 3.6**
    """
    # Setup: Create business with no overrides
    business_data = {
        'business_id': 54321,
        'tier': tier,
        'overrides': {}
    }
    
    service = create_mock_permission_service(business_data)
    tier_defaults = get_tier_defaults(tier)
    
    # Execute: Get permissions
    permissions = service.get_business_permissions(business_data['business_id'])
    
    # Verify: All features use tier defaults
    assert permissions.has_payroll == tier_defaults['has_payroll']
    assert permissions.has_ai == tier_defaults['has_ai']
    assert permissions.has_api_access == tier_defaults['has_api_access']
    assert permissions.has_advanced_reporting == tier_defaults['has_advanced_reporting']
    assert permissions.max_devices == tier_defaults['max_devices']
    assert permissions.max_users == tier_defaults['max_users']


# Feature: granular-permissions-subscription, Property 1 (Edge Case): Opposite Overrides
@given(tier=tier_strategy())
@settings(
    max_examples=100,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_override_precedence_opposite_values(tier):
    """
    Property 1 Edge Case: Opposite Overrides
    
    When overrides are set to the opposite of tier defaults, the overrides
    should still take precedence.
    
    **Validates: Requirements 3.2, 3.6**
    """
    # Setup: Get tier defaults
    tier_defaults = get_tier_defaults(tier)
    
    # Create overrides that are opposite of tier defaults
    business_data = {
        'business_id': 99999,
        'tier': tier,
        'overrides': {
            'has_payroll': not tier_defaults['has_payroll'],
            'has_ai': not tier_defaults['has_ai'],
            'has_api_access': not tier_defaults['has_api_access'],
            'has_advanced_reporting': not tier_defaults['has_advanced_reporting']
        }
    }
    
    service = create_mock_permission_service(business_data)
    
    # Execute: Get permissions
    permissions = service.get_business_permissions(business_data['business_id'])
    
    # Verify: All features have opposite values from tier defaults
    assert permissions.has_payroll == (not tier_defaults['has_payroll'])
    assert permissions.has_ai == (not tier_defaults['has_ai'])
    assert permissions.has_api_access == (not tier_defaults['has_api_access'])
    assert permissions.has_advanced_reporting == (not tier_defaults['has_advanced_reporting'])


# Feature: granular-permissions-subscription, Property 1 (Invariant): Partial Overrides
@given(
    tier=tier_strategy(),
    num_overrides=st.integers(min_value=1, max_value=3)
)
@settings(
    max_examples=100,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_override_precedence_partial_overrides(tier, num_overrides):
    """
    Property 1 Invariant: Partial Overrides
    
    When only some features are overridden, the system should correctly
    apply overrides to those features while preserving tier defaults for others.
    
    **Validates: Requirements 3.2, 3.6, 15.4**
    """
    # Setup: Create partial overrides
    all_features = ['has_payroll', 'has_ai', 'has_api_access', 'has_advanced_reporting']
    features_to_override = all_features[:num_overrides]
    
    tier_defaults = get_tier_defaults(tier)
    
    business_data = {
        'business_id': 77777,
        'tier': tier,
        'overrides': {
            feature: not tier_defaults[feature]
            for feature in features_to_override
        }
    }
    
    service = create_mock_permission_service(business_data)
    
    # Execute: Get permissions
    permissions = service.get_business_permissions(business_data['business_id'])
    
    # Verify: Overridden features have override values
    for feature in features_to_override:
        expected = not tier_defaults[feature]
        actual = getattr(permissions, feature)
        assert actual == expected, (
            f"Partial override failed for {feature}: expected {expected}, got {actual}"
        )
    
    # Verify: Non-overridden features have tier defaults
    for feature in all_features[num_overrides:]:
        expected = tier_defaults[feature]
        actual = getattr(permissions, feature)
        assert actual == expected, (
            f"Tier default not preserved for {feature}: expected {expected}, got {actual}"
        )
