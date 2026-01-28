"""Admin API endpoints for user and subscription management."""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func
from pydantic import BaseModel, EmailStr
from datetime import datetime

from app.core.database import get_db, get_sync_db
from app.models.base import utc_now
from app.core.admin import require_admin
from app.models.user import User, UserStatus, SubscriptionStatus
from app.models.business_user import BusinessUser
from app.models.subscription_tier import SubscriptionTier, DEFAULT_TIERS
from app.models.subscription_transaction import SubscriptionTransaction
from app.schemas.subscription import (
    TierUpdateRequest as NewTierUpdateRequest,
    FeatureOverridesRequest,
)
from app.services.permission_service import PermissionService
from app.services.subscription_service import SubscriptionService
from app.services.device_service import DeviceService
from app.api.deps import require_superadmin

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


class BusinessSummaryResponse(BaseModel):
    id: UUID
    name: str
    slug: str

    class Config:
        from_attributes = True


class UserBusinessResponse(BaseModel):
    business: BusinessSummaryResponse
    status: str
    is_primary: bool

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
    is_superadmin: bool
    subscription_status: Optional[SubscriptionStatus]
    current_tier_id: Optional[UUID]
    current_tier: Optional[TierResponse]
    subscription_started_at: Optional[datetime]
    subscription_expires_at: Optional[datetime]
    trial_ends_at: Optional[datetime]
    feature_overrides: Optional[dict]
    businesses: List[UserBusinessResponse] = []
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
    db=Depends(get_sync_db),
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
    
    users = (
        query.order_by(User.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    user_ids = [u.id for u in users]
    memberships = (
        db.query(BusinessUser)
        .options(joinedload(BusinessUser.business))
        .filter(BusinessUser.user_id.in_(user_ids))
        .all()
    )
    memberships_by_user: dict[UUID, list[BusinessUser]] = {}
    for m in memberships:
        memberships_by_user.setdefault(m.user_id, []).append(m)

    response_users: list[UserAdminResponse] = []
    for u in users:
        user_resp = UserAdminResponse.model_validate(u)
        user_memberships = memberships_by_user.get(u.id, [])
        user_resp.businesses = [
            UserBusinessResponse(
                business=BusinessSummaryResponse.model_validate(m.business),
                status=m.status.value if hasattr(m.status, "value") else str(m.status),
                is_primary=bool(m.is_primary),
            )
            for m in user_memberships
            if m.business is not None
        ]
        response_users.append(user_resp)

    return UserListResponse(
        users=response_users,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


@router.get("/users/{user_id}", response_model=UserAdminResponse)
async def get_user(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db=Depends(get_sync_db),
):
    """Get a specific user's details."""
    user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    memberships = (
        db.query(BusinessUser)
        .options(joinedload(BusinessUser.business))
        .filter(BusinessUser.user_id == user.id)
        .all()
    )
    resp = UserAdminResponse.model_validate(user)
    resp.businesses = [
        UserBusinessResponse(
            business=BusinessSummaryResponse.model_validate(m.business),
            status=m.status.value if hasattr(m.status, "value") else str(m.status),
            is_primary=bool(m.is_primary),
        )
        for m in memberships
        if m.business is not None
    ]
    return resp


@router.patch("/users/{user_id}", response_model=UserAdminResponse)
async def update_user(
    user_id: UUID,
    data: UserUpdateRequest,
    admin: User = Depends(require_admin),
    db=Depends(get_sync_db),
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
    db=Depends(get_sync_db),
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
    db=Depends(get_sync_db),
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
    db=Depends(get_sync_db),
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
    db=Depends(get_sync_db),
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
    db=Depends(get_sync_db),
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
    db=Depends(get_sync_db),
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
    db=Depends(get_sync_db),
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
    db=Depends(get_sync_db),
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
    db=Depends(get_sync_db),
):
    """List all subscription tiers."""
    query = db.query(SubscriptionTier).filter(SubscriptionTier.deleted_at.is_(None))
    if not include_inactive:
        query = query.filter(SubscriptionTier.is_active)
    
    tiers = query.order_by(SubscriptionTier.sort_order).all()
    return [TierResponse.model_validate(t) for t in tiers]


@router.post("/tiers", response_model=TierResponse)
async def create_tier(
    data: TierCreateRequest,
    admin: User = Depends(require_admin),
    db=Depends(get_sync_db),
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
    db=Depends(get_sync_db),
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
    db=Depends(get_sync_db),
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
    
    tier.deleted_at = utc_now()
    tier.is_active = False
    db.commit()
    
    return {"message": "Tier deleted successfully"}


@router.post("/tiers/seed")
async def seed_default_tiers(
    admin: User = Depends(require_admin),
    db=Depends(get_sync_db),
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


@router.post("/seed/essential")
async def seed_essential_data(
    admin: User = Depends(require_admin),
    db=Depends(get_sync_db),
):
    """
    Seed essential production data (tiers, roles, categories).
    Safe to run multiple times - only creates missing data.
    """
    from app.models.role import Role, DEFAULT_ROLES
    from app.models.product import ProductCategory
    
    results = {"tiers": [], "roles": [], "categories": []}
    
    # 1. Seed subscription tiers
    for tier_key, tier_data in DEFAULT_TIERS.items():
        existing = db.query(SubscriptionTier).filter(
            SubscriptionTier.name == tier_data["name"]
        ).first()
        if not existing:
            tier = SubscriptionTier(**tier_data)
            db.add(tier)
            results["tiers"].append(tier_data["name"])
    
    # 2. Seed default roles
    for role_data in DEFAULT_ROLES:
        existing = db.query(Role).filter(Role.name == role_data["name"]).first()
        if not existing:
            role = Role(**role_data)
            db.add(role)
            results["roles"].append(role_data["name"])
    
    # 3. Seed default product categories
    default_categories = [
        {"name": "General", "description": "General products", "color": "#6B7280"},
        {"name": "Food & Beverages", "description": "Food and drink items", "color": "#10B981"},
        {"name": "Electronics", "description": "Electronic devices and accessories", "color": "#3B82F6"},
        {"name": "Clothing", "description": "Apparel and accessories", "color": "#8B5CF6"},
        {"name": "Home & Garden", "description": "Home and garden supplies", "color": "#F59E0B"},
        {"name": "Health & Beauty", "description": "Health and beauty products", "color": "#EC4899"},
        {"name": "Services", "description": "Service offerings", "color": "#14B8A6"},
    ]
    
    for cat_data in default_categories:
        existing = db.query(ProductCategory).filter(
            ProductCategory.name == cat_data["name"]
        ).first()
        if not existing:
            # ProductCategory needs a business_id, so we skip if no business context
            # These are just templates - actual categories are created per business
            results["categories"].append(f"{cat_data['name']} (template)")
    
    db.commit()
    
    return {
        "message": "Essential data seeded successfully",
        "created": results,
        "note": "Run this endpoint after deployment to ensure all required data exists"
    }


# ==================== Admin Stats Endpoints ====================

@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(
    admin: User = Depends(require_admin),
    db=Depends(get_sync_db),
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
    db=Depends(get_sync_db),
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



# ==================== Subscription Management Endpoints (New) ====================


@router.get("/subscriptions", response_model=List[dict])
async def list_business_subscriptions(
    current_user: User = Depends(require_superadmin),
    db=Depends(get_sync_db)
):
    """
    List all business subscriptions with current tier and status.
    
    Returns list of all businesses with subscription details including:
    - business_id, business_name, tier, status, device_count, valid_until
    """
    from app.models.business import Business
    
    # Query all businesses
    businesses = db.query(Business).filter(Business.deleted_at.is_(None)).all()
    
    perm_service = PermissionService(db)
    device_service = DeviceService(db)
    
    result = []
    for business in businesses:
        try:
            # Get permissions for each business (async method)
            permissions = await perm_service.get_business_permissions(business.id)
            
            # Get device count
            devices = device_service.get_business_devices(business.id)
            
            result.append({
                'business_id': business.id,
                'business_name': business.name,
                'tier_name': permissions.get('tier', 'none'),
                'status': permissions.get('status', 'inactive'),
                'device_count': len(devices),
                'max_devices': permissions.get('device_limit', 0),
                'valid_until': permissions.get('demo_expires_at'),
                'is_demo_expired': False  # Calculated from valid_until if needed
            })
        except Exception as e:
            # Log error but continue with other businesses
            print(f"Error getting subscription for business {business.id}: {e}")
            continue
    
    return result


@router.get("/subscriptions/{business_id}", response_model=dict)
async def get_subscription_detail(
    business_id: int,
    current_user: User = Depends(require_superadmin),
    db=Depends(get_sync_db)
):
    """
    Get detailed subscription info for a business.
    
    Returns detailed subscription info including:
    - Current tier and features
    - Active overrides
    - Device list with last sync times
    """
    from app.models.business import Business
    
    # Verify business exists
    business = db.query(Business).filter(
        Business.id == business_id,
        Business.deleted_at.is_(None)
    ).first()
    
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    perm_service = PermissionService(db)
    device_service = DeviceService(db)
    
    # Get permissions (async method)
    permissions = await perm_service.get_business_permissions(business_id)
    
    # Get devices
    devices = device_service.get_business_devices(business_id)
    
    # TODO: Get overrides from FeatureOverrides table once populated
    overrides = {}
    
    return {
        'business_id': business.id,
        'business_name': business.name,
        'tier_name': permissions.get('tier', 'none'),
        'status': permissions.get('status', 'inactive'),
        'device_count': len(devices),
        'max_devices': permissions.get('device_limit', 0),
        'valid_until': permissions.get('demo_expires_at'),
        'permissions': permissions,
        'overrides': overrides,
        'devices': [d.model_dump() if hasattr(d, 'model_dump') else d for d in devices]
    }


@router.put("/subscriptions/{business_id}/tier")
async def update_subscription_tier(
    business_id: int,
    tier_update: NewTierUpdateRequest,
    current_user: User = Depends(require_superadmin),
    db=Depends(get_sync_db)
):
    """
    Update a business's subscription tier.
    
    Invalidates permission cache after update.
    """
    from app.models.business import Business
    
    # Verify business exists
    business = db.query(Business).filter(
        Business.id == business_id,
        Business.deleted_at.is_(None)
    ).first()
    
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    sub_service = SubscriptionService(db)
    
    try:
        result = sub_service.update_tier(
            business_id=business_id,
            tier_name=tier_update.tier_name,
            valid_until=tier_update.valid_until,
            admin_user_id=current_user.id
        )
        
        return {
            'success': True,
            'message': f'Tier updated to {tier_update.tier_name}',
            'subscription': result
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/subscriptions/{business_id}/overrides")
async def set_feature_overrides(
    business_id: int,
    overrides: FeatureOverridesRequest,
    current_user: User = Depends(require_superadmin),
    db=Depends(get_sync_db)
):
    """
    Set or update feature overrides for a business.
    
    Accepts: max_devices, max_users, has_payroll, has_ai, has_api_access, has_advanced_reporting
    """
    from app.models.business import Business
    
    # Verify business exists
    business = db.query(Business).filter(
        Business.id == business_id,
        Business.deleted_at.is_(None)
    ).first()
    
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    sub_service = SubscriptionService(db)
    
    # Set each override that was provided
    override_data = overrides.model_dump(exclude_unset=True)
    results = []
    
    for feature_name, feature_value in override_data.items():
        if feature_value is not None:
            try:
                result = sub_service.set_feature_override(
                    business_id=business_id,
                    feature_name=feature_name,
                    feature_value=feature_value,
                    admin_user_id=current_user.id
                )
                results.append(result)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
    
    return {
        'success': True,
        'message': f'Set {len(results)} feature overrides',
        'overrides': results
    }


@router.delete("/subscriptions/{business_id}/overrides/{feature_name}")
async def remove_business_feature_override(
    business_id: int,
    feature_name: str,
    current_user: User = Depends(require_superadmin),
    db=Depends(get_sync_db)
):
    """
    Remove a feature override, reverting to tier default.
    """
    from app.models.business import Business
    
    # Verify business exists
    business = db.query(Business).filter(
        Business.id == business_id,
        Business.deleted_at.is_(None)
    ).first()
    
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    sub_service = SubscriptionService(db)
    
    removed = sub_service.remove_feature_override(
        business_id=business_id,
        feature_name=feature_name,
        admin_user_id=current_user.id
    )
    
    if not removed:
        raise HTTPException(
            status_code=404,
            detail=f"No override found for feature '{feature_name}'"
        )
    
    return {
        'success': True,
        'message': f'Removed override for {feature_name}'
    }


# ==================== Device Management Endpoints ====================

@router.get("/devices/{business_id}", response_model=List[dict])
async def list_business_devices(
    business_id: int,
    current_user: User = Depends(require_superadmin),
    db=Depends(get_sync_db)
):
    """
    List all devices for a business.
    
    Returns list of all devices including:
    - device_id, device_name, user_name, last_sync_time, is_active
    """
    from app.models.business import Business
    
    # Verify business exists
    business = db.query(Business).filter(
        Business.id == business_id,
        Business.deleted_at.is_(None)
    ).first()
    
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    device_service = DeviceService(db)
    devices = device_service.get_business_devices(business_id)
    
    return [d.model_dump() if hasattr(d, 'model_dump') else d for d in devices]


@router.delete("/devices/{business_id}/{device_id}")
async def unlink_device(
    business_id: int,
    device_id: str,
    current_user: User = Depends(require_superadmin),
    db=Depends(get_sync_db)
):
    """
    Unlink a device from a business.
    
    Sets is_active = FALSE for the device.
    """
    from app.models.business import Business
    
    # Verify business exists
    business = db.query(Business).filter(
        Business.id == business_id,
        Business.deleted_at.is_(None)
    ).first()
    
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    
    device_service = DeviceService(db)
    device_service.unlink_device(business_id, device_id)
    
    return {
        'success': True,
        'message': f'Device {device_id} unlinked from business {business_id}'
    }
