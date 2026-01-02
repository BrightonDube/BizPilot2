"""Order API endpoints."""

import math
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_active_user, get_current_business_id
from app.core.config import settings
from app.core.rbac import has_permission
from app.models.user import User
from app.models.order import OrderStatus, PaymentStatus, OrderDirection
from app.models.supplier import Supplier
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
from app.services.email_service import EmailService, EmailAttachment
from app.core.pdf import build_simple_pdf

router = APIRouter(prefix="/orders", tags=["Orders"])


def _order_to_response(order, items=None, customer_name: str = None) -> OrderResponse:
    """Convert order model to response schema."""
    return OrderResponse(
        id=str(order.id),
        business_id=str(order.business_id),
        customer_id=str(order.customer_id) if order.customer_id else None,
        supplier_id=str(order.supplier_id) if order.supplier_id else None,
        direction=order.direction,
        customer_name=customer_name,
        supplier_name=(order.supplier.name if getattr(order, "supplier", None) else None),
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
        items_count=len(items) if items else 0,
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
    supplier_id: Optional[str] = None,
    direction: Optional[OrderDirection] = None,
    status: Optional[OrderStatus] = None,
    payment_status: Optional[PaymentStatus] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    sort_by: str = Query("created_at", pattern="^(order_number|total|status|order_date|created_at|updated_at)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """
    List orders with filtering and pagination.
    """
    service = OrderService(db)
    orders, total = service.get_orders(
        business_id=business_id,
        page=page,
        per_page=per_page,
        search=search,
        customer_id=customer_id,
        supplier_id=supplier_id,
        direction=direction,
        status=status,
        payment_status=payment_status,
        date_from=date_from,
        date_to=date_to,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    
    # Build responses using eager-loaded relationships (no N+1 queries)
    order_responses = []
    for order in orders:
        # Items are eager-loaded via selectin relationship
        items = [item for item in (order.items or []) if item.deleted_at is None]
        
        # Customer is eager-loaded via joined relationship
        customer_name = None
        if order.customer:
            customer_name = order.customer.company_name or f"{order.customer.first_name} {order.customer.last_name}"
        
        order_responses.append(_order_to_response(order, items, customer_name))
    
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
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Get order statistics."""
    service = OrderService(db)
    stats = service.get_order_stats(business_id)
    return OrderSummary(**stats)


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: str,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Get an order by ID."""
    service = OrderService(db)
    order = service.get_order(order_id, business_id)
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    
    items = service.get_order_items(str(order.id))
    return _order_to_response(order, items)


@router.get("/{order_id}/pdf")
async def get_order_pdf(
    order_id: str,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    service = OrderService(db)
    order = service.get_order(order_id, business_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    items = service.get_order_items(str(order.id))

    lines: list[str] = []
    lines.append(f"Order: {order.order_number}")
    lines.append(f"Direction: {order.direction}")
    lines.append(f"Status: {order.status}")
    lines.append(f"Order Date: {order.order_date}")
    if order.direction == OrderDirection.INBOUND:
        lines.append(f"Customer: {order.customer.company_name if order.customer else ''}")
    else:
        lines.append(f"Supplier: {order.supplier.name if order.supplier else ''}")

    lines.append("")
    lines.append("Items:")
    for it in items:
        lines.append(f"- {it.name} | Qty: {it.quantity} | Unit: {it.unit_price} | Total: {it.total}")

    lines.append("")
    lines.append(f"Subtotal: {order.subtotal}")
    lines.append(f"VAT: {order.tax_amount}")
    lines.append(f"Discount: {order.discount_amount or 0}")
    lines.append(f"Shipping: {order.shipping_amount or 0}")
    lines.append(f"Total: {order.total}")

    pdf_bytes = build_simple_pdf(lines)
    filename = f"{order.order_number}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    data: OrderCreate,
    current_user: User = Depends(has_permission("orders:create")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Create a new order."""
    service = OrderService(db)

    supplier = None
    if data.direction == OrderDirection.OUTBOUND and data.supplier_id:
        supplier = db.query(Supplier).filter(
            Supplier.id == data.supplier_id,
            Supplier.business_id == business_id,
            Supplier.deleted_at.is_(None),
        ).first()

        if not supplier:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Supplier not found for outbound order",
            )

        if settings.EMAILS_ENABLED and not supplier.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Supplier has no email address",
            )

    order = service.create_order(business_id, data)

    if order.direction == OrderDirection.OUTBOUND and order.supplier_id:
        if not supplier:
            supplier = db.query(Supplier).filter(
                Supplier.id == order.supplier_id,
                Supplier.business_id == business_id,
                Supplier.deleted_at.is_(None),
            ).first()

        items_for_pdf = service.get_order_items(str(order.id))
        pdf_lines: list[str] = []
        pdf_lines.append(f"Purchase Order: {order.order_number}")
        pdf_lines.append(f"Supplier: {supplier.name if supplier else ''}")
        pdf_lines.append(f"Date: {order.order_date}")
        pdf_lines.append("")
        pdf_lines.append("Items:")
        for it in items_for_pdf:
            pdf_lines.append(f"- {it.name} | Qty: {it.quantity} | Unit: {it.unit_price} | Total: {it.total}")
        pdf_lines.append("")
        pdf_lines.append(f"Total: {order.total}")
        pdf_bytes = build_simple_pdf(pdf_lines)

        if settings.EMAILS_ENABLED and supplier.email:
            email_service = EmailService()
            try:
                email_service.send_email(
                    to_email=supplier.email,
                    subject=f"Purchase Order {order.order_number}",
                    body_text=f"Please find attached purchase order {order.order_number}.",
                    attachments=[
                        EmailAttachment(
                            filename=f"{order.order_number}.pdf",
                            content=pdf_bytes,
                            content_type="application/pdf",
                        )
                    ],
                )
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to send supplier email",
                )

    items = service.get_order_items(str(order.id))
    return _order_to_response(order, items)


@router.put("/{order_id}", response_model=OrderResponse)
async def update_order(
    order_id: str,
    data: OrderUpdate,
    current_user: User = Depends(has_permission("orders:edit")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Update an order."""
    service = OrderService(db)
    order = service.get_order(order_id, business_id)
    
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
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Update order status."""
    service = OrderService(db)
    order = service.get_order(order_id, business_id)
    
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
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    supplier = None
    if data.direction == OrderDirection.OUTBOUND:
        if not data.supplier_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Supplier is required for outbound order",
            )

        supplier = db.query(Supplier).filter(
            Supplier.id == data.supplier_id,
            Supplier.business_id == business_id,
            Supplier.deleted_at.is_(None),
        ).first()

        if not supplier:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Supplier not found for outbound order",
            )

        if settings.EMAILS_ENABLED and not supplier.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Supplier has no email address",
            )

    """Record a payment for an order."""
    service = OrderService(db)
    order = service.get_order(order_id, business_id)
    if order.direction == OrderDirection.OUTBOUND and supplier:
async def delete_order(
    order_id: str,
    current_user: User = Depends(has_permission("orders:delete")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Delete an order."""
    service = OrderService(db)
    order = service.get_order(order_id, business_id)
    
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
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Get items for an order."""
    service = OrderService(db)
    order = service.get_order(order_id, business_id)
    
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
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Add an item to an order."""
    service = OrderService(db)
    order = service.get_order(order_id, business_id)
    
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
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Remove an item from an order."""
    service = OrderService(db)
    order = service.get_order(order_id, business_id)
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    
    service.remove_order_item(order, item_id)
