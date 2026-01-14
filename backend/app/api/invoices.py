"""Invoice API endpoints."""

import math
from typing import Optional
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_active_user, get_current_business_id
from app.core.rbac import has_permission
from app.models.user import User
from app.models.invoice import InvoiceStatus, InvoiceType
from app.models.customer import Customer
from app.models.supplier import Supplier
from app.core.pdf import build_simple_pdf, build_invoice_pdf
from app.schemas.invoice import (
    InvoiceCreate,
    InvoiceUpdate,
    InvoiceResponse,
    InvoiceListResponse,
    InvoiceItemResponse,
    PaymentRecord,
    InvoiceSummary,
    InitiateSupplierPaymentRequest,
    InitiateSupplierPaymentResponse,
    VerifySupplierPaymentRequest,
    VerifySupplierPaymentResponse,
)
from app.services.invoice_service import InvoiceService
from app.services.paystack_service import paystack_service

router = APIRouter(prefix="/invoices", tags=["Invoices"])


def _invoice_to_response(invoice, items=None, customer_name: str = None, supplier_name: str = None) -> InvoiceResponse:
    """Convert invoice model to response schema."""
    return InvoiceResponse(
        id=str(invoice.id),
        business_id=str(invoice.business_id),
        customer_id=str(invoice.customer_id) if invoice.customer_id else None,
        customer_name=customer_name,
        supplier_id=str(invoice.supplier_id) if invoice.supplier_id else None,
        supplier_name=supplier_name,
        order_id=str(invoice.order_id) if invoice.order_id else None,
        invoice_number=invoice.invoice_number,
        invoice_type=invoice.invoice_type or InvoiceType.CUSTOMER,
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
        is_supplier_invoice=invoice.is_supplier_invoice,
        pdf_url=invoice.pdf_url,
        paystack_reference=invoice.paystack_reference,
        gateway_fee=invoice.gateway_fee or Decimal("0"),
        gateway_fee_percent=invoice.gateway_fee_percent or Decimal("1.5"),
        total_with_gateway_fee=invoice.total_with_gateway_fee,
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
    
    # Build a cache of supplier IDs to names
    supplier_ids = [str(inv.supplier_id) for inv in invoices if inv.supplier_id]
    supplier_names = {}
    if supplier_ids:
        suppliers = db.query(Supplier).filter(Supplier.id.in_(supplier_ids)).all()
        for supplier in suppliers:
            supplier_names[str(supplier.id)] = supplier.name
    
    invoice_responses = []
    for invoice in invoices:
        items = service.get_invoice_items(str(invoice.id))
        customer_name = customer_names.get(str(invoice.customer_id)) if invoice.customer_id else None
        supplier_name = supplier_names.get(str(invoice.supplier_id)) if invoice.supplier_id else None
        invoice_responses.append(_invoice_to_response(invoice, items, customer_name, supplier_name))
    
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


@router.get("/unpaid", response_model=InvoiceListResponse)
async def get_unpaid_invoices(
    per_page: int = Query(100, ge=1, le=200),
    search: Optional[str] = Query(None, description="Search by invoice number"),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """
    Get all unpaid or partially paid invoices for payment linking.
    Returns invoices with status: sent, viewed, partial, or overdue.
    Supports optional search by invoice number. Customer name filtering
    is done client-side for better UX.
    """
    from app.models.invoice import Invoice
    
    query = db.query(Invoice).filter(
        Invoice.business_id == business_id,
        Invoice.deleted_at.is_(None),
        Invoice.status.in_([
            InvoiceStatus.SENT,
            InvoiceStatus.VIEWED,
            InvoiceStatus.PARTIAL,
            InvoiceStatus.OVERDUE,
        ])
    )
    
    # Apply invoice_number search filter in SQL if provided
    if search:
        query = query.filter(Invoice.invoice_number.ilike(f"%{search}%"))
    
    invoices = query.order_by(Invoice.created_at.desc()).limit(per_page).all()
    
    # Build customer names
    customer_ids = [str(inv.customer_id) for inv in invoices if inv.customer_id]
    customer_names = {}
    if customer_ids:
        customers = db.query(Customer).filter(Customer.id.in_(customer_ids)).all()
        for customer in customers:
            name = f"{customer.first_name} {customer.last_name}"
            if customer.company_name:
                name = customer.company_name
            customer_names[str(customer.id)] = name
    
    # Build supplier names
    supplier_ids = [str(inv.supplier_id) for inv in invoices if inv.supplier_id]
    supplier_names = {}
    if supplier_ids:
        suppliers = db.query(Supplier).filter(Supplier.id.in_(supplier_ids)).all()
        for supplier in suppliers:
            supplier_names[str(supplier.id)] = supplier.name
    
    service = InvoiceService(db)
    invoice_responses = []
    for invoice in invoices:
        items = service.get_invoice_items(str(invoice.id))
        customer_name = customer_names.get(str(invoice.customer_id)) if invoice.customer_id else None
        supplier_name = supplier_names.get(str(invoice.supplier_id)) if invoice.supplier_id else None
        invoice_responses.append(_invoice_to_response(invoice, items, customer_name, supplier_name))
    
    return InvoiceListResponse(
        items=invoice_responses,
        total=len(invoice_responses),
        page=1,
        per_page=per_page,
        pages=1,
    )


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
    
    # Get customer name if exists
    customer_name = None
    if invoice.customer_id:
        customer = db.query(Customer).filter(Customer.id == invoice.customer_id).first()
        if customer:
            customer_name = customer.company_name or f"{customer.first_name} {customer.last_name}"
    
    # Get supplier name if exists
    supplier_name = None
    if invoice.supplier_id:
        supplier = db.query(Supplier).filter(Supplier.id == invoice.supplier_id).first()
        if supplier:
            supplier_name = supplier.name
    
    items = service.get_invoice_items(str(invoice.id))
    return _invoice_to_response(invoice, items, customer_name, supplier_name)


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


# Supplier Payment Endpoints (Paystack Integration)

@router.post("/{invoice_id}/pay", response_model=InitiateSupplierPaymentResponse)
async def initiate_supplier_payment(
    invoice_id: str,
    data: InitiateSupplierPaymentRequest,
    current_user: User = Depends(has_permission("invoices:edit")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """
    Initiate a payment for a supplier invoice via Paystack.
    
    This endpoint:
    1. Validates the invoice is a supplier invoice with a balance due
    2. Calculates the gateway fee (typically 1.5% of the invoice total)
    3. Creates a Paystack transaction for the total + gateway fee
    4. Returns the authorization URL for the user to complete payment
    """
    service = InvoiceService(db)
    invoice = service.get_invoice(invoice_id, business_id)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    
    # Validate this is a supplier invoice
    if not invoice.is_supplier_invoice:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This is not a supplier invoice. Only supplier invoices can be paid via gateway.",
        )
    
    # Check if already paid
    if invoice.is_paid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This invoice has already been paid.",
        )
    
    # Check if already has a pending payment
    if invoice.paystack_reference:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A payment has already been initiated for this invoice. Please verify the existing payment first.",
        )
    
    # Calculate gateway fee (typically 1.5% of total, but can be set per invoice)
    gateway_fee_percent = float(invoice.gateway_fee_percent or 1.5)
    invoice_total = float(invoice.balance_due)
    gateway_fee = round(invoice_total * (gateway_fee_percent / 100), 2)
    total_to_pay = invoice_total + gateway_fee
    
    # Generate a unique reference
    reference = paystack_service.generate_reference(prefix="SUP")
    
    # Initialize Paystack transaction
    # Amount is in kobo/cents (smallest currency unit)
    amount_cents = int(total_to_pay * 100)
    
    transaction = await paystack_service.initialize_transaction(
        email=current_user.email,
        amount_cents=amount_cents,
        reference=reference,
        callback_url=data.callback_url,
        metadata={
            "invoice_id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "business_id": str(business_id),
            "payment_type": "supplier_invoice",
            "invoice_amount": str(invoice_total),
            "gateway_fee": str(gateway_fee),
        },
    )
    
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to initialize payment with Paystack. Please try again.",
        )
    
    # Store the payment reference on the invoice
    invoice.paystack_reference = transaction.reference
    invoice.paystack_access_code = transaction.access_code
    invoice.gateway_fee = Decimal(str(gateway_fee))
    db.commit()
    
    return InitiateSupplierPaymentResponse(
        reference=transaction.reference,
        authorization_url=transaction.authorization_url,
        access_code=transaction.access_code,
        invoice_total=Decimal(str(invoice_total)),
        gateway_fee=Decimal(str(gateway_fee)),
        total_to_pay=Decimal(str(total_to_pay)),
    )


@router.post("/{invoice_id}/verify-payment", response_model=VerifySupplierPaymentResponse)
async def verify_supplier_payment(
    invoice_id: str,
    data: VerifySupplierPaymentRequest,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """
    Verify a supplier payment after Paystack callback.
    
    This endpoint:
    1. Verifies the payment with Paystack
    2. If successful, marks the invoice as paid
    3. Returns the payment status
    """
    service = InvoiceService(db)
    invoice = service.get_invoice(invoice_id, business_id)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    
    # Verify the reference matches
    if invoice.paystack_reference != data.reference:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment reference does not match this invoice.",
        )
    
    # Verify with Paystack
    verification = await paystack_service.verify_transaction(data.reference)
    
    if not verification:
        return VerifySupplierPaymentResponse(
            status="failed",
            message="Unable to verify payment with Paystack. Please contact support.",
            invoice_id=str(invoice.id),
            invoice_number=invoice.invoice_number,
        )
    
    paystack_status = verification.get("status", "").lower()
    
    if paystack_status == "success":
        # Payment successful - update invoice
        amount_paid = verification.get("amount", 0) / 100  # Convert from kobo to rands
        
        # The amount paid includes gateway fee, so we record the invoice balance as paid
        invoice.amount_paid = invoice.total
        invoice.status = InvoiceStatus.PAID
        invoice.paid_date = date.today()
        db.commit()
        
        return VerifySupplierPaymentResponse(
            status="success",
            message="Payment verified successfully. Invoice has been marked as paid.",
            invoice_id=str(invoice.id),
            invoice_number=invoice.invoice_number,
            amount_paid=Decimal(str(float(invoice.total))),
            gateway_fee=invoice.gateway_fee,
        )
    elif paystack_status == "pending":
        return VerifySupplierPaymentResponse(
            status="pending",
            message="Payment is still being processed. Please wait.",
            invoice_id=str(invoice.id),
            invoice_number=invoice.invoice_number,
        )
    else:
        # Payment failed - clear the reference so user can try again
        invoice.paystack_reference = None
        invoice.paystack_access_code = None
        invoice.gateway_fee = Decimal("0")
        db.commit()
        
        return VerifySupplierPaymentResponse(
            status="failed",
            message=f"Payment failed: {verification.get('gateway_response', 'Unknown error')}",
            invoice_id=str(invoice.id),
            invoice_number=invoice.invoice_number,
        )


@router.delete("/{invoice_id}/cancel-payment", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_pending_payment(
    invoice_id: str,
    current_user: User = Depends(has_permission("invoices:edit")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """
    Cancel a pending supplier payment.
    
    This allows the user to start a new payment if the previous one was abandoned.
    """
    service = InvoiceService(db)
    invoice = service.get_invoice(invoice_id, business_id)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    
    if not invoice.paystack_reference:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending payment to cancel.",
        )
    
    # Clear the payment reference
    invoice.paystack_reference = None
    invoice.paystack_access_code = None
    invoice.gateway_fee = Decimal("0")
    db.commit()
