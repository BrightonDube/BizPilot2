"""Gift card API endpoints."""

import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.core.database import get_sync_db
from app.api.deps import get_current_active_user, get_current_business_id
from app.models.user import User
from app.models.gift_card import GiftCardStatus
from app.schemas.gift_card import (
    GiftCardCreate,
    GiftCardResponse,
    GiftCardListResponse,
    GiftCardTransactionResponse,
    GiftCardBalanceResponse,
    GiftCardStatsResponse,
    RedeemRequest,
    TopUpRequest,
)
from app.services.gift_card_service import GiftCardService

router = APIRouter(prefix="/gift-cards", tags=["Gift Cards"])


def _card_to_response(card) -> GiftCardResponse:
    """Convert gift card model to response schema."""
    return GiftCardResponse(
        id=str(card.id),
        business_id=str(card.business_id),
        code=card.code,
        initial_value=card.initial_value,
        current_balance=card.current_balance,
        status=card.status,
        customer_id=str(card.customer_id) if card.customer_id else None,
        customer_name=card.customer_name,
        customer_email=card.customer_email,
        expires_at=card.expires_at,
        notes=card.notes,
        transactions=[
            GiftCardTransactionResponse(
                id=str(tx.id),
                gift_card_id=str(tx.gift_card_id),
                transaction_type=tx.transaction_type,
                amount=tx.amount,
                balance_after=tx.balance_after,
                reference=tx.reference,
                notes=tx.notes,
                performed_by=str(tx.performed_by) if tx.performed_by else None,
                created_at=tx.created_at,
            )
            for tx in (card.transactions or [])
        ],
        created_at=card.created_at,
        updated_at=card.updated_at,
    )


@router.post("", response_model=GiftCardResponse, status_code=status.HTTP_201_CREATED)
async def issue_gift_card(
    data: GiftCardCreate,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Issue a new gift card."""
    service = GiftCardService(db)
    try:
        card = service.create_gift_card(
            business_id=business_id,
            initial_value=data.initial_value,
            customer_name=data.customer_name,
            customer_email=data.customer_email,
            customer_id=data.customer_id,
            expires_at=data.expires_at,
            notes=data.notes,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    return _card_to_response(card)


@router.get("", response_model=GiftCardListResponse)
async def list_gift_cards(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status_filter: Optional[GiftCardStatus] = Query(None, alias="status"),
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """List gift cards with optional status filter."""
    service = GiftCardService(db)
    cards, total = service.list_gift_cards(
        business_id=business_id,
        status=status_filter,
        page=page,
        per_page=per_page,
    )
    return GiftCardListResponse(
        items=[_card_to_response(c) for c in cards],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.get("/stats", response_model=GiftCardStatsResponse)
async def get_stats(
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get gift card statistics."""
    service = GiftCardService(db)
    stats = service.get_stats(business_id)
    return GiftCardStatsResponse(**stats)


@router.get("/{card_id}", response_model=GiftCardResponse)
async def get_gift_card(
    card_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get a gift card by ID."""
    service = GiftCardService(db)
    card = service.get_gift_card(card_id, business_id)
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gift card not found",
        )
    return _card_to_response(card)


@router.get("/code/{code}", response_model=GiftCardResponse)
async def get_by_code(
    code: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Look up a gift card by its code."""
    service = GiftCardService(db)
    card = service.get_by_code(code, business_id)
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gift card not found",
        )
    return _card_to_response(card)


@router.post("/{card_id}/redeem", response_model=GiftCardTransactionResponse)
async def redeem(
    card_id: str,
    data: RedeemRequest,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Redeem an amount from a gift card."""
    service = GiftCardService(db)
    try:
        tx = service.redeem(
            card_id=card_id,
            business_id=business_id,
            amount=data.amount,
            reference=data.reference,
            performed_by=str(current_user.id),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    return GiftCardTransactionResponse(
        id=str(tx.id),
        gift_card_id=str(tx.gift_card_id),
        transaction_type=tx.transaction_type,
        amount=tx.amount,
        balance_after=tx.balance_after,
        reference=tx.reference,
        notes=tx.notes,
        performed_by=str(tx.performed_by) if tx.performed_by else None,
        created_at=tx.created_at,
    )


@router.post("/{card_id}/top-up", response_model=GiftCardTransactionResponse)
async def top_up(
    card_id: str,
    data: TopUpRequest,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Top up a gift card balance."""
    service = GiftCardService(db)
    try:
        tx = service.top_up(
            card_id=card_id,
            business_id=business_id,
            amount=data.amount,
            performed_by=str(current_user.id),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    return GiftCardTransactionResponse(
        id=str(tx.id),
        gift_card_id=str(tx.gift_card_id),
        transaction_type=tx.transaction_type,
        amount=tx.amount,
        balance_after=tx.balance_after,
        reference=tx.reference,
        notes=tx.notes,
        performed_by=str(tx.performed_by) if tx.performed_by else None,
        created_at=tx.created_at,
    )


@router.get("/{card_id}/balance", response_model=GiftCardBalanceResponse)
async def check_balance(
    card_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Check the balance of a gift card."""
    service = GiftCardService(db)
    card = service.get_gift_card(card_id, business_id)
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gift card not found",
        )
    return GiftCardBalanceResponse(
        code=card.code,
        current_balance=card.current_balance,
        status=card.status,
        expires_at=card.expires_at,
    )


@router.patch("/{card_id}/cancel", response_model=GiftCardResponse)
async def cancel_gift_card(
    card_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Cancel a gift card."""
    service = GiftCardService(db)
    try:
        card = service.cancel_gift_card(card_id, business_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    return _card_to_response(card)
