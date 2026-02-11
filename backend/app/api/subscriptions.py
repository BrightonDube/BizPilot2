"""Subscription API endpoints for tier listing and user subscription management."""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_sync_db
from app.models.base import utc_now
from app.api.deps import get_current_active_user
from app.models.user import User, SubscriptionStatus
from app.models.subscription_tier import SubscriptionTier
from app.core.subscription import get_user_effective_features, get_user_tier_info

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


# ==================== Pydantic Schemas ====================

class TierPublicResponse(BaseModel):
    id: UUID
    name: str
    display_name: str
    description: Optional[str]
    price_monthly_cents: int
    price_yearly_cents: int
    currency: str
    sort_order: int
    is_default: bool
    is_custom_pricing: bool = False
    features: dict
    feature_flags: dict

    class Config:
        from_attributes = True


class UserSubscriptionResponse(BaseModel):
    tier: Optional[dict]
    subscription_status: str
    subscription_started_at: Optional[datetime]
    subscription_expires_at: Optional[datetime]
    trial_ends_at: Optional[datetime]
    features: dict
    is_admin: bool


class SelectTierRequest(BaseModel):
    tier_id: UUID
    billing_cycle: str = "monthly"  # "monthly" or "yearly"


# ==================== Public Endpoints ====================

@router.get("/tiers", response_model=List[TierPublicResponse])
async def list_available_tiers(
    db=Depends(get_sync_db),
):
    """
    List all active subscription tiers (public endpoint).
    Used on pricing page and tier selection during registration.
    """
    tiers = db.query(SubscriptionTier).filter(
        SubscriptionTier.is_active,
        SubscriptionTier.deleted_at.is_(None)
    ).order_by(SubscriptionTier.sort_order).all()
    
    return [TierPublicResponse.model_validate(t) for t in tiers]


@router.get("/tiers/{tier_id}", response_model=TierPublicResponse)
async def get_tier(
    tier_id: UUID,
    db=Depends(get_sync_db),
):
    """Get a specific tier by ID."""
    tier = db.query(SubscriptionTier).filter(
        SubscriptionTier.id == tier_id,
        SubscriptionTier.is_active,
        SubscriptionTier.deleted_at.is_(None)
    ).first()
    
    if not tier:
        raise HTTPException(status_code=404, detail="Tier not found")
    
    return TierPublicResponse.model_validate(tier)


# ==================== Authenticated Endpoints ====================

@router.get("/me", response_model=UserSubscriptionResponse)
async def get_my_subscription(
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """Get the current user's subscription details and available features."""
    tier_info = get_user_tier_info(current_user, db)
    
    return UserSubscriptionResponse(
        tier=tier_info["tier"],
        subscription_status=tier_info["subscription_status"],
        subscription_started_at=current_user.subscription_started_at,
        subscription_expires_at=current_user.subscription_expires_at,
        trial_ends_at=current_user.trial_ends_at,
        features=tier_info["features"],
        is_admin=current_user.is_admin,
    )


@router.get("/features")
async def get_my_features(
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """Get all features available to the current user."""
    return get_user_effective_features(current_user, db)


@router.get("/features/{feature}")
async def check_feature_access(
    feature: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """Check if the current user has access to a specific feature."""
    if getattr(current_user, "is_superadmin", False):
        return {"feature": feature, "has_access": True, "reason": "superadmin"}
    
    features = get_user_effective_features(current_user, db)
    has_access = features.get(feature, False)
    
    return {
        "feature": feature,
        "has_access": has_access,
        "reason": "tier" if has_access else "upgrade_required",
    }


@router.post("/select-tier")
async def select_tier(
    data: SelectTierRequest,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """
    Select a subscription tier (for free tiers or to initiate paid checkout).
    For paid tiers, this returns checkout information.
    For free tiers, this directly assigns the tier.
    """
    tier = db.query(SubscriptionTier).filter(
        SubscriptionTier.id == data.tier_id,
        SubscriptionTier.is_active,
        SubscriptionTier.deleted_at.is_(None)
    ).first()
    
    if not tier:
        raise HTTPException(status_code=404, detail="Tier not found")
    
    # Check if this is a free tier
    price = tier.price_monthly_cents if data.billing_cycle == "monthly" else tier.price_yearly_cents
    
    if price == 0:
        # Free tier - assign directly
        current_user.current_tier_id = tier.id
        current_user.subscription_status = SubscriptionStatus.ACTIVE
        current_user.subscription_started_at = datetime.utcnow()
        db.commit()
        
        return {
            "success": True,
            "tier": tier.name,
            "message": "Free tier activated successfully",
            "requires_payment": False,
        }
    
    # Paid tier - return checkout info (Paystack will handle actual checkout)
    return {
        "success": True,
        "tier": tier.name,
        "requires_payment": True,
        "amount_cents": price,
        "currency": tier.currency,
        "billing_cycle": data.billing_cycle,
        "plan_code": tier.paystack_plan_code_monthly if data.billing_cycle == "monthly" else tier.paystack_plan_code_yearly,
    }


@router.post("/start-trial")
async def start_trial(
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """
    Start a free trial for the Professional tier.
    Only available for users who haven't had a trial before.
    """
    # Check if user already had a trial
    if current_user.trial_ends_at:
        raise HTTPException(
            status_code=400,
            detail="You have already used your free trial"
        )
    
    # Get Professional tier
    pro_tier = db.query(SubscriptionTier).filter(
        SubscriptionTier.name == "professional",
        SubscriptionTier.is_active
    ).first()
    
    if not pro_tier:
        raise HTTPException(status_code=404, detail="Professional tier not found")
    
    # Set trial (14 days)
    from datetime import timedelta
    now = utc_now()
    current_user.current_tier_id = pro_tier.id
    current_user.subscription_status = SubscriptionStatus.TRIAL
    current_user.subscription_started_at = now
    current_user.trial_ends_at = now + timedelta(days=14)
    
    db.commit()
    
    return {
        "success": True,
        "message": "14-day free trial started",
        "trial_ends_at": current_user.trial_ends_at.isoformat(),
    }


@router.post("/cancel")
async def cancel_subscription(
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """Cancel the current subscription."""
    if current_user.subscription_status not in [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL]:
        raise HTTPException(
            status_code=400,
            detail="No active subscription to cancel"
        )
    
    # Get free tier
    free_tier = db.query(SubscriptionTier).filter(
        SubscriptionTier.name == "free",
        SubscriptionTier.is_active
    ).first()
    
    current_user.subscription_status = SubscriptionStatus.CANCELLED
    if free_tier:
        current_user.current_tier_id = free_tier.id
    else:
        current_user.current_tier_id = None
    
    db.commit()
    
    return {"success": True, "message": "Subscription cancelled"}
