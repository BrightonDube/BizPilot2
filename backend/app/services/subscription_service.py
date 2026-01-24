"""Subscription service for managing business subscriptions and feature overrides.

This service handles:
- Creating and updating subscriptions
- Managing feature overrides
- Reactivating subscriptions
- Audit logging for all changes
- Cache invalidation after changes

Feature: granular-permissions-subscription
Task: 2.6 Implement SubscriptionService
Task: 4.3 Add cache invalidation to SubscriptionService
Requirements: 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 12.5, 17.3
"""

from datetime import datetime, timezone
from typing import Optional, Dict, Any, TYPE_CHECKING
from uuid import UUID
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

if TYPE_CHECKING:
    from redis.asyncio import Redis

from app.models.subscription import (
    BusinessSubscription,
    FeatureOverride,
    AuditLog,
)
from app.services.permission_service import PermissionService


class SubscriptionService:
    """
    Service for managing business subscriptions and feature overrides.
    
    This service implements subscription lifecycle management:
    - create_subscription: Create new subscriptions
    - update_subscription: Update tier, status, device limits
    - add_feature_override: Grant/deny specific features
    - remove_feature_override: Remove custom feature configurations
    - reactivate_subscription: Restore cancelled/suspended subscriptions
    
    All methods include audit logging and cache invalidation.
    
    Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 12.5
    """
    
    def __init__(self, db: AsyncSession, redis: Optional['Redis'] = None):
        """
        Initialize subscription service with database session.
        
        Args:
            db: Async database session
            redis: Optional Redis client for cache invalidation
        """
        self.db = db
        self.redis = redis
        self.permission_service = PermissionService(db, redis)
    
    async def create_subscription(
        self,
        business_id: UUID,
        tier_name: str,
        device_limit: Optional[int] = None,
        demo_expires_at: Optional[datetime] = None,
        admin_user_id: Optional[UUID] = None
    ) -> BusinessSubscription:
        """
        Create a new subscription for a business.
        
        Algorithm:
        1. Validate tier_name is valid
        2. Create BusinessSubscription record
        3. Commit transaction
        4. Log audit entry
        5. Return created subscription
        
        Args:
            business_id: Business UUID
            tier_name: Subscription tier (demo, pilot_core, pilot_pro, enterprise)
            device_limit: Optional device limit override (uses tier default if None)
            demo_expires_at: Demo expiry date (only for demo tier)
            admin_user_id: SuperAdmin user ID for audit logging
            
        Returns:
            Created BusinessSubscription instance
            
        Raises:
            ValueError: If tier_name is invalid or subscription already exists
            
        Validates: Requirement 6.1
        """
        # Validate tier name
        valid_tiers = ['demo', 'pilot_core', 'pilot_pro', 'enterprise']
        if tier_name not in valid_tiers:
            raise ValueError(
                f"Invalid tier name '{tier_name}'. "
                f"Must be one of: {', '.join(valid_tiers)}"
            )
        
        # Check if subscription already exists
        existing = await self.db.execute(
            select(BusinessSubscription)
            .where(BusinessSubscription.business_id == business_id)
        )
        if existing.scalar_one_or_none():
            raise ValueError(f"Subscription already exists for business {business_id}")
        
        # Create subscription
        subscription = BusinessSubscription(
            business_id=business_id,
            tier_name=tier_name,
            status='active',
            valid_until=demo_expires_at if tier_name == 'demo' else None,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        
        self.db.add(subscription)
        await self.db.commit()
        await self.db.refresh(subscription)
        
        # Log audit entry
        if admin_user_id:
            await self._log_audit(
                admin_user_id=admin_user_id,
                business_id=business_id,
                action='subscription_created',
                changes={
                    'tier_name': tier_name,
                    'status': 'active',
                    'demo_expires_at': demo_expires_at.isoformat() if demo_expires_at else None
                }
            )
        
        return subscription
    
    async def update_subscription(
        self,
        subscription_id: int,
        tier_name: Optional[str] = None,
        status: Optional[str] = None,
        device_limit: Optional[int] = None,
        demo_expires_at: Optional[datetime] = None,
        admin_user_id: Optional[UUID] = None
    ) -> BusinessSubscription:
        """
        Update subscription and invalidate cache.
        
        Algorithm:
        1. Load existing subscription
        2. Update provided fields
        3. Save to database
        4. Invalidate cache for business_id
        5. Log to audit_logs
        6. Return updated subscription
        
        Args:
            subscription_id: Subscription ID to update
            tier_name: New tier name (optional)
            status: New status (optional)
            device_limit: New device limit (optional, stored as override)
            demo_expires_at: New demo expiry date (optional)
            admin_user_id: SuperAdmin user ID for audit logging
            
        Returns:
            Updated BusinessSubscription instance
            
        Raises:
            ValueError: If subscription not found or invalid values provided
            
        Validates: Requirement 6.2
        """
        # Load existing subscription
        result = await self.db.execute(
            select(BusinessSubscription)
            .where(BusinessSubscription.id == subscription_id)
        )
        subscription = result.scalar_one_or_none()
        
        if not subscription:
            raise ValueError(f"Subscription {subscription_id} not found")
        
        # Track changes for audit log
        changes = {}
        
        # Update tier_name if provided
        if tier_name is not None:
            valid_tiers = ['demo', 'pilot_core', 'pilot_pro', 'enterprise']
            if tier_name not in valid_tiers:
                raise ValueError(
                    f"Invalid tier name '{tier_name}'. "
                    f"Must be one of: {', '.join(valid_tiers)}"
                )
            changes['tier_name'] = {'old': subscription.tier_name, 'new': tier_name}
            subscription.tier_name = tier_name
        
        # Update status if provided
        if status is not None:
            valid_statuses = ['active', 'suspended', 'cancelled', 'expired']
            if status not in valid_statuses:
                raise ValueError(
                    f"Invalid status '{status}'. "
                    f"Must be one of: {', '.join(valid_statuses)}"
                )
            changes['status'] = {'old': subscription.status, 'new': status}
            subscription.status = status
        
        # Update demo_expires_at if provided
        if demo_expires_at is not None:
            changes['demo_expires_at'] = {
                'old': subscription.valid_until.isoformat() if subscription.valid_until else None,
                'new': demo_expires_at.isoformat()
            }
            subscription.valid_until = demo_expires_at
        
        # Update device_limit as override if provided
        if device_limit is not None:
            changes['device_limit'] = {'new': device_limit}
            # Store as feature override
            await self.add_feature_override(
                business_id=subscription.business_id,
                feature_name='max_devices',
                granted=True,
                feature_value=str(device_limit),
                admin_user_id=admin_user_id
            )
        
        # Update timestamp
        subscription.updated_at = datetime.now(timezone.utc)
        
        # Commit changes
        await self.db.commit()
        await self.db.refresh(subscription)
        
        # Invalidate cache - Requirement 5.5, 17.3
        await self.permission_service.invalidate_cache(subscription.business_id)
        
        # Log audit entry
        if admin_user_id and changes:
            await self._log_audit(
                admin_user_id=admin_user_id,
                business_id=subscription.business_id,
                action='subscription_updated',
                changes=changes
            )
        
        return subscription
    
    async def add_feature_override(
        self,
        business_id: UUID,
        feature_name: str,
        granted: bool,
        feature_value: Optional[str] = None,
        admin_user_id: Optional[UUID] = None
    ) -> FeatureOverride:
        """
        Add or update a feature override and invalidate cache.
        
        Algorithm:
        1. Validate feature_name
        2. Check if override exists
        3. If exists, update; if not, create
        4. Commit transaction
        5. Invalidate cache
        6. Log audit entry
        7. Return override
        
        Args:
            business_id: Business UUID
            feature_name: Feature to override
            granted: Whether feature is granted (for boolean features)
            feature_value: Override value (for non-boolean features like max_devices)
            admin_user_id: SuperAdmin user ID for audit logging
            
        Returns:
            FeatureOverride instance
            
        Raises:
            ValueError: If feature_name is invalid
            
        Validates: Requirement 6.3
        """
        # Validate feature name
        valid_features = [
            'max_devices', 'max_users', 'max_orders_per_month', 'max_terminals',
            'has_payroll', 'has_ai', 'has_api_access', 'has_advanced_reporting',
            'has_multi_location', 'has_loyalty_programs', 'has_recipe_management',
            'has_accounting_integration'
        ]
        if feature_name not in valid_features:
            raise ValueError(
                f"Invalid feature name '{feature_name}'. "
                f"Must be one of: {', '.join(valid_features)}"
            )
        
        # Determine feature value
        if feature_value is None:
            # For boolean features, use granted parameter
            feature_value = 'true' if granted else 'false'
        
        # Check if override exists
        result = await self.db.execute(
            select(FeatureOverride)
            .where(
                and_(
                    FeatureOverride.business_id == business_id,
                    FeatureOverride.feature_name == feature_name
                )
            )
        )
        override = result.scalar_one_or_none()
        
        if override:
            # Update existing override
            old_value = override.feature_value
            override.feature_value = feature_value
            override.created_by = admin_user_id if admin_user_id else override.created_by
            override.created_at = datetime.now(timezone.utc)
            action = 'override_updated'
            changes = {
                'feature_name': feature_name,
                'old_value': old_value,
                'new_value': feature_value
            }
        else:
            # Create new override
            if not admin_user_id:
                raise ValueError("admin_user_id is required when creating new override")
            
            override = FeatureOverride(
                business_id=business_id,
                feature_name=feature_name,
                feature_value=feature_value,
                created_by=admin_user_id,
                created_at=datetime.now(timezone.utc)
            )
            self.db.add(override)
            action = 'override_added'
            changes = {
                'feature_name': feature_name,
                'value': feature_value
            }
        
        # Commit changes
        await self.db.commit()
        await self.db.refresh(override)
        
        # Invalidate cache - Requirement 5.5, 17.3
        await self.permission_service.invalidate_cache(business_id)
        
        # Log audit entry
        if admin_user_id:
            await self._log_audit(
                admin_user_id=admin_user_id,
                business_id=business_id,
                action=action,
                changes=changes
            )
        
        return override
    
    async def remove_feature_override(
        self,
        business_id: UUID,
        feature_name: str,
        admin_user_id: Optional[UUID] = None
    ) -> bool:
        """
        Remove a feature override and invalidate cache.
        
        Algorithm:
        1. Query for override
        2. If exists, delete it
        3. Commit transaction
        4. Invalidate cache
        5. Log audit entry
        6. Return True if deleted, False if not found
        
        Args:
            business_id: Business UUID
            feature_name: Feature override to remove
            admin_user_id: SuperAdmin user ID for audit logging
            
        Returns:
            True if override was removed, False if not found
            
        Validates: Requirement 6.4
        """
        # Query for override
        result = await self.db.execute(
            select(FeatureOverride)
            .where(
                and_(
                    FeatureOverride.business_id == business_id,
                    FeatureOverride.feature_name == feature_name
                )
            )
        )
        override = result.scalar_one_or_none()
        
        if not override:
            return False
        
        # Store value for audit log
        old_value = override.feature_value
        
        # Delete override
        await self.db.delete(override)
        await self.db.commit()
        
        # Invalidate cache - Requirement 5.5, 17.3
        await self.permission_service.invalidate_cache(business_id)
        
        # Log audit entry
        if admin_user_id:
            await self._log_audit(
                admin_user_id=admin_user_id,
                business_id=business_id,
                action='override_removed',
                changes={
                    'feature_name': feature_name,
                    'old_value': old_value
                }
            )
        
        return True
    
    async def reactivate_subscription(
        self,
        subscription_id: int,
        admin_user_id: Optional[UUID] = None
    ) -> BusinessSubscription:
        """
        Reactivate a cancelled/suspended/expired subscription.
        
        Algorithm:
        1. Load subscription
        2. Set status to 'active'
        3. Clear demo_expires_at if expired
        4. Commit transaction
        5. Invalidate cache
        6. Log audit entry
        7. Return updated subscription
        
        Args:
            subscription_id: Subscription ID to reactivate
            admin_user_id: SuperAdmin user ID for audit logging
            
        Returns:
            Updated BusinessSubscription instance
            
        Raises:
            ValueError: If subscription not found
            
        Validates: Requirement 12.5
        """
        # Load subscription
        result = await self.db.execute(
            select(BusinessSubscription)
            .where(BusinessSubscription.id == subscription_id)
        )
        subscription = result.scalar_one_or_none()
        
        if not subscription:
            raise ValueError(f"Subscription {subscription_id} not found")
        
        # Track changes
        old_status = subscription.status
        changes = {
            'status': {'old': old_status, 'new': 'active'}
        }
        
        # Update status
        subscription.status = 'active'
        
        # Clear demo_expires_at if it was expired
        if subscription.valid_until and subscription.valid_until < datetime.now(timezone.utc):
            changes['demo_expires_at'] = {
                'old': subscription.valid_until.isoformat(),
                'new': None
            }
            subscription.valid_until = None
        
        # Update timestamp
        subscription.updated_at = datetime.now(timezone.utc)
        
        # Commit changes
        await self.db.commit()
        await self.db.refresh(subscription)
        
        # Invalidate cache - Requirement 5.5, 17.3
        await self.permission_service.invalidate_cache(subscription.business_id)
        
        # Log audit entry
        if admin_user_id:
            await self._log_audit(
                admin_user_id=admin_user_id,
                business_id=subscription.business_id,
                action='subscription_reactivated',
                changes=changes
            )
        
        return subscription
    
    async def _log_audit(
        self,
        admin_user_id: UUID,
        business_id: UUID,
        action: str,
        changes: Dict[str, Any]
    ) -> None:
        """
        Log an audit entry for subscription changes.
        
        Args:
            admin_user_id: SuperAdmin user ID who made the change
            business_id: Business UUID affected by the change
            action: Action type (e.g., 'subscription_created', 'override_added')
            changes: Dictionary of changes made
            
        Validates: Requirement 6.5
        """
        audit_log = AuditLog(
            admin_user_id=admin_user_id,
            business_id=business_id,
            action=action,
            changes=changes,
            created_at=datetime.now(timezone.utc)
        )
        
        self.db.add(audit_log)
        await self.db.commit()
