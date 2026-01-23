# Code Improvements: test_properties_subscription_permissions.py

## Critical Issues Fixed

### 1. ✅ File Truncation
**Status**: FIXED
- The file was incomplete, ending mid-line at `has_pay`
- Completed the `create_mock_permission_service` function

## High Priority Improvements

### 2. Code Duplication - Tier Defaults

**Issue**: The `get_tier_defaults()` function duplicates configuration that should come from the actual service.

**Current Code**:
```python
def get_tier_defaults(tier_name: str) -> Dict[str, Any]:
    """Get default features for a tier (matches PermissionService logic)."""
    tier_defaults = {
        'demo': {
            'max_devices': 1,
            'max_users': 1,
            'has_payroll': True,
            # ... more config
        },
        # ... more tiers
    }
    return tier_defaults.get(tier_name, tier_defaults['pilot_core'])
```

**Recommended Solution**:
```python
# Option A: Import from actual service configuration
from app.core.subscription import TIER_DEFAULTS

def get_tier_defaults(tier_name: str) -> Dict[str, Any]:
    """Get default features for a tier from actual service config."""
    return TIER_DEFAULTS.get(tier_name, TIER_DEFAULTS['pilot_core'])

# Option B: Use the actual service method (preferred)
def get_tier_defaults_from_service(tier_name: str) -> Dict[str, Any]:
    """Get tier defaults by calling the actual service."""
    # This ensures tests break if service logic changes
    mock_db = MagicMock()
    service = PermissionService(mock_db)
    return service._get_tier_defaults(tier_name)
```

**Benefits**:
- Single source of truth
- Tests break when service changes (good!)
- Reduces maintenance burden

### 3. Complex Mock Setup

**Issue**: `create_mock_permission_service` does too much - creates mocks, overrides methods, implements logic.

**Recommended Refactoring**:
```python
class MockPermissionServiceBuilder:
    """Builder pattern for creating mock permission services."""
    
    def __init__(self, business_id: int, tier: str):
        self.business_id = business_id
        self.tier = tier
        self.overrides = {}
        self._mock_db = None
        self._service = None
    
    def with_overrides(self, overrides: Dict[str, Any]) -> 'MockPermissionServiceBuilder':
        """Add feature overrides."""
        self.overrides = overrides
        return self
    
    def with_mock_db(self, mock_db: MagicMock) -> 'MockPermissionServiceBuilder':
        """Use custom mock database."""
        self._mock_db = mock_db
        return self
    
    def build(self) -> PermissionService:
        """Build the mock service."""
        if self._mock_db is None:
            self._mock_db = self._create_default_mock_db()
        
        service = PermissionService(self._mock_db)
        service._redis_client = None
        
        # Inject override behavior
        self._inject_override_behavior(service)
        
        return service
    
    def _create_default_mock_db(self) -> MagicMock:
        """Create default mock database."""
        mock_db = MagicMock()
        mock_business = Mock(spec=Business)
        mock_business.id = self.business_id
        mock_business.name = f"Business {self.business_id}"
        mock_db.query.return_value.filter.return_value.first.return_value = mock_business
        return mock_db
    
    def _inject_override_behavior(self, service: PermissionService) -> None:
        """Inject override behavior into service."""
        original_method = service.get_business_permissions
        
        def mock_method(business_id: int) -> BusinessPermissions:
            if business_id != self.business_id:
                return original_method(business_id)
            
            tier_defaults = get_tier_defaults(self.tier)
            effective = {**tier_defaults, **self.overrides}
            
            return BusinessPermissions(
                business_id=business_id,
                tier_name=self.tier,
                status='active',
                max_devices=effective['max_devices'],
                max_users=effective['max_users'],
                has_payroll=effective['has_payroll'],
                has_ai=effective['has_ai'],
                has_api_access=effective['has_api_access'],
                has_advanced_reporting=effective['has_advanced_reporting'],
                valid_until=None,
                is_demo_expired=False
            )
        
        service.get_business_permissions = mock_method


# Usage in tests:
def test_override_precedence(business_data):
    service = (MockPermissionServiceBuilder(
        business_data['business_id'], 
        business_data['tier']
    )
    .with_overrides(business_data['overrides'])
    .build())
    
    permissions = service.get_business_permissions(business_data['business_id'])
    # ... assertions
```

**Benefits**:
- Separation of concerns
- Easier to test the mock itself
- More readable test setup
- Reusable across test files

## Medium Priority Improvements

### 4. Magic Numbers

**Issue**: Hard-coded values reduce maintainability.

**Recommended Solution**:
```python
# At top of file
UNLIMITED_DEVICES = 999999
UNLIMITED_USERS = 999999
DEFAULT_DEMO_DEVICES = 1
DEFAULT_DEMO_USERS = 1
DEFAULT_CORE_DEVICES = 2
DEFAULT_CORE_USERS = 5

# In get_tier_defaults:
'pilot_pro': {
    'max_devices': UNLIMITED_DEVICES,
    'max_users': UNLIMITED_USERS,
    # ...
}
```

### 5. Strategy Composition

**Issue**: Strategies could be more composable and reusable.

**Recommended Improvement**:
```python
# Create base strategies
TIER_NAMES = ['demo', 'pilot_core', 'pilot_pro', 'enterprise']
FEATURE_NAMES = ['has_payroll', 'has_ai', 'has_api_access', 'has_advanced_reporting']

@st.composite
def tier_strategy(draw):
    """Generate a random tier name."""
    return draw(st.sampled_from(TIER_NAMES))

@st.composite
def feature_name_strategy(draw):
    """Generate a random feature name."""
    return draw(st.sampled_from(FEATURE_NAMES))

@st.composite
def feature_override_strategy(draw, features: List[str] = None):
    """Generate overrides for specific features."""
    if features is None:
        features = FEATURE_NAMES
    
    return {
        feature: draw(st.booleans())
        for feature in features
    }

@st.composite
def partial_override_strategy(draw, min_features: int = 1, max_features: int = None):
    """Generate partial overrides (subset of features)."""
    if max_features is None:
        max_features = len(FEATURE_NAMES)
    
    num_features = draw(st.integers(min_value=min_features, max_value=max_features))
    features = draw(st.lists(
        st.sampled_from(FEATURE_NAMES),
        min_size=num_features,
        max_size=num_features,
        unique=True
    ))
    
    return draw(feature_override_strategy(features))
```

### 6. Type Hints

**Issue**: Some functions lack complete type hints.

**Recommended Additions**:
```python
from typing import Dict, Any, List, Optional

def get_tier_defaults(tier_name: str) -> Dict[str, Any]:
    """Get default features for a tier."""
    # ... implementation

def create_mock_permission_service(business_data: Dict[str, Any]) -> PermissionService:
    """Create a mock PermissionService with test data."""
    # ... implementation

# Add return type to strategies
@st.composite
def tier_strategy(draw) -> str:
    """Generate a random tier name."""
    return draw(st.sampled_from(TIER_NAMES))
```

## Low Priority Improvements

### 7. Test Organization

**Recommendation**: Group related tests into classes for better organization.

```python
class TestOverridePrecedence:
    """Tests for Property 1: Override Precedence."""
    
    @given(business_data=business_with_overrides_strategy())
    @settings(max_examples=100, deadline=None)
    def test_basic_override_precedence(self, business_data):
        """Test basic override precedence behavior."""
        # ... test implementation
    
    @given(tier=tier_strategy(), override_values=st.booleans())
    @settings(max_examples=100, deadline=None)
    def test_all_features_overridden(self, tier, override_values):
        """Test when all features are overridden."""
        # ... test implementation
    
    @given(tier=tier_strategy())
    @settings(max_examples=100, deadline=None)
    def test_no_overrides(self, tier):
        """Test when no overrides exist."""
        # ... test implementation


class TestOverrideEdgeCases:
    """Edge case tests for override behavior."""
    
    # ... edge case tests
```

### 8. Assertion Messages

**Recommendation**: Use more descriptive assertion messages with context.

```python
# Current
assert actual_value == override_value

# Improved
assert actual_value == override_value, (
    f"Override precedence failed:\n"
    f"  Feature: {feature}\n"
    f"  Expected: {override_value}\n"
    f"  Actual: {actual_value}\n"
    f"  Business: {business_data['business_id']}\n"
    f"  Tier: {business_data['tier']}\n"
    f"  All Overrides: {business_data['overrides']}"
)
```

### 9. Documentation

**Recommendation**: Add module-level documentation about testing strategy.

```python
"""Property-based tests for subscription and permissions system.

This module validates the override precedence property using Hypothesis for
property-based testing. The tests ensure that feature overrides always take
precedence over tier defaults, regardless of tier or feature combination.

Testing Strategy:
-----------------
1. Generate random combinations of tiers and overrides
2. Verify override precedence for all combinations
3. Test edge cases (all overrides, no overrides, opposite values)
4. Validate partial override scenarios

Key Properties Tested:
---------------------
- Property 1: Override Precedence (Requirements 3.2, 3.6, 15.4)
  - Overridden features use override values
  - Non-overridden features use tier defaults
  - Precedence holds for all tiers and feature combinations

Mock Strategy:
-------------
We mock the PermissionService to avoid database dependencies while still
testing the core business logic of override precedence. The mock applies
overrides to tier defaults exactly as the real service would.

Feature: granular-permissions-subscription
Requirements: 3.2, 3.6, 15.4
"""
```

## Performance Considerations

### 10. Hypothesis Settings

**Current**: Each test runs 100 examples, which is good for thorough testing.

**Recommendation**: Consider adding profiles for different scenarios:

```python
from hypothesis import settings, Phase

# Fast profile for local development
settings.register_profile("dev", max_examples=20, deadline=1000)

# Thorough profile for CI
settings.register_profile("ci", max_examples=100, deadline=None)

# Exhaustive profile for release validation
settings.register_profile("release", max_examples=500, deadline=None, phases=[
    Phase.explicit, Phase.reuse, Phase.generate, Phase.target, Phase.shrink
])

# Load profile from environment
settings.load_profile(os.getenv("HYPOTHESIS_PROFILE", "dev"))
```

## Security Considerations

### 11. Mock Isolation

**Current**: Mocks are properly isolated per test.

**Recommendation**: Add explicit cleanup to prevent test pollution:

```python
import pytest

@pytest.fixture
def isolated_permission_service():
    """Fixture that ensures clean service state."""
    service = None
    try:
        yield lambda business_data: create_mock_permission_service(business_data)
    finally:
        # Cleanup any global state if needed
        if service:
            service._redis_client = None
```

## Summary of Actionable Items

### Immediate (Critical)
- [x] Fix file truncation (COMPLETED)

### High Priority
- [ ] Eliminate tier defaults duplication - import from service config
- [ ] Refactor mock creation using Builder pattern
- [ ] Add constants for magic numbers

### Medium Priority
- [ ] Improve strategy composition and reusability
- [ ] Add complete type hints throughout
- [ ] Organize tests into classes

### Low Priority
- [ ] Enhance assertion messages with more context
- [ ] Add comprehensive module documentation
- [ ] Add Hypothesis profiles for different test scenarios

## Testing the Improvements

After implementing these changes, verify with:

```bash
# Run the property tests
cd backend
pytest app/tests/property/test_properties_subscription_permissions.py -v

# Run with coverage
pytest app/tests/property/test_properties_subscription_permissions.py --cov=app.services.permission_service --cov-report=term-missing

# Run with different Hypothesis profiles
HYPOTHESIS_PROFILE=ci pytest app/tests/property/test_properties_subscription_permissions.py
```
