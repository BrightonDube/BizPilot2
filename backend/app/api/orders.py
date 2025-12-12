"""Order API endpoints."""

import math
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.core.rbac import has_permission
from app.models.user import User
from app.models.order import OrderStatus, PaymentStatus
from app.schemas.order import (
    OrderCreate,
    OrderUpdate,
    OrderResponse,
    OrderListResponse,
    OrderItemCreate,
    OrderItemResponse,
    OrderStatusUpdate,
    PaymentRecord,
    OrderSummary,
)
from app.services.order_service import OrderService

router = APIRouter(prefix="/orders", tags=["Orders"])

# Hardcoded business ID for demo - in production, get from user's current business
DEMO_BUSINESS_ID = "00000000-0000-0000-0000-000000000001"


def _order_to_response(order, items=None) -> OrderResponse:
    """Convert order model to response schema."""
    return OrderResponse(
        id=str(order.id),
        business_id=str(order.business_id),
        customer_id=str(order.customer_id) if order.customer_id else None,
        order_number=order.order_number,
        status=order.status,
        payment_status=order.payment_status,
        payment_method=order.payment_method,
        shipping_address=order.shipping_address,
        billing_address=order.billing_address,
        notes=order.notes,
        internal_notes=order.internal_notes,
        tags=order.tags or [],
        source=order.source,
        subtotal=order.subtotal,
        tax_amount=order.tax_amount,
        discount_amount=order.discount_amount or 0,
        shipping_amount=order.shipping_amount or 0,
        total=order.total,
        amount_paid=order.amount_paid,
        balance_due=order.balance_due,
        is_paid=order.is_paid,
        order_date=order.order_date,
        shipped_date=order.shipped_date,
        delivered_date=order.delivered_date,
        created_at=order.created_at,
        updated_at=order.updated_at,
        items=[_item_to_response(item) for item in (items or [])],
    )


def _item_to_response(item) -> OrderItemResponse:
    """Convert order item to response schema."""
    return OrderItemResponse(
        id=str(item.id),
        order_id=str(item.order_id),
        product_id=str(item.product_id) if item.product_id else None,
        name=item.name,
        sku=item.sku,
        description=item.description,
        unit_price=item.unit_price,
        quantity=item.quantity,
        tax_rate=item.tax_rate,
        tax_amount=item.tax_amount,
        discount_percent=item.discount_percent,
        discount_amount=item.discount_amount,
        total=item.total,
        line_total=item.line_total,
        notes=item.notes,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("", response_model=OrderListResponse)
async def list_orders(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    customer_id: Optional[str] = None,
    status: Optional[OrderStatus] = None,
    payment_status: Optional[PaymentStatus] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    sort_by: str = Query("created_at", pattern="^(order_number|total|status|order_date|created_at|updated_at)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    List orders with filtering and pagination.
    """
    service = OrderService(db)
    orders, total = service.get_orders(
        business_id=DEMO_BUSINESS_ID,
        page=page,
        per_page=per_page,
        search=search,
        customer_id=customer_id,
        status=status,
        payment_status=payment_status,
        date_from=date_from,
        date_to=date_to,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    
    # Get items for each order
    order_responses = []
    for order in orders:
        items = service.get_order_items(str(order.id))
        order_responses.append(_order_to_response(order, items))
    
    return OrderListResponse(
        items=order_responses,
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.get("/stats", response_model=OrderSummary)
async def get_order_stats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get order statistics."""
    service = OrderService(db)
    stats = service.get_order_stats(DEMO_BUSINESS_ID)
    return OrderSummary(**stats)


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get an order by ID."""
    service = OrderService(db)
    order = service.get_order(order_id, DEMO_BUSINESS_ID)
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    
    items = service.get_order_items(str(order.id))
    return _order_to_response(order, items)


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    data: OrderCreate,
    current_user: User = Depends(has_permission("orders:create")),
    db: Session = Depends(get_db),
):
    """Create a new order."""
    service = OrderService(db)
    order = service.create_order(DEMO_BUSINESS_ID, data)
    items = service.get_order_items(str(order.id))
    return _order_to_response(order, items)


@router.put("/{order_id}", response_model=OrderResponse)
async def update_order(
    order_id: str,
    data: OrderUpdate,
    current_user: User = Depends(has_permission("orders:edit")),
    db: Session = Depends(get_db),
):
    """Update an order."""
    service = OrderService(db)
    order = service.get_order(order_id, DEMO_BUSINESS_ID)
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    
    order = service.update_order(order, data)
    items = service.get_order_items(str(order.id))
    return _order_to_response(order, items)


@router.patch("/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: str,
    data: OrderStatusUpdate,
    current_user: User = Depends(has_permission("orders:edit")),
    db: Session = Depends(get_db),
):
    """Update order status."""
    service = OrderService(db)
    order = service.get_order(order_id, DEMO_BUSINESS_ID)
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    
    order = service.update_order_status(order, data.status)
    items = service.get_order_items(str(order.id))
    return _order_to_response(order, items)


@router.post("/{order_id}/payment", response_model=OrderResponse)
async def record_payment(
    order_id: str,
    data: PaymentRecord,
    current_user: User = Depends(has_permission("orders:edit")),
    db: Session = Depends(get_db),
):
    """Record a payment for an order."""
    service = OrderService(db)
    order = service.get_order(order_id, DEMO_BUSINESS_ID)
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    
    if data.amount > order.balance_due:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment amount exceeds balance due",
        )
    
    order = service.record_payment(order, data.amount, data.payment_method)
    items = service.get_order_items(str(order.id))
    return _order_to_response(order, items)


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_order(
    order_id: str,
    current_user: User = Depends(has_permission("orders:delete")),
    db: Session = Depends(get_db),
):
    """Delete an order."""
    service = OrderService(db)
    order = service.get_order(order_id, DEMO_BUSINESS_ID)
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    
    service.delete_order(order)


# Order Items endpoints
@router.get("/{order_id}/items", response_model=list[OrderItemResponse])
async def get_order_items(
    order_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get items for an order."""
    service = OrderService(db)
    order = service.get_order(order_id, DEMO_BUSINESS_ID)
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    
    items = service.get_order_items(str(order.id))
    return [_item_to_response(item) for item in items]


@router.post("/{order_id}/items", response_model=OrderItemResponse, status_code=status.HTTP_201_CREATED)
async def add_order_item(
    order_id: str,
    data: OrderItemCreate,
    current_user: User = Depends(has_permission("orders:edit")),
    db: Session = Depends(get_db),
):
    """Add an item to an order."""
    service = OrderService(db)
    order = service.get_order(order_id, DEMO_BUSINESS_ID)
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    
    item = service.add_order_item(order, data)
    return _item_to_response(item)


@router.delete("/{order_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_order_item(
    order_id: str,
    item_id: str,
    current_user: User = Depends(has_permission("orders:edit")),
    db: Session = Depends(get_db),
):
    """Remove an item from an order."""
    service = OrderService(db)
    order = service.get_order(order_id, DEMO_BUSINESS_ID)
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    
    service.remove_order_item(order, item_id)
