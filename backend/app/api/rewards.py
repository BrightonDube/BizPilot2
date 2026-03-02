"""Reward catalog and tier benefits API endpoints.

Manages the loyalty reward catalog and per-tier benefit configuration.
"""

import math
from typing import Optional
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel as PydanticBase, Field

from app.core.database import get_sync_db
from app.api.deps import get_current_active_user, get_current_business_id
from app.models.user import User
from app.services.reward_catalog_service import RewardCatalogService


router = APIRouter(prefix="/rewards", tags=["Reward Catalog"])


# --- Schemas ---

class RewardCreate(PydanticBase):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    points_cost: int = Field(..., ge=1)
    reward_type: str = Field(..., pattern="^(discount|free_item|voucher)$")
    reward_value: Optional[Decimal] = None
    product_id: Optional[str] = None
    min_tier: Optional[str] = None
    stock_quantity: Optional[int] = None
    is_active: bool = True


class RewardUpdate(PydanticBase):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    points_cost: Optional[int] = Field(None, ge=1)
    reward_type: Optional[str] = None
    reward_value: Optional[Decimal] = None
    min_tier: Optional[str] = None
    stock_quantity: Optional[int] = None
    is_active: Optional[bool] = None


class RewardResponse(PydanticBase):
    id: str
    business_id: str
    name: str
    description: Optional[str] = None
    points_cost: int
    reward_type: str
    reward_value: Optional[Decimal] = None
    product_id: Optional[str] = None
    min_tier: Optional[str] = None
    stock_quantity: Optional[int] = None
    is_active: bool
    created_at: str

    model_config = {"from_attributes": True}


class RewardListResponse(PydanticBase):
    items: list[RewardResponse]
    total: int
    page: int
    per_page: int
    pages: int


class TierBenefitCreate(PydanticBase):
    tier_name: str = Field(..., pattern="^(bronze|silver|gold|platinum)$")
    benefit_type: str = Field(..., min_length=1, max_length=30)
    benefit_value: Optional[Decimal] = None
    description: Optional[str] = None


class TierBenefitResponse(PydanticBase):
    id: str
    business_id: str
    tier_name: str
    benefit_type: str
    benefit_value: Optional[Decimal] = None
    description: Optional[str] = None
    is_active: bool
    created_at: str

    model_config = {"from_attributes": True}


# --- Reward Endpoints ---

@router.get("", response_model=RewardListResponse)
async def list_rewards(
    active_only: bool = True,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """List rewards in the catalog."""
    service = RewardCatalogService(db)
    items, total = service.list_rewards(business_id, active_only=active_only, page=page, per_page=per_page)
    pages = max(1, math.ceil(total / per_page))
    return RewardListResponse(
        items=[RewardResponse.model_validate(i) for i in items],
        total=total, page=page, per_page=per_page, pages=pages,
    )


@router.post("", response_model=RewardResponse, status_code=status.HTTP_201_CREATED)
async def create_reward(
    payload: RewardCreate,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Create a new reward in the catalog."""
    service = RewardCatalogService(db)
    reward = service.create_reward(business_id, payload.model_dump())
    return RewardResponse.model_validate(reward)


@router.put("/{reward_id}", response_model=RewardResponse)
async def update_reward(
    reward_id: str,
    payload: RewardUpdate,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Update an existing reward."""
    service = RewardCatalogService(db)
    reward = service.update_reward(reward_id, business_id, payload.model_dump(exclude_unset=True))
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found.")
    return RewardResponse.model_validate(reward)


@router.delete("/{reward_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reward(
    reward_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Soft-delete a reward from the catalog."""
    service = RewardCatalogService(db)
    if not service.delete_reward(reward_id, business_id):
        raise HTTPException(status_code=404, detail="Reward not found.")


# --- Tier Benefit Endpoints ---

@router.get("/tier-benefits", response_model=list[TierBenefitResponse])
async def list_tier_benefits(
    tier_name: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """List tier benefits, optionally filtered by tier."""
    service = RewardCatalogService(db)
    items = service.list_tier_benefits(business_id, tier_name=tier_name)
    return [TierBenefitResponse.model_validate(i) for i in items]


@router.post("/tier-benefits", response_model=TierBenefitResponse, status_code=status.HTTP_201_CREATED)
async def create_tier_benefit(
    payload: TierBenefitCreate,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Create a new tier benefit."""
    service = RewardCatalogService(db)
    benefit = service.create_tier_benefit(business_id, payload.model_dump())
    return TierBenefitResponse.model_validate(benefit)


@router.delete("/tier-benefits/{benefit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tier_benefit(
    benefit_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Deactivate a tier benefit."""
    service = RewardCatalogService(db)
    if not service.delete_tier_benefit(benefit_id, business_id):
        raise HTTPException(status_code=404, detail="Tier benefit not found.")
