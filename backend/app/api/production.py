"""Production API endpoints."""

import math
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_business_id
from app.core.rbac import has_permission
from app.models.production import ProductionStatus
from app.models.user import User
from app.schemas.production import (
    ProductionOrderCreate,
    ProductionOrderUpdate,
    ProductionOrderResponse,
    ProductionOrderListResponse,
    ProductionOrderItemResponse,
    CompleteProductionRequest,
    IngredientSuggestion,
)
from app.services.production_service import ProductionService

router = APIRouter(prefix="/production", tags=["Production"])


def _order_to_response(order) -> ProductionOrderResponse:
    """Convert a ProductionOrder model to ProductionOrderResponse schema."""
    items = [
        ProductionOrderItemResponse(
            id=str(item.id),
            business_id=str(item.business_id),
            production_order_id=str(item.production_order_id),
            source_product_id=str(item.source_product_id) if item.source_product_id else None,
            source_product_name=item.source_product.name if item.source_product else None,
            name=item.name,
            unit=item.unit,
            quantity_required=item.quantity_required,
            quantity_used=item.quantity_used,
            unit_cost=item.unit_cost,
            line_total=item.line_total,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        for item in (order.items or [])
    ]

    return ProductionOrderResponse(
        id=str(order.id),
        business_id=str(order.business_id),
        product_id=str(order.product_id),
        order_number=order.order_number,
        product_name=order.product.name if order.product else None,
        quantity_to_produce=order.quantity_to_produce,
        quantity_produced=order.quantity_produced,
        status=order.status,
        scheduled_date=order.scheduled_date,
        started_at=order.started_at,
        completed_at=order.completed_at,
        estimated_cost=order.estimated_cost,
        actual_cost=order.actual_cost,
        notes=order.notes,
        completion_percentage=order.completion_percentage,
        items=items,
        created_at=order.created_at,
        updated_at=order.updated_at,
    )


@router.get("", response_model=ProductionOrderListResponse)
async def list_production_orders(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[ProductionStatus] = None,
    product_id: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(has_permission("inventory:view")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """List production orders with filtering and pagination."""
    service = ProductionService(db)
    orders, total = service.get_production_orders(
        business_id=business_id,
        page=page,
        per_page=per_page,
        status=status,
        product_id=product_id,
        search=search,
    )

    return ProductionOrderListResponse(
        items=[_order_to_response(order) for order in orders],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=math.ceil(total / per_page) if per_page > 0 else 0,
    )


@router.get("/ingredients/suggestions", response_model=List[IngredientSuggestion])
async def get_ingredient_suggestions(
    query: str = Query("", description="Search query for ingredients"),
    product_context: Optional[str] = Query(None, description="Product ID for context"),
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(has_permission("products:view")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Get AI-powered ingredient suggestions based on search query."""
    service = ProductionService(db)
    suggestions = service.get_ingredient_suggestions(
        business_id=business_id,
        query=query,
        product_context=product_context,
        limit=limit,
    )
    return suggestions


@router.get("/{order_id}", response_model=ProductionOrderResponse)
async def get_production_order(
    order_id: str,
    current_user: User = Depends(has_permission("inventory:view")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Get a production order by ID."""
    service = ProductionService(db)
    order = service.get_production_order(order_id, business_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Production order not found",
        )

    return _order_to_response(order)


@router.post("", response_model=ProductionOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_production_order(
    data: ProductionOrderCreate,
    current_user: User = Depends(has_permission("inventory:edit")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Create a new production order."""
    service = ProductionService(db)
    try:
        order = service.create_production_order(
            business_id=business_id,
            data=data,
            user_id=str(current_user.id),
        )
        return _order_to_response(order)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.put("/{order_id}", response_model=ProductionOrderResponse)
async def update_production_order(
    order_id: str,
    data: ProductionOrderUpdate,
    current_user: User = Depends(has_permission("inventory:edit")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Update a production order."""
    service = ProductionService(db)
    order = service.get_production_order(order_id, business_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Production order not found",
        )

    order = service.update_production_order(order, data)
    return _order_to_response(order)


@router.post("/{order_id}/start", response_model=ProductionOrderResponse)
async def start_production(
    order_id: str,
    current_user: User = Depends(has_permission("inventory:edit")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Start a production order."""
    service = ProductionService(db)
    order = service.get_production_order(order_id, business_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Production order not found",
        )

    try:
        order = service.start_production(order)
        return _order_to_response(order)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/{order_id}/complete", response_model=ProductionOrderResponse)
async def complete_production(
    order_id: str,
    data: CompleteProductionRequest,
    current_user: User = Depends(has_permission("inventory:edit")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Complete a production order and update inventory."""
    service = ProductionService(db)
    order = service.get_production_order(order_id, business_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Production order not found",
        )

    try:
        order = service.complete_production(
            order=order,
            quantity_produced=data.quantity_produced,
            actual_cost=data.actual_cost,
        )
        return _order_to_response(order)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/{order_id}/cancel", response_model=ProductionOrderResponse)
async def cancel_production(
    order_id: str,
    current_user: User = Depends(has_permission("inventory:edit")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Cancel a production order."""
    service = ProductionService(db)
    order = service.get_production_order(order_id, business_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Production order not found",
        )

    try:
        order = service.cancel_production(order)
        return _order_to_response(order)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_production_order(
    order_id: str,
    current_user: User = Depends(has_permission("inventory:delete")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Delete a production order."""
    service = ProductionService(db)
    order = service.get_production_order(order_id, business_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Production order not found",
        )

    try:
        service.delete_production_order(order)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
