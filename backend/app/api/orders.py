"""Order API endpoints."""

import math
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response

from app.core.database import get_sync_db
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
    ReceivePurchaseOrder,
    ReceivePurchaseOrderResponse,
)
from app.services.order_service import OrderService
from app.services.inventory_service import InventoryService
from app.services.email_service import EmailService, EmailAttachment
from app.core.pdf import build_invoice_pdf, build_purchase_order_pdf
from app.models.product import Product
from app.models.base import utc_now

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
    db=Depends(get_sync_db),
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
    db=Depends(get_sync_db),
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
    db=Depends(get_sync_db),
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
    db=Depends(get_sync_db),
):
    """Return a professionally styled PDF document for a given order.

    Parameters:
        order_id: The order ID to render.
        current_user: Authenticated user (required).
        business_id: Current business scope (required).

    Returns:
        A PDF response (`application/pdf`) as an attachment with filename
        "{order_number}.pdf".

    Raises:
        HTTPException: 404 if the order is not found. Authentication/authorization
        errors may also be raised by dependencies.
    """
    from app.models.business import Business
    
    service = OrderService(db)
    order = service.get_order(order_id, business_id)

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    items = service.get_order_items(str(order.id))
    
    # Get business name
    business = db.query(Business).filter(Business.id == business_id).first()
    business_name = business.name if business else "BizPilot"
    
    # Get customer/supplier name
    if order.direction == OrderDirection.INBOUND:
        party_name = order.customer.company_name if order.customer else None
        if not party_name and order.customer:
            party_name = f"{order.customer.first_name} {order.customer.last_name}".strip()
    else:
        party_name = order.supplier.name if order.supplier else None

    # Convert items to dict format for PDF builder
    items_data = [
        {
            "description": it.name or "",
            "quantity": it.quantity,
            "unit_price": it.unit_price,
            "tax_amount": it.tax_amount or 0,
            "total": it.total,
        }
        for it in items
    ]

    pdf_bytes = build_invoice_pdf(
        business_name=business_name,
        invoice_number=order.order_number,
        status=order.status.value if hasattr(order.status, 'value') else str(order.status),
        customer_name=party_name,
        billing_address=order.billing_address,
        issue_date=order.order_date,
        due_date=None,
        items=items_data,
        subtotal=order.subtotal,
        tax_amount=order.tax_amount,
        discount_amount=order.discount_amount or 0,
        total=order.total,
        amount_paid=order.amount_paid,
        balance_due=order.balance_due,
        notes=order.notes,
        terms=None,
        currency="ZAR",
    )
    
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
    db=Depends(get_sync_db),
):
    """Create a new order."""
    from app.models.business import Business
    
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

        # Get business details for the PDF
        business = db.query(Business).filter(Business.id == business_id).first()
        
        # Build business address
        business_address_parts = []
        if business.address_street:
            business_address_parts.append(business.address_street)
        if business.address_city or business.address_state:
            city_state = ", ".join(filter(None, [business.address_city, business.address_state]))
            business_address_parts.append(city_state)
        if business.address_postal_code:
            business_address_parts.append(business.address_postal_code)
        if business.address_country:
            business_address_parts.append(business.address_country)
        business_address = "\n".join(business_address_parts) if business_address_parts else None
        
        # Build supplier address
        supplier_address = supplier.full_address if supplier else None

        items_for_pdf = service.get_order_items(str(order.id))
        
        # Convert items to dict format for PDF builder
        items_data = [
            {
                "description": it.name or "",
                "quantity": it.quantity,
                "unit_price": it.unit_price,
                "tax_amount": it.tax_amount or 0,
                "total": it.total,
            }
            for it in items_for_pdf
        ]
        
        # Build the professional purchase order PDF
        pdf_bytes = build_purchase_order_pdf(
            # Business (buyer) details
            business_name=business.name if business else "BizPilot",
            business_address=business_address,
            business_phone=business.phone if business else None,
            business_email=business.email if business else None,
            business_vat=business.vat_number if business else None,
            # Supplier details
            supplier_name=supplier.name if supplier else "",
            supplier_contact=supplier.contact_name if supplier else None,
            supplier_address=supplier_address,
            supplier_phone=supplier.phone if supplier else None,
            supplier_email=supplier.email if supplier else None,
            # Order details
            order_number=order.order_number,
            order_date=order.order_date,
            # Ordered by (current user)
            ordered_by_name=f"{current_user.first_name} {current_user.last_name}".strip() or current_user.email,
            ordered_by_email=current_user.email,
            ordered_by_phone=current_user.phone if hasattr(current_user, 'phone') else None,
            # Items
            items=items_data,
            subtotal=order.subtotal,
            tax_amount=order.tax_amount,
            total=order.total,
            # Notes
            notes=order.notes,
            currency=business.currency if business else "ZAR",
        )

        if settings.EMAILS_ENABLED and supplier.email:
            email_service = EmailService()
            
            # Build email body with reply-to instruction
            reply_to_email = business.email if business else None
            email_body = f"Please find attached purchase order {order.order_number}."
            if reply_to_email:
                email_body += f"\n\nFor any queries regarding this order, please reply to: {reply_to_email}"
            
            try:
                email_service.send_email(
                    to_email=supplier.email,
                    subject=f"Purchase Order {order.order_number} from {business.name if business else 'BizPilot'}",
                    body_text=email_body,
                    attachments=[
                        EmailAttachment(
                            filename=f"{order.order_number}.pdf",
                            content=pdf_bytes,
                            content_type="application/pdf",
                        )
                    ],
                    reply_to=reply_to_email,
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
    db=Depends(get_sync_db),
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
    db=Depends(get_sync_db),
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
    db=Depends(get_sync_db),
):
    """Record a payment for an order."""
    service = OrderService(db)
    order = service.get_order(order_id, business_id)

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
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
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
    db=Depends(get_sync_db),
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
    db=Depends(get_sync_db),
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
    db=Depends(get_sync_db),
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


@router.post("/{order_id}/receive", response_model=ReceivePurchaseOrderResponse)
async def receive_purchase_order(
    order_id: str,
    data: ReceivePurchaseOrder,
    current_user: User = Depends(has_permission("orders:edit")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """
    Receive a purchase order and update inventory.
    
    This endpoint:
    1. Validates the order is a purchase order (outbound direction)
    2. Updates quantities and prices for each item
    3. Updates inventory with received quantities
    4. Updates product costs if price changed
    5. Marks the order as received
    """
    from decimal import Decimal
    
    order_service = OrderService(db)
    inventory_service = InventoryService(db)
    
    # Get the order
    order = order_service.get_order(order_id, business_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    
    # Validate it's a purchase order (outbound)
    if order.direction != OrderDirection.OUTBOUND:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only receive purchase orders (outbound orders)",
        )
    
    # Check order isn't already received or cancelled
    if order.status in [OrderStatus.RECEIVED, OrderStatus.CANCELLED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Order is already {order.status.value}",
        )
    
    # Get order items
    order_items = order_service.get_order_items(str(order.id))
    item_map = {str(item.id): item for item in order_items}
    
    items_received = 0
    total_quantity_received = 0
    inventory_updated = True
    errors = []
    
    for receive_item in data.items:
        item = item_map.get(receive_item.item_id)
        if not item:
            errors.append(f"Item {receive_item.item_id} not found in order")
            continue
        
        if receive_item.quantity_received <= 0:
            continue
        
        # Update item price if changed - ensure Decimal type
        current_price = Decimal(str(item.unit_price)) if item.unit_price is not None else Decimal("0")
        new_price = Decimal(str(receive_item.unit_price)) if receive_item.unit_price is not None else current_price
        
        if receive_item.unit_price is not None and new_price != current_price:
            item.unit_price = new_price
            # Recalculate item total (handle nullable discount_amount and tax_amount)
            discount = Decimal(str(item.discount_amount or 0))
            tax = Decimal(str(item.tax_amount or 0))
            item.total = new_price * item.quantity - discount + tax
        
        # Update inventory if product exists
        if item.product_id:
            try:
                # Record purchase in inventory (updates quantity and average cost)
                result = inventory_service.record_purchase(
                    product_id=str(item.product_id),
                    business_id=business_id,
                    quantity=receive_item.quantity_received,
                    unit_cost=new_price,
                    purchase_order_id=str(order.id),
                )
                
                # If no inventory item exists, log a warning but continue
                if result is None:
                    errors.append(f"No inventory record for {item.name} - inventory not updated")
                    inventory_updated = False
                
                # Update product cost price if changed (verify product belongs to current business)
                if receive_item.unit_price is not None:
                    product = db.query(Product).filter(
                        Product.id == item.product_id,
                        Product.business_id == business_id,
                        Product.deleted_at.is_(None),
                    ).first()
                    if product:
                        product.cost_price = new_price
                
            except ValueError as e:
                errors.append(f"Failed to update inventory for {item.name}: {str(e)}")
                inventory_updated = False
            except Exception as e:
                errors.append(f"Error updating inventory for {item.name}: {str(e)}")
                inventory_updated = False
        
        items_received += 1
        total_quantity_received += receive_item.quantity_received
    
    # Update order status to received
    order.status = OrderStatus.RECEIVED
    order.delivered_date = utc_now()
    
    # Add receiving notes if provided
    if data.notes:
        existing_notes = order.internal_notes or ""
        order.internal_notes = f"{existing_notes}\n[Received] {data.notes}".strip()
    
    db.commit()
    
    message = f"Successfully received {items_received} items ({total_quantity_received} units)"
    if errors:
        message += f". Warnings: {'; '.join(errors)}"
    
    return ReceivePurchaseOrderResponse(
        success=True,
        order_id=str(order.id),
        order_number=order.order_number,
        status=order.status.value,
        items_received=items_received,
        total_quantity_received=total_quantity_received,
        inventory_updated=inventory_updated,
        message=message,
    )
