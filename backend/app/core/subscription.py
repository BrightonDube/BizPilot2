"""Subscription and feature gating dependencies."""

from typing import List
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User, SubscriptionStatus
from app.models.subscription_tier import SubscriptionTier


def get_user_effective_features(user: User, db: Session) -> dict:
    """
    Get the effective feature flags for a user.
    Combines tier features with user-specific overrides.
    """
    # Start with empty features
    features = {}
    
    # Get tier features if user has a tier
    if user.current_tier_id:
        tier = db.query(SubscriptionTier).filter(
            SubscriptionTier.id == user.current_tier_id
        ).first()
        if tier and tier.feature_flags:
            features = dict(tier.feature_flags)
    
    # Apply user-specific overrides
    if user.feature_overrides:
        features.update(user.feature_overrides)
    
    return features


def check_subscription_active(user: User) -> bool:
    """Check if user has an active subscription."""
    if user.subscription_status in [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL]:
        return True
    return False


def require_feature(feature: str):
    """
    Dependency that checks if the user has access to a specific feature.
    
    Features can be granted by:
    1. User's subscription tier
    2. Admin feature overrides
    
    Usage:
        @router.get("/export")
        async def export_report(
            user: User = Depends(require_feature("export_reports"))
        ):
            ...
    """
    async def feature_checker(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db),
    ) -> User:
        # Platform superadmin bypasses feature checks
        if getattr(current_user, "is_superadmin", False):
            return current_user
        
        # Get effective features
        features = get_user_effective_features(current_user, db)
        
        if not features.get(feature, False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Feature not available: {feature}. Please upgrade your subscription.",
            )
        
        return current_user
    
    return feature_checker


def require_any_feature(features: List[str]):
    """
    Dependency that checks if the user has access to any of the specified features.
    """
    async def feature_checker(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db),
    ) -> User:
        if getattr(current_user, "is_superadmin", False):
            return current_user
        
        user_features = get_user_effective_features(current_user, db)
        
        if not any(user_features.get(f, False) for f in features):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This feature requires an upgraded subscription.",
            )
        
        return current_user
    
    return feature_checker


def require_active_subscription():
    """
    Dependency that checks if the user has an active paid subscription.
    """
    async def subscription_checker(
        current_user: User = Depends(get_current_active_user),
    ) -> User:
        if getattr(current_user, "is_superadmin", False):
            return current_user
        
        if not check_subscription_active(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Active subscription required. Please subscribe to access this feature.",
            )
        
        return current_user
    
    return subscription_checker


def check_limit(limit_name: str, current_count: int):
    """
    Dependency that checks if a user is within their tier limits.
    
    Available limits in current tiers: max_users, max_orders_per_month, max_terminals
    A limit value of -1 means unlimited.
    
    Usage:
        # First get current count
        user_count = db.query(BusinessUser).filter(...).count()
        
        @router.post("/users")
        async def add_user(
            user: User = Depends(check_limit("max_users", user_count))
        ):
            ...
    """
    async def limit_checker(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db),
    ) -> User:
        if getattr(current_user, "is_superadmin", False):
            return current_user
        
        # Get tier limits
        limit = -1  # Default unlimited
        if current_user.current_tier_id:
            tier = db.query(SubscriptionTier).filter(
                SubscriptionTier.id == current_user.current_tier_id
            ).first()
            if tier and tier.features:
                limit = tier.features.get(limit_name, -1)
        
        # -1 means unlimited
        if limit != -1 and current_count >= limit:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Limit reached: {limit_name}. Please upgrade your subscription for more.",
            )
        
        return current_user
    
    return limit_checker


class RequireFeature:
    """
    Class-based feature checker for more complex scenarios.
    
    Usage:
        export_check = RequireFeature("export_reports")
        
        @router.get("/export")
        async def export(user: User = Depends(export_check)):
            ...
    """
    
    def __init__(self, feature: str):
        self.feature = feature
    
    async def __call__(
        self,
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db),
    ) -> User:
        if getattr(current_user, "is_superadmin", False):
            return current_user
        
        features = get_user_effective_features(current_user, db)
        
        if not features.get(self.feature, False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Feature not available: {self.feature}. Please upgrade your subscription.",
            )
        
        return current_user


def get_user_tier_info(user: User, db: Session) -> dict:
    """Get comprehensive tier info for a user."""
    tier = None
    if user.current_tier_id:
        tier = db.query(SubscriptionTier).filter(
            SubscriptionTier.id == user.current_tier_id
        ).first()
    
    return {
        "tier": {
            "id": str(tier.id) if tier else None,
            "name": tier.name if tier else "free",
            "display_name": tier.display_name if tier else "Free",
        } if tier else None,
        "subscription_status": user.subscription_status.value if user.subscription_status else "none",
        "features": get_user_effective_features(user, db),
        "is_admin": user.is_admin,
    }
