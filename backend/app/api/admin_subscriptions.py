"""
SuperAdmin API endpoints for subscription management.

This module provides SuperAdmin-only endpoints for managing business subscriptions,
including creating subscriptions, updating tiers, managing feature overrides, and
reactivating subscriptions.

Feature: granular-permissions-subscription
Task: 7.1 Implement subscription management endpoints
Task: 7.2 Implement feature override endpoints
Requirements: 6.1, 6.2, 6.3, 6.4, 12.5
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import require_superadmin, get_db
from app.models.user import User
from app.models.subscription import BusinessSubscription
from app.schemas.subscription import (
    CreateSubscriptionRequest,
    UpdateSubscriptionRequest,
    FeatureOverrideRequest,
    BusinessSubscriptionSchema,
    FeatureOverrideSchema,
)
from app.services.subscription_service import SubscriptionService
from app.core.redis import get_redis

router = APIRouter(
    prefix="/admin/subscriptions",
    tags=["admin-subscriptions"],
    dependencies=[Depends(require_superadmin)]
)


@router.post("", response_model=BusinessSubscriptionSchema, status_code=status.HTTP_201_CREATED)
async def create_subscription(
    request: CreateSubscriptionRequest,
    current_user: User = Depends(require_superadmin),
    db=Depends(get_db),
    redis = Depends(get_redis)
):
    """
    Create a new subscription for a business.
    
    SuperAdmin only endpoint to create subscriptions with specified tier,
    device limits, and optional demo expiry dates.
    
    Args:
        request: Subscription creation parameters
        current_user: Authenticated SuperAdmin user
        db: Database session
        redis: Redis client for cache invalidation
    
    Returns:
        Created BusinessSubscription
    
    Raises:
        HTTPException 400: If tier is invalid or subscription already exists
        HTTPException 403: If user is not SuperAdmin
    
    Validates: Requirement 6.1
    """
    subscription_service = SubscriptionService(db, redis)
    
    try:
        subscription = await subscription_service.create_subscription(
            business_id=request.business_id,
            tier_name=request.tier_name,
            device_limit=request.device_limit,
            demo_expires_at=request.demo_expires_at,
            admin_user_id=current_user.id
        )
        
        return BusinessSubscriptionSchema.model_validate(subscription)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{subscription_id}", response_model=BusinessSubscriptionSchema)
async def update_subscription(
    subscription_id: int,
    request: UpdateSubscriptionRequest,
    current_user: User = Depends(require_superadmin),
    db=Depends(get_db),
    redis = Depends(get_redis)
):
    """
    Update an existing subscription.
    
    SuperAdmin only endpoint to update subscription tier, status, device limits,
    or demo expiry dates. All changes are logged to audit log and caches are
    invalidated.
    
    Args:
        subscription_id: ID of subscription to update
        request: Update parameters (all optional)
        current_user: Authenticated SuperAdmin user
        db: Database session
        redis: Redis client for cache invalidation
    
    Returns:
        Updated BusinessSubscription
    
    Raises:
        HTTPException 400: If invalid values provided
        HTTPException 404: If subscription not found
        HTTPException 403: If user is not SuperAdmin
    
    Validates: Requirement 6.2
    """
    subscription_service = SubscriptionService(db, redis)
    
    try:
        subscription = await subscription_service.update_subscription(
            subscription_id=subscription_id,
            tier_name=request.tier_name,
            status=request.status,
            device_limit=request.device_limit,
            demo_expires_at=request.demo_expires_at,
            admin_user_id=current_user.id
        )
        
        return BusinessSubscriptionSchema.model_validate(subscription)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{subscription_id}/reactivate", response_model=BusinessSubscriptionSchema)
async def reactivate_subscription(
    subscription_id: int,
    current_user: User = Depends(require_superadmin),
    db=Depends(get_db),
    redis = Depends(get_redis)
):
    """
    Reactivate a cancelled/suspended/expired subscription.
    
    SuperAdmin only endpoint to restore access for a business by setting
    subscription status to 'active' and clearing expired demo dates.
    
    Args:
        subscription_id: ID of subscription to reactivate
        current_user: Authenticated SuperAdmin user
        db: Database session
        redis: Redis client for cache invalidation
    
    Returns:
        Reactivated BusinessSubscription
    
    Raises:
        HTTPException 404: If subscription not found
        HTTPException 403: If user is not SuperAdmin
    
    Validates: Requirement 12.5
    """
    subscription_service = SubscriptionService(db, redis)
    
    try:
        subscription = await subscription_service.reactivate_subscription(
            subscription_id=subscription_id,
            admin_user_id=current_user.id
        )
        
        return BusinessSubscriptionSchema.model_validate(subscription)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{subscription_id}/overrides", response_model=FeatureOverrideSchema, status_code=status.HTTP_201_CREATED)
async def add_feature_override(
    subscription_id: int,
    request: FeatureOverrideRequest,
    current_user: User = Depends(require_superadmin),
    db=Depends(get_db),
    redis = Depends(get_redis)
):
    """
    Add or update a feature override for a business.
    
    SuperAdmin only endpoint to grant or deny specific features regardless of
    subscription tier. Overrides take precedence over tier-based permissions.
    
    Args:
        subscription_id: ID of subscription to add override for
        request: Feature override parameters
        current_user: Authenticated SuperAdmin user
        db: Database session
        redis: Redis client for cache invalidation
    
    Returns:
        Created or updated FeatureOverride
    
    Raises:
        HTTPException 400: If feature name is invalid
        HTTPException 404: If subscription not found
        HTTPException 403: If user is not SuperAdmin
    
    Validates: Requirement 6.3
    """
    subscription_service = SubscriptionService(db, redis)
    
    # First, get the subscription to find the business_id
    try:
        from sqlalchemy import select
        result = await db.execute(
            select(BusinessSubscription)
            .where(BusinessSubscription.id == subscription_id)
        )
        subscription = result.scalar_one_or_none()
        
        if not subscription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Subscription {subscription_id} not found"
            )
        
        # Add the override
        override = await subscription_service.add_feature_override(
            business_id=subscription.business_id,
            feature_name=request.feature_name,
            granted=request.granted,
            admin_user_id=current_user.id
        )
        
        return FeatureOverrideSchema.model_validate(override)
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{subscription_id}/overrides/{feature_name}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_feature_override(
    subscription_id: int,
    feature_name: str,
    current_user: User = Depends(require_superadmin),
    db=Depends(get_db),
    redis = Depends(get_redis)
):
    """
    Remove a feature override for a business.
    
    SuperAdmin only endpoint to remove a custom feature configuration,
    reverting to tier-based permissions for that feature.
    
    Args:
        subscription_id: ID of subscription to remove override from
        feature_name: Name of feature override to remove
        current_user: Authenticated SuperAdmin user
        db: Database session
        redis: Redis client for cache invalidation
    
    Returns:
        No content (204)
    
    Raises:
        HTTPException 404: If subscription or override not found
        HTTPException 403: If user is not SuperAdmin
    
    Validates: Requirement 6.4
    """
    subscription_service = SubscriptionService(db, redis)
    
    # First, get the subscription to find the business_id
    from sqlalchemy import select
    result = await db.execute(
        select(BusinessSubscription)
        .where(BusinessSubscription.id == subscription_id)
    )
    subscription = result.scalar_one_or_none()
    
    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subscription {subscription_id} not found"
        )
    
    # Remove the override
    removed = await subscription_service.remove_feature_override(
        business_id=subscription.business_id,
        feature_name=feature_name,
        admin_user_id=current_user.id
    )
    
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Override for feature '{feature_name}' not found"
        )
    
    return None
