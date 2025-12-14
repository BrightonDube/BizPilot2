"""Inventory API endpoints."""

import math
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_active_user, get_current_business_id
from app.core.rbac import has_permission
from app.models.user import User
from app.models.inventory import TransactionType
from app.schemas.inventory import (
    InventoryItemCreate,
    InventoryItemUpdate,
    InventoryItemResponse,
    InventoryItemListResponse,
    InventoryAdjustment,
    InventoryTransactionResponse,
    InventorySummary,
)
from app.services.inventory_service import InventoryService

router = APIRouter(prefix="/inventory", tags=["Inventory"])


def _item_to_response(item) -> InventoryItemResponse:
    """Convert inventory item to response schema."""
    return InventoryItemResponse(
        id=str(item.id),
        business_id=str(item.business_id),
        product_id=str(item.product_id),
        quantity_on_hand=item.quantity_on_hand,
        quantity_reserved=item.quantity_reserved,
        quantity_incoming=item.quantity_incoming,
        quantity_available=item.quantity_available,
        reorder_point=item.reorder_point,
        reorder_quantity=item.reorder_quantity,
        location=item.location,
        bin_location=item.bin_location,
        average_cost=item.average_cost,
        last_cost=item.last_cost,
        is_low_stock=item.is_low_stock,
        stock_value=item.stock_value,
        last_counted_at=item.last_counted_at,
        last_received_at=item.last_received_at,
        last_sold_at=item.last_sold_at,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _transaction_to_response(transaction) -> InventoryTransactionResponse:
    """Convert transaction to response schema."""
    return InventoryTransactionResponse(
        id=str(transaction.id),
        business_id=str(transaction.business_id),
        product_id=str(transaction.product_id),
        transaction_type=transaction.transaction_type,
        quantity_change=transaction.quantity_change,
        quantity_before=transaction.quantity_before,
        quantity_after=transaction.quantity_after,
        unit_cost=transaction.unit_cost,
        total_cost=transaction.total_cost,
        reference_type=transaction.reference_type,
        reference_id=str(transaction.reference_id) if transaction.reference_id else None,
        notes=transaction.notes,
        from_location=transaction.from_location,
        to_location=transaction.to_location,
        user_id=str(transaction.user_id) if transaction.user_id else None,
        created_at=transaction.created_at,
    )


@router.get("", response_model=InventoryItemListResponse)
async def list_inventory(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    low_stock_only: bool = False,
    location: Optional[str] = None,
    sort_by: str = Query("created_at", pattern="^(quantity_on_hand|location|created_at|updated_at)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    business_id: str = Depends(get_current_business_id),
):
    """List inventory items with filtering and pagination."""
    service = InventoryService(db)
    items, total = service.get_inventory_items(
        business_id=business_id,
        page=page,
        per_page=per_page,
        low_stock_only=low_stock_only,
        location=location,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    
    return InventoryItemListResponse(
        items=[_item_to_response(item) for item in items],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.get("/summary", response_model=InventorySummary)
async def get_inventory_summary(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get inventory summary statistics."""
    service = InventoryService(db)
    summary = service.get_inventory_summary(business_id)
    return InventorySummary(**summary)


@router.get("/low-stock", response_model=list[InventoryItemResponse])
async def get_low_stock_items(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get items below reorder point."""
    service = InventoryService(db)
    items = service.get_low_stock_items(business_id)
    return [_item_to_response(item) for item in items]


@router.get("/transactions", response_model=list[InventoryTransactionResponse])
async def list_transactions(
    product_id: Optional[str] = None,
    transaction_type: Optional[TransactionType] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    business_id: str = Depends(get_current_business_id),
):
    """List inventory transactions."""
    service = InventoryService(db)
    transactions, _ = service.get_transactions(
        business_id=business_id,
        product_id=product_id,
        transaction_type=transaction_type,
        page=page,
        per_page=per_page,
    )
    return [_transaction_to_response(t) for t in transactions]


@router.get("/{item_id}", response_model=InventoryItemResponse)
async def get_inventory_item(
    item_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get an inventory item by ID."""
    service = InventoryService(db)
    item = service.get_inventory_item(item_id, business_id)
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found",
        )
    
    return _item_to_response(item)


@router.get("/product/{product_id}", response_model=InventoryItemResponse)
async def get_inventory_by_product(
    product_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get inventory for a specific product."""
    service = InventoryService(db)
    item = service.get_inventory_by_product(product_id, business_id)
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory not found for this product",
        )
    
    return _item_to_response(item)


@router.post("", response_model=InventoryItemResponse, status_code=status.HTTP_201_CREATED)
async def create_inventory_item(
    data: InventoryItemCreate,
    current_user: User = Depends(has_permission("inventory:create")),
    db: Session = Depends(get_db),
    business_id: str = Depends(get_current_business_id),
):
    """Create a new inventory item."""
    service = InventoryService(db)
    
    # Check if product already has inventory
    existing = service.get_inventory_by_product(data.product_id, business_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inventory item already exists for this product",
        )
    
    item = service.create_inventory_item(business_id, data)
    return _item_to_response(item)


@router.put("/{item_id}", response_model=InventoryItemResponse)
async def update_inventory_item(
    item_id: str,
    data: InventoryItemUpdate,
    current_user: User = Depends(has_permission("inventory:edit")),
    db: Session = Depends(get_db),
    business_id: str = Depends(get_current_business_id),
):
    """Update an inventory item."""
    service = InventoryService(db)
    item = service.get_inventory_item(item_id, business_id)
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found",
        )
    
    item = service.update_inventory_item(item, data)
    return _item_to_response(item)


@router.post("/{item_id}/adjust", response_model=InventoryTransactionResponse)
async def adjust_inventory(
    item_id: str,
    data: InventoryAdjustment,
    current_user: User = Depends(has_permission("inventory:edit")),
    db: Session = Depends(get_db),
    business_id: str = Depends(get_current_business_id),
):
    """Adjust inventory quantity."""
    service = InventoryService(db)
    item = service.get_inventory_item(item_id, business_id)
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found",
        )
    
    try:
        transaction = service.adjust_inventory(item, data, str(current_user.id))
        return _transaction_to_response(transaction)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
