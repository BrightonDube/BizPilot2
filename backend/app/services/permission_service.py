"""Permission service for checking feature access and managing permissions.

Feature: granular-permissions-subscription
Task: 2.1 Implement PermissionService (without caching)
Task: 4.2 Integrate caching into PermissionService
Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 4.1, 4.2, 5.1, 5.2, 5.3, 5.4, 5.5, 6.7, 17.1, 17.2, 17.3
"""

from datetime import datetime, timezone
from typing import Optional
import inspect
import json
import logging
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis

from app.models.subscription import (
    TierFeature,
    BusinessSubscription,
    FeatureOverride,
)

logger = logging.getLogger(__name__)


class PermissionService:
    """
    Service for checking feature access and managing permissions.
    
    This service implements the core permission checking logic:
    1. SuperAdmin bypass (always grants access)
    2. Demo mode (grants all features until expiry)
    3. Feature overrides (SuperAdmin custom configurations)
    4. Tier-based features (default access based on subscription tier)
    5. Redis caching for performance (<10ms cached checks)
    
    Validates: Requirements 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 4.1, 4.2, 5.1, 5.2, 5.3, 5.4, 5.5, 6.7, 17.1, 17.2, 17.3
    """
    
    # Cache TTL: 5 minutes (matches frontend staleTime)
    CACHE_TTL_SECONDS = 300
    
    def __init__(self, db: AsyncSession, redis: Optional[Redis] = None):
        """
        Initialize PermissionService.
        
        Args:
            db: Async database session
            redis: Optional Redis client for caching
        """
        self.db = db
        self.redis = redis
    
    async def check_feature(
        self,
        business_id: UUID,
        feature_name: str,
        is_superadmin: bool = False
    ) -> bool:
        """
        Check if a business has access to a specific feature.
        
        Logic:
        1. If is_superadmin, return True (bypass) - Requirement 6.7
        2. Check Redis cache for permissions - Requirement 5.1
        3. If cached, check feature in cached set - Requirement 5.2
        4. If not cached, load from DB and cache - Requirements 5.3, 5.4
        5. Check if feature is in granted features set
        
        Args:
            business_id: Business UUID
            feature_name: Feature to check (e.g., "has_payroll", "has_ai")
            is_superadmin: Whether the requesting user is a SuperAdmin
        
        Returns:
            True if feature is granted, False otherwise
        
        Validates: Requirements 1.1, 1.2, 2.2, 2.3, 2.4, 4.1, 5.1, 5.2, 5.3, 5.4, 6.7
        """
        # SuperAdmin bypass - Requirement 6.7
        if is_superadmin:
            return True
        
        # Try to get from cache first - Requirement 5.1
        cache_key = self._get_cache_key(business_id)
        cached_permissions = await self._get_from_cache(cache_key)
        
        if cached_permissions is not None:
            # Cache hit - Requirement 5.2
            granted_features = set(cached_permissions.get("granted_features", []))
            return feature_name in granted_features
        
        # Cache miss - load from database - Requirement 5.3
        granted_features = await self._load_permissions_from_db(business_id)
        
        # Cache the result - Requirement 5.4
        await self._set_in_cache(cache_key, granted_features, business_id)
        
        # Check if feature is granted
        return feature_name in granted_features
    
    async def get_business_permissions(
        self,
        business_id: UUID
    ) -> dict:
        """
        Get all permissions for a business.
        
        Returns complete permission data including granted features,
        tier, status, demo expiry, and device limit.
        
        Args:
            business_id: Business UUID
        
        Returns:
            Dictionary with:
            - granted_features: List of granted feature names
            - tier: Current subscription tier name
            - status: Subscription status
            - demo_expires_at: Demo expiry datetime (or None)
            - device_limit: Maximum devices allowed
        
        Validates: Requirements 1.1, 1.2, 2.1, 4.1, 4.2
        """
        # Load subscription
        subscription = await self._load_subscription(business_id)
        
        if not subscription:
            # No subscription found - return empty permissions
            return {
                "granted_features": [],
                "tier": "none",
                "status": "inactive",
                "demo_expires_at": None,
                "device_limit": 0
            }
        
        # Load granted features
        granted_features = await self._load_permissions_from_db(business_id)
        
        # Get device limit from tier or subscription override
        device_limit = await self._get_device_limit(business_id, subscription)
        
        return {
            "granted_features": list(granted_features),
            "tier": subscription.tier_name,
            "status": subscription.status,
            "demo_expires_at": subscription.valid_until,
            "device_limit": device_limit
        }
    
    async def _load_subscription(
        self,
        business_id: UUID
    ) -> Optional[BusinessSubscription]:
        """
        Load subscription for a business.
        
        Args:
            business_id: Business UUID
        
        Returns:
            BusinessSubscription or None if not found
        """
        result = self.db.execute(
            select(BusinessSubscription)
            .where(BusinessSubscription.business_id == business_id)
        )
        if inspect.isawaitable(result):
            result = await result
        return result.scalar_one_or_none()
    
    async def _load_permissions_from_db(
        self,
        business_id: UUID
    ) -> set[str]:
        """
        Load permissions from database.
        
        Logic:
        1. Load subscription (tier, status, demo_expires_at)
        2. If demo active and not expired, return all features - Requirement 4.1
        3. If status not active, return empty set - Requirement 2.1
        4. Load tier features - Requirement 1.1
        5. Load overrides and apply - Requirements 2.2, 2.3, 2.4
        6. Return final feature set
        
        Args:
            business_id: Business UUID
        
        Returns:
            Set of granted feature names
        
        Validates: Requirements 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 4.1, 4.2
        """
        # Load subscription
        subscription = await self._load_subscription(business_id)
        
        if not subscription:
            return set()
        
        # Check if demo mode is active - Requirement 4.1
        if await self._is_demo_active(subscription):
            # Demo mode grants all features
            return await self._get_all_features()
        
        # Check subscription status - Requirement 2.1
        if subscription.status != "active":
            return set()
        
        # Load tier features - Requirement 1.1
        tier_features = await self._load_tier_features(subscription.tier_name)
        
        # Load and apply overrides - Requirements 2.2, 2.3, 2.4
        overrides = await self._load_overrides(business_id)
        
        # Apply overrides to tier features
        final_features = self._apply_overrides(tier_features, overrides)
        
        return final_features
    
    async def _is_demo_active(
        self,
        subscription: BusinessSubscription
    ) -> bool:
        """
        Check if demo mode is active for a subscription.
        
        Demo is active if:
        - Tier is 'demo'
        - valid_until is set and in the future
        
        Args:
            subscription: BusinessSubscription instance
        
        Returns:
            True if demo is active, False otherwise
        
        Validates: Requirement 4.1, 4.2
        """
        if subscription.tier_name != "demo":
            return False
        
        if not subscription.valid_until:
            return False
        
        # Check if demo has expired
        now = datetime.now(timezone.utc)
        return subscription.valid_until > now
    
    async def _get_all_features(self) -> set[str]:
        """
        Get all available features (for demo mode).
        
        Returns:
            Set of all feature names
        
        Validates: Requirement 4.1
        """
        # Return all boolean feature flags
        return {
            "has_payroll",
            "has_ai",
            "has_api_access",
            "has_advanced_reporting",
            "has_multi_location",
            "has_loyalty_programs",
            "has_recipe_management",
            "has_accounting_integration"
        }
    
    async def _load_tier_features(
        self,
        tier_name: str
    ) -> set[str]:
        """
        Load features for a subscription tier.
        
        Args:
            tier_name: Tier name (demo, pilot_core, pilot_pro, enterprise)
        
        Returns:
            Set of granted feature names for the tier
        
        Validates: Requirement 1.1
        """
        # Load tier configuration
        result = self.db.execute(
            select(TierFeature)
            .where(TierFeature.tier_name == tier_name)
        )
        if inspect.isawaitable(result):
            result = await result
        tier = result.scalar_one_or_none()
        
        if not tier:
            return set()
        
        # Build feature set from boolean flags
        features = set()
        
        if tier.has_payroll:
            features.add("has_payroll")
        if tier.has_ai:
            features.add("has_ai")
        if tier.has_api_access:
            features.add("has_api_access")
        if tier.has_advanced_reporting:
            features.add("has_advanced_reporting")
        if tier.has_multi_location:
            features.add("has_multi_location")
        if tier.has_loyalty_programs:
            features.add("has_loyalty_programs")
        if tier.has_recipe_management:
            features.add("has_recipe_management")
        if tier.has_accounting_integration:
            features.add("has_accounting_integration")
        
        return features
    
    async def _load_overrides(
        self,
        business_id: UUID
    ) -> list[FeatureOverride]:
        """
        Load feature overrides for a business.
        
        Args:
            business_id: Business UUID
        
        Returns:
            List of FeatureOverride instances
        
        Validates: Requirements 2.2, 2.3
        """
        result = self.db.execute(
            select(FeatureOverride)
            .where(FeatureOverride.business_id == business_id)
        )
        if inspect.isawaitable(result):
            result = await result
        return list(result.scalars().all())
    
    def _apply_overrides(
        self,
        tier_features: set[str],
        overrides: list[FeatureOverride]
    ) -> set[str]:
        """
        Apply feature overrides to tier features.
        
        Overrides take precedence over tier defaults:
        - If override value is 'true', add feature to set
        - If override value is 'false', remove feature from set
        
        Args:
            tier_features: Set of features from tier
            overrides: List of FeatureOverride instances
        
        Returns:
            Final set of granted features
        
        Validates: Requirements 2.2, 2.3, 2.4
        """
        # Start with tier features
        final_features = tier_features.copy()
        
        # Apply each override
        for override in overrides:
            feature_name = override.feature_name
            feature_value = override.feature_value.lower()
            
            # Only process boolean feature flags (not limits like max_devices)
            if not feature_name.startswith("has_"):
                continue
            
            if feature_value == "true":
                # Grant feature
                final_features.add(feature_name)
            elif feature_value == "false":
                # Revoke feature
                final_features.discard(feature_name)
        
        return final_features
    
    async def _get_device_limit(
        self,
        business_id: UUID,
        subscription: BusinessSubscription
    ) -> int:
        """
        Get device limit for a business.
        
        Checks for override first, then falls back to tier default.
        
        Args:
            business_id: Business UUID
            subscription: BusinessSubscription instance
        
        Returns:
            Device limit (integer, or 999999 for unlimited)
        
        Validates: Requirements 3.1, 3.2
        """
        # Check for max_devices override
        result = self.db.execute(
            select(FeatureOverride)
            .where(
                FeatureOverride.business_id == business_id,
                FeatureOverride.feature_name == "max_devices"
            )
        )
        if inspect.isawaitable(result):
            result = await result
        override = result.scalar_one_or_none()
        
        if override:
            # Use override value
            try:
                return int(override.feature_value)
            except ValueError:
                pass  # Fall through to tier default
        
        # Load tier default
        result = self.db.execute(
            select(TierFeature)
            .where(TierFeature.tier_name == subscription.tier_name)
        )
        if inspect.isawaitable(result):
            result = await result
        tier = result.scalar_one_or_none()
        
        if tier and tier.max_devices is not None:
            return tier.max_devices
        
        # NULL in database means unlimited - return large number
        return 999999
    
    def _get_cache_key(self, business_id: UUID) -> str:
        """
        Generate cache key for business permissions.
        
        Format: permissions:{business_id}
        
        Args:
            business_id: Business UUID
        
        Returns:
            Cache key string
        
        Validates: Requirement 17.1
        """
        return f"permissions:{str(business_id)}"
    
    async def _get_from_cache(self, cache_key: str) -> Optional[dict]:
        """
        Get permissions from Redis cache.
        
        Args:
            cache_key: Cache key
        
        Returns:
            Cached permissions dict or None if not cached/unavailable
        
        Validates: Requirements 5.1, 5.2, 17.4
        """
        if not self.redis:
            # Redis unavailable - fallback to database
            return None
        
        try:
            cached_data = await self.redis.get(cache_key)
            if cached_data:
                return json.loads(cached_data)
        except Exception as e:
            logger.warning(f"Redis GET failed for {cache_key}: {e}")
        
        return None
    
    async def _set_in_cache(
        self,
        cache_key: str,
        granted_features: set[str],
        business_id: UUID
    ) -> None:
        """
        Store permissions in Redis cache.
        
        Args:
            cache_key: Cache key
            granted_features: Set of granted feature names
            business_id: Business UUID
        
        Validates: Requirements 5.3, 5.4, 17.2
        """
        if not self.redis:
            # Redis unavailable - skip caching
            return
        
        try:
            # Load full permission data for caching
            subscription = await self._load_subscription(business_id)
            device_limit = await self._get_device_limit(business_id, subscription) if subscription else 0
            
            cache_data = {
                "granted_features": list(granted_features),
                "tier": subscription.tier_name if subscription else "none",
                "status": subscription.status if subscription else "inactive",
                "demo_expires_at": subscription.valid_until.isoformat() if subscription and subscription.valid_until else None,
                "device_limit": device_limit
            }
            
            await self.redis.setex(
                cache_key,
                self.CACHE_TTL_SECONDS,
                json.dumps(cache_data)
            )
        except Exception as e:
            logger.warning(f"Redis SET failed for {cache_key}: {e}")
    
    async def invalidate_cache(self, business_id: UUID) -> None:
        """
        Invalidate Redis cache for a business.
        
        Called after subscription or override changes to ensure
        next permission check reflects updated data.
        
        Args:
            business_id: Business UUID
        
        Validates: Requirements 5.5, 17.3
        """
        if not self.redis:
            # Redis unavailable - nothing to invalidate
            return
        
        try:
            cache_key = self._get_cache_key(business_id)
            await self.redis.delete(cache_key)
            logger.info(f"Cache invalidated for business {business_id}")
        except Exception as e:
            logger.warning(f"Redis DELETE failed for business {business_id}: {e}")
