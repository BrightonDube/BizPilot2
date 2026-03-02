"""Loyalty program API endpoints."""

import math
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.core.database import get_sync_db
from app.api.deps import get_current_active_user, get_current_business_id
from app.models.user import User
from app.models.loyalty import LoyaltyTier
from app.schemas.loyalty import (
    LoyaltyProgramResponse,
    LoyaltyProgramUpdate,
    CustomerLoyaltyResponse,
    CustomerLoyaltyListResponse,
    PointsTransactionResponse,
    PointsHistoryResponse,
    EarnPointsRequest,
    RedeemPointsRequest,
    RedeemPointsResponse,
    ProgramStatsResponse,
)
from app.services.loyalty_service import LoyaltyService

router = APIRouter(prefix="/loyalty", tags=["Loyalty"])


def _program_to_response(program) -> LoyaltyProgramResponse:
    """Convert program model to response schema."""
    return LoyaltyProgramResponse(
        id=str(program.id),
        business_id=str(program.business_id),
        name=program.name,
        points_per_rand=program.points_per_rand,
        redemption_rate=program.redemption_rate,
        min_redemption_points=program.min_redemption_points,
        points_expiry_days=program.points_expiry_days,
        is_active=program.is_active,
        silver_threshold=program.silver_threshold,
        gold_threshold=program.gold_threshold,
        platinum_threshold=program.platinum_threshold,
        silver_multiplier=program.silver_multiplier,
        gold_multiplier=program.gold_multiplier,
        platinum_multiplier=program.platinum_multiplier,
        created_at=program.created_at,
        updated_at=program.updated_at,
    )


def _loyalty_to_response(loyalty) -> CustomerLoyaltyResponse:
    """Convert customer loyalty model to response schema."""
    customer_name = None
    if loyalty.customer:
        customer_name = getattr(loyalty.customer, "display_name", None) or (
            f"{loyalty.customer.first_name or ''} {loyalty.customer.last_name or ''}".strip()
        )
    return CustomerLoyaltyResponse(
        id=str(loyalty.id),
        customer_id=str(loyalty.customer_id),
        business_id=str(loyalty.business_id),
        points_balance=loyalty.points_balance,
        lifetime_points=loyalty.lifetime_points,
        tier=loyalty.tier,
        tier_updated_at=loyalty.tier_updated_at,
        customer_name=customer_name,
        created_at=loyalty.created_at,
        updated_at=loyalty.updated_at,
    )


def _transaction_to_response(tx) -> PointsTransactionResponse:
    """Convert points transaction model to response schema."""
    return PointsTransactionResponse(
        id=str(tx.id),
        customer_id=str(tx.customer_id),
        business_id=str(tx.business_id),
        transaction_type=tx.transaction_type,
        points=tx.points,
        balance_after=tx.balance_after,
        order_id=str(tx.order_id) if tx.order_id else None,
        description=tx.description,
        expires_at=tx.expires_at,
        created_at=tx.created_at,
    )


@router.get("/program", response_model=LoyaltyProgramResponse)
async def get_program(
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get loyalty program configuration."""
    service = LoyaltyService(db)
    program = service.get_or_create_program(business_id)
    return _program_to_response(program)


@router.put("/program", response_model=LoyaltyProgramResponse)
async def update_program(
    data: LoyaltyProgramUpdate,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Update loyalty program settings."""
    service = LoyaltyService(db)
    update_data = data.model_dump(exclude_unset=True)
    program = service.update_program(business_id, **update_data)
    return _program_to_response(program)


@router.get("/members", response_model=CustomerLoyaltyListResponse)
async def list_members(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    tier: Optional[LoyaltyTier] = None,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """List loyalty members with pagination."""
    service = LoyaltyService(db)
    members, total = service.get_members(
        business_id=business_id,
        page=page,
        per_page=per_page,
        tier=tier,
    )
    return CustomerLoyaltyListResponse(
        items=[_loyalty_to_response(m) for m in members],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.get("/members/{customer_id}", response_model=CustomerLoyaltyResponse)
async def get_customer_loyalty(
    customer_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get customer loyalty status."""
    service = LoyaltyService(db)
    loyalty = service.get_customer_loyalty(customer_id, business_id)
    if not loyalty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer loyalty record not found",
        )
    return _loyalty_to_response(loyalty)


@router.post("/earn", response_model=PointsTransactionResponse, status_code=status.HTTP_201_CREATED)
async def earn_points(
    data: EarnPointsRequest,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Award points to a customer."""
    service = LoyaltyService(db)
    try:
        transaction = service.earn_points(
            customer_id=data.customer_id,
            business_id=business_id,
            amount_spent=data.amount_spent,
            order_id=data.order_id,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    return _transaction_to_response(transaction)


@router.post("/redeem", response_model=RedeemPointsResponse)
async def redeem_points(
    data: RedeemPointsRequest,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Redeem points for discount."""
    service = LoyaltyService(db)
    try:
        transaction, discount_value = service.redeem_points(
            customer_id=data.customer_id,
            business_id=business_id,
            points=data.points,
            order_id=data.order_id,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    return RedeemPointsResponse(
        points_redeemed=abs(transaction.points),
        discount_value=discount_value,
        remaining_balance=transaction.balance_after,
    )


@router.get("/members/{customer_id}/history", response_model=PointsHistoryResponse)
async def get_points_history(
    customer_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get points transaction history for a customer."""
    service = LoyaltyService(db)
    transactions, total = service.get_points_history(
        customer_id=customer_id,
        business_id=business_id,
        page=page,
        per_page=per_page,
    )
    return PointsHistoryResponse(
        items=[_transaction_to_response(tx) for tx in transactions],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.get("/stats", response_model=ProgramStatsResponse)
async def get_program_stats(
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get loyalty program statistics."""
    service = LoyaltyService(db)
    stats = service.get_program_stats(business_id)
    return ProgramStatsResponse(**stats)


@router.get("/top-members", response_model=list[CustomerLoyaltyResponse])
async def get_top_members(
    limit: int = Query(10, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get top loyalty members by lifetime points."""
    service = LoyaltyService(db)
    members = service.get_top_members(business_id, limit)
    return [_loyalty_to_response(m) for m in members]
