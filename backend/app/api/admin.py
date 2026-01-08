"""Admin API endpoints for user and subscription management."""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from pydantic import BaseModel, EmailStr
from datetime import datetime

from app.core.database import get_db
from app.core.admin import require_admin
from app.models.user import User, UserStatus, SubscriptionStatus
from app.models.subscription_tier import SubscriptionTier, DEFAULT_TIERS
from app.models.subscription_transaction import SubscriptionTransaction

router = APIRouter(prefix="/admin", tags=["admin"])


# ==================== Pydantic Schemas ====================

class TierResponse(BaseModel):
    id: UUID
    name: str
    display_name: str
    description: Optional[str]
    price_monthly_cents: int
    price_yearly_cents: int
    currency: str
    sort_order: int
    is_default: bool
    is_active: bool
    features: dict
    feature_flags: dict

    class Config:
        from_attributes = True


class UserAdminResponse(BaseModel):
    id: UUID
    email: str
    first_name: str
    last_name: str
    phone: Optional[str]
    avatar_url: Optional[str]
    is_email_verified: bool
    status: UserStatus
    is_admin: bool
    subscription_status: Optional[SubscriptionStatus]
    current_tier_id: Optional[UUID]
    current_tier: Optional[TierResponse]
    subscription_started_at: Optional[datetime]
    subscription_expires_at: Optional[datetime]
    trial_ends_at: Optional[datetime]
    feature_overrides: Optional[dict]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    users: List[UserAdminResponse]
    total: int
    page: int
    per_page: int
    total_pages: int


class UserUpdateRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    status: Optional[UserStatus] = None
    is_admin: Optional[bool] = None


class SubscriptionUpdateRequest(BaseModel):
    subscription_status: Optional[SubscriptionStatus] = None
    current_tier_id: Optional[UUID] = None
    subscription_expires_at: Optional[datetime] = None
    trial_ends_at: Optional[datetime] = None


class FeatureOverrideRequest(BaseModel):
    feature_overrides: dict


class TierCreateRequest(BaseModel):
    name: str
    display_name: str
    description: Optional[str] = None
    price_monthly_cents: int = 0
    price_yearly_cents: int = 0
    currency: str = "ZAR"
    sort_order: int = 0
    is_default: bool = False
    is_active: bool = True
    features: dict = {}
    feature_flags: dict = {}


class TierUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    price_monthly_cents: Optional[int] = None
    price_yearly_cents: Optional[int] = None
    sort_order: Optional[int] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None
    features: Optional[dict] = None
    feature_flags: Optional[dict] = None
    paystack_plan_code_monthly: Optional[str] = None
    paystack_plan_code_yearly: Optional[str] = None


class AdminStatsResponse(BaseModel):
    total_users: int
    active_users: int
    subscribed_users: int
    trial_users: int
    revenue_this_month_cents: int
    users_by_tier: dict
    users_by_status: dict


# ==================== User Management Endpoints ====================

@router.get("/users", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[UserStatus] = None,
    subscription_status: Optional[SubscriptionStatus] = None,
    tier_id: Optional[UUID] = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all users with pagination and filters."""
    query = db.query(User).filter(User.deleted_at.is_(None))
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                User.email.ilike(search_term),
                User.first_name.ilike(search_term),
                User.last_name.ilike(search_term),
            )
        )
    
    if status:
        query = query.filter(User.status == status)
    
    if subscription_status:
        query = query.filter(User.subscription_status == subscription_status)
    
    if tier_id:
        query = query.filter(User.current_tier_id == tier_id)
    
    total = query.count()
    total_pages = (total + per_page - 1) // per_page
    
    users = query.order_by(User.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    
    return UserListResponse(
        users=[UserAdminResponse.model_validate(u) for u in users],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


@router.get("/users/{user_id}", response_model=UserAdminResponse)
async def get_user(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Get a specific user's details."""
    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserAdminResponse.model_validate(user)


@router.patch("/users/{user_id}", response_model=UserAdminResponse)
async def update_user(
    user_id: UUID,
    data: UserUpdateRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update a user's basic information."""
    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent admin from removing their own admin status
    if user.id == admin.id and data.is_admin is False:
        raise HTTPException(
            status_code=400, 
            detail="Cannot remove your own admin status"
        )
    
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    return UserAdminResponse.model_validate(user)


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Soft delete a user."""
    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent admin from deleting themselves
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    user.deleted_at = datetime.utcnow()
    user.status = UserStatus.INACTIVE
    db.commit()
    
    return {"message": "User deleted successfully"}


@router.post("/users/{user_id}/block")
async def block_user(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Block/suspend a user."""
    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    
    user.status = UserStatus.SUSPENDED
    db.commit()
    
    return {"message": "User blocked successfully"}


@router.post("/users/{user_id}/unblock")
async def unblock_user(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Unblock a suspended user."""
    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.status != UserStatus.SUSPENDED:
        raise HTTPException(status_code=400, detail="User is not blocked")
    
    user.status = UserStatus.ACTIVE
    db.commit()
    
    return {"message": "User unblocked successfully"}


# ==================== Subscription Management Endpoints ====================

@router.patch("/users/{user_id}/subscription", response_model=UserAdminResponse)
async def update_user_subscription(
    user_id: UUID,
    data: SubscriptionUpdateRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update a user's subscription status and tier."""
    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = data.model_dump(exclude_unset=True)
    
    # Validate tier exists if provided
    if "current_tier_id" in update_data and update_data["current_tier_id"]:
        tier = db.query(SubscriptionTier).filter(
            SubscriptionTier.id == update_data["current_tier_id"]
        ).first()
        if not tier:
            raise HTTPException(status_code=404, detail="Tier not found")
    
    for field, value in update_data.items():
        setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    return UserAdminResponse.model_validate(user)


@router.post("/users/{user_id}/pause-subscription")
async def pause_user_subscription(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Pause a user's subscription (admin override)."""
    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.subscription_status = SubscriptionStatus.PAUSED
    db.commit()
    
    return {"message": "Subscription paused successfully"}


@router.post("/users/{user_id}/unpause-subscription")
async def unpause_user_subscription(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Unpause a user's subscription."""
    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.subscription_status != SubscriptionStatus.PAUSED:
        raise HTTPException(status_code=400, detail="Subscription is not paused")
    
    user.subscription_status = SubscriptionStatus.ACTIVE
    db.commit()
    
    return {"message": "Subscription unpaused successfully"}


# ==================== Feature Override Endpoints ====================

@router.patch("/users/{user_id}/feature-overrides", response_model=UserAdminResponse)
async def update_feature_overrides(
    user_id: UUID,
    data: FeatureOverrideRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update a user's feature overrides (enable/disable specific features)."""
    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Merge with existing overrides
    current_overrides = user.feature_overrides or {}
    current_overrides.update(data.feature_overrides)
    user.feature_overrides = current_overrides
    
    db.commit()
    db.refresh(user)
    return UserAdminResponse.model_validate(user)


@router.delete("/users/{user_id}/feature-overrides/{feature}")
async def remove_feature_override(
    user_id: UUID,
    feature: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Remove a specific feature override for a user."""
    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.feature_overrides and feature in user.feature_overrides:
        del user.feature_overrides[feature]
        # Force SQLAlchemy to detect the change
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(user, "feature_overrides")
        db.commit()
    
    return {"message": f"Feature override '{feature}' removed"}


# ==================== Tier Management Endpoints ====================

@router.get("/tiers", response_model=List[TierResponse])
async def list_tiers(
    include_inactive: bool = False,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all subscription tiers."""
    query = db.query(SubscriptionTier).filter(SubscriptionTier.deleted_at.is_(None))
    if not include_inactive:
        query = query.filter(SubscriptionTier.is_active == True)
    
    tiers = query.order_by(SubscriptionTier.sort_order).all()
    return [TierResponse.model_validate(t) for t in tiers]


@router.post("/tiers", response_model=TierResponse)
async def create_tier(
    data: TierCreateRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create a new subscription tier."""
    # Check if name already exists
    existing = db.query(SubscriptionTier).filter(
        SubscriptionTier.name == data.name,
        SubscriptionTier.deleted_at.is_(None)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tier with this name already exists")
    
    tier = SubscriptionTier(**data.model_dump())
    db.add(tier)
    db.commit()
    db.refresh(tier)
    return TierResponse.model_validate(tier)


@router.patch("/tiers/{tier_id}", response_model=TierResponse)
async def update_tier(
    tier_id: UUID,
    data: TierUpdateRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update a subscription tier."""
    tier = db.query(SubscriptionTier).filter(
        SubscriptionTier.id == tier_id,
        SubscriptionTier.deleted_at.is_(None)
    ).first()
    if not tier:
        raise HTTPException(status_code=404, detail="Tier not found")
    
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tier, field, value)
    
    db.commit()
    db.refresh(tier)
    return TierResponse.model_validate(tier)


@router.delete("/tiers/{tier_id}")
async def delete_tier(
    tier_id: UUID,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Soft delete a subscription tier."""
    tier = db.query(SubscriptionTier).filter(
        SubscriptionTier.id == tier_id,
        SubscriptionTier.deleted_at.is_(None)
    ).first()
    if not tier:
        raise HTTPException(status_code=404, detail="Tier not found")
    
    # Check if any users are on this tier
    users_on_tier = db.query(User).filter(User.current_tier_id == tier_id).count()
    if users_on_tier > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete tier: {users_on_tier} users are currently on this tier"
        )
    
    tier.deleted_at = datetime.utcnow()
    tier.is_active = False
    db.commit()
    
    return {"message": "Tier deleted successfully"}


@router.post("/tiers/seed")
async def seed_default_tiers(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Seed default subscription tiers from configuration."""
    created = []
    for tier_key, tier_data in DEFAULT_TIERS.items():
        existing = db.query(SubscriptionTier).filter(
            SubscriptionTier.name == tier_data["name"]
        ).first()
        if not existing:
            tier = SubscriptionTier(**tier_data)
            db.add(tier)
            created.append(tier_data["name"])
    
    db.commit()
    return {"message": f"Created tiers: {created}" if created else "All tiers already exist"}


# ==================== Admin Stats Endpoints ====================

@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Get admin dashboard statistics."""
    total_users = db.query(User).filter(User.deleted_at.is_(None)).count()
    active_users = db.query(User).filter(
        User.deleted_at.is_(None),
        User.status == UserStatus.ACTIVE
    ).count()
    subscribed_users = db.query(User).filter(
        User.deleted_at.is_(None),
        User.subscription_status == SubscriptionStatus.ACTIVE
    ).count()
    trial_users = db.query(User).filter(
        User.deleted_at.is_(None),
        User.subscription_status == SubscriptionStatus.TRIAL
    ).count()
    
    # Revenue this month (from successful transactions)
    from datetime import date
    first_of_month = date.today().replace(day=1)
    revenue = db.query(func.sum(SubscriptionTransaction.amount_cents)).filter(
        SubscriptionTransaction.status == "success",
        SubscriptionTransaction.paid_at >= first_of_month
    ).scalar() or 0
    
    # Users by tier
    tier_counts = db.query(
        SubscriptionTier.name,
        func.count(User.id)
    ).outerjoin(User, User.current_tier_id == SubscriptionTier.id).filter(
        User.deleted_at.is_(None)
    ).group_by(SubscriptionTier.name).all()
    
    users_by_tier = {name: count for name, count in tier_counts}
    users_by_tier["none"] = db.query(User).filter(
        User.deleted_at.is_(None),
        User.current_tier_id.is_(None)
    ).count()
    
    # Users by status
    status_counts = db.query(
        User.status,
        func.count(User.id)
    ).filter(User.deleted_at.is_(None)).group_by(User.status).all()
    users_by_status = {status.value: count for status, count in status_counts}
    
    return AdminStatsResponse(
        total_users=total_users,
        active_users=active_users,
        subscribed_users=subscribed_users,
        trial_users=trial_users,
        revenue_this_month_cents=revenue,
        users_by_tier=users_by_tier,
        users_by_status=users_by_status,
    )


@router.get("/transactions")
async def list_transactions(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user_id: Optional[UUID] = None,
    status: Optional[str] = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List subscription transactions."""
    query = db.query(SubscriptionTransaction)
    
    if user_id:
        query = query.filter(SubscriptionTransaction.user_id == user_id)
    if status:
        query = query.filter(SubscriptionTransaction.status == status)
    
    total = query.count()
    transactions = query.order_by(
        SubscriptionTransaction.created_at.desc()
    ).offset((page - 1) * per_page).limit(per_page).all()
    
    return {
        "transactions": transactions,
        "total": total,
        "page": page,
        "per_page": per_page,
    }
