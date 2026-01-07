"""Invoice API endpoints."""

import math
from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_active_user, get_current_business_id
from app.core.rbac import has_permission
from app.models.user import User
from app.models.invoice import InvoiceStatus
from app.models.customer import Customer
from app.core.pdf import build_simple_pdf, build_invoice_pdf
from app.schemas.invoice import (
    InvoiceCreate,
    InvoiceUpdate,
    InvoiceResponse,
    InvoiceListResponse,
    InvoiceItemResponse,
    PaymentRecord,
    InvoiceSummary,
)
from app.services.invoice_service import InvoiceService

router = APIRouter(prefix="/invoices", tags=["Invoices"])


def _invoice_to_response(invoice, items=None, customer_name: str = None) -> InvoiceResponse:
    """Convert invoice model to response schema."""
    return InvoiceResponse(
        id=str(invoice.id),
        business_id=str(invoice.business_id),
        customer_id=str(invoice.customer_id) if invoice.customer_id else None,
        customer_name=customer_name,
        order_id=str(invoice.order_id) if invoice.order_id else None,
        invoice_number=invoice.invoice_number,
        status=invoice.status,
        issue_date=invoice.issue_date,
        due_date=invoice.due_date,
        paid_date=invoice.paid_date,
        billing_address=invoice.billing_address,
        notes=invoice.notes,
        terms=invoice.terms,
        footer=invoice.footer,
        subtotal=invoice.subtotal,
        tax_amount=invoice.tax_amount,
        discount_amount=invoice.discount_amount or 0,
        total=invoice.total,
        amount_paid=invoice.amount_paid,
        balance_due=invoice.balance_due,
        is_paid=invoice.is_paid,
        is_overdue=invoice.is_overdue,
        pdf_url=invoice.pdf_url,
        created_at=invoice.created_at,
        updated_at=invoice.updated_at,
        items=[_item_to_response(item) for item in (items or [])],
    )


def _item_to_response(item) -> InvoiceItemResponse:
    """Convert invoice item to response schema."""
    return InvoiceItemResponse(
        id=str(item.id),
        invoice_id=str(item.invoice_id),
        product_id=str(item.product_id) if item.product_id else None,
        description=item.description,
        quantity=item.quantity,
        unit_price=item.unit_price,
        tax_rate=item.tax_rate,
        tax_amount=item.tax_amount,
        discount_percent=item.discount_percent,
        discount_amount=item.discount_amount,
        total=item.total,
        line_total=item.line_total,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("", response_model=InvoiceListResponse)
async def list_invoices(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    customer_id: Optional[str] = None,
    status: Optional[InvoiceStatus] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    overdue_only: bool = False,
    sort_by: str = Query("created_at", pattern="^(invoice_number|total|status|issue_date|due_date|created_at|updated_at)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """List invoices with filtering and pagination."""
    service = InvoiceService(db)
    invoices, total = service.get_invoices(
        business_id=business_id,
        page=page,
        per_page=per_page,
        search=search,
        customer_id=customer_id,
        status=status,
        date_from=date_from,
        date_to=date_to,
        overdue_only=overdue_only,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    
    # Build a cache of customer IDs to names
    customer_ids = [str(inv.customer_id) for inv in invoices if inv.customer_id]
    customer_names = {}
    if customer_ids:
        customers = db.query(Customer).filter(Customer.id.in_(customer_ids)).all()
        for customer in customers:
            name = f"{customer.first_name} {customer.last_name}"
            if customer.company_name:
                name = customer.company_name
            customer_names[str(customer.id)] = name
    
    invoice_responses = []
    for invoice in invoices:
        items = service.get_invoice_items(str(invoice.id))
        customer_name = customer_names.get(str(invoice.customer_id)) if invoice.customer_id else None
        invoice_responses.append(_invoice_to_response(invoice, items, customer_name))
    
    return InvoiceListResponse(
        items=invoice_responses,
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.get("/stats", response_model=InvoiceSummary)
async def get_invoice_stats(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Get invoice statistics."""
    service = InvoiceService(db)
    stats = service.get_invoice_stats(business_id)
    return InvoiceSummary(**stats)


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: str,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Get an invoice by ID."""
    service = InvoiceService(db)
    invoice = service.get_invoice(invoice_id, business_id)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    
    items = service.get_invoice_items(str(invoice.id))
    return _invoice_to_response(invoice, items)


@router.get("/{invoice_id}/pdf")
async def get_invoice_pdf(
    invoice_id: str,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Generate a professionally styled PDF invoice."""
    from app.models.business import Business
    
    service = InvoiceService(db)
    invoice = service.get_invoice(invoice_id, business_id)

    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )

    items = service.get_invoice_items(str(invoice.id))
    
    # Get business name
    business = db.query(Business).filter(Business.id == business_id).first()
    business_name = business.name if business else "BizPilot"
    
    # Get customer name
    customer_name = None
    if invoice.customer_id:
        customer = db.query(Customer).filter(Customer.id == invoice.customer_id).first()
        if customer:
            customer_name = f"{customer.first_name} {customer.last_name}".strip()
            if customer.company_name:
                customer_name = customer.company_name

    # Convert items to dict format for PDF builder
    items_data = [
        {
            "description": it.description or "",
            "quantity": it.quantity,
            "unit_price": it.unit_price,
            "tax_amount": it.tax_amount,
            "total": it.total,
        }
        for it in items
    ]

    pdf_bytes = build_invoice_pdf(
        business_name=business_name,
        invoice_number=invoice.invoice_number,
        status=invoice.status.value if hasattr(invoice.status, 'value') else str(invoice.status),
        customer_name=customer_name,
        billing_address=invoice.billing_address,
        issue_date=invoice.issue_date,
        due_date=invoice.due_date,
        items=items_data,
        subtotal=invoice.subtotal,
        tax_amount=invoice.tax_amount,
        discount_amount=invoice.discount_amount or 0,
        total=invoice.total,
        amount_paid=invoice.amount_paid,
        balance_due=invoice.balance_due,
        notes=invoice.notes,
        terms=invoice.terms,
        currency="ZAR",
    )
    
    filename = f"{invoice.invoice_number}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    data: InvoiceCreate,
    current_user: User = Depends(has_permission("invoices:create")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Create a new invoice."""
    service = InvoiceService(db)
    invoice = service.create_invoice(business_id, data)
    items = service.get_invoice_items(str(invoice.id))
    return _invoice_to_response(invoice, items)


@router.put("/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: str,
    data: InvoiceUpdate,
    current_user: User = Depends(has_permission("invoices:edit")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Update an invoice."""
    service = InvoiceService(db)
    invoice = service.get_invoice(invoice_id, business_id)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    
    invoice = service.update_invoice(invoice, data)
    items = service.get_invoice_items(str(invoice.id))
    return _invoice_to_response(invoice, items)


@router.post("/{invoice_id}/send", response_model=InvoiceResponse)
async def send_invoice(
    invoice_id: str,
    current_user: User = Depends(has_permission("invoices:edit")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Send an invoice (mark as sent)."""
    service = InvoiceService(db)
    invoice = service.get_invoice(invoice_id, business_id)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    
    invoice = service.send_invoice(invoice)
    items = service.get_invoice_items(str(invoice.id))
    return _invoice_to_response(invoice, items)


@router.post("/{invoice_id}/payment", response_model=InvoiceResponse)
async def record_payment(
    invoice_id: str,
    data: PaymentRecord,
    current_user: User = Depends(has_permission("invoices:edit")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Record a payment for an invoice."""
    service = InvoiceService(db)
    invoice = service.get_invoice(invoice_id, business_id)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    
    if data.amount > invoice.balance_due:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment amount exceeds balance due",
        )
    
    invoice = service.record_payment(invoice, data.amount, data.payment_method)
    items = service.get_invoice_items(str(invoice.id))
    return _invoice_to_response(invoice, items)


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invoice(
    invoice_id: str,
    current_user: User = Depends(has_permission("invoices:delete")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Delete an invoice."""
    service = InvoiceService(db)
    invoice = service.get_invoice(invoice_id, business_id)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    
    service.delete_invoice(invoice)


@router.get("/{invoice_id}/items", response_model=list[InvoiceItemResponse])
async def get_invoice_items(
    invoice_id: str,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Get items for an invoice."""
    service = InvoiceService(db)
    invoice = service.get_invoice(invoice_id, business_id)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    
    items = service.get_invoice_items(str(invoice.id))
    return [_item_to_response(item) for item in items]
