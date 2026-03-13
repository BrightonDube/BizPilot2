"""Proforma invoice (quote) API endpoints.

Covers quote CRUD, approval workflow, conversion, reporting,
shareable links, and audit trail (Requirements 1–11).
"""

import math
from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.api.deps import get_current_active_user, get_current_business_id
from app.core.database import get_sync_db
from app.models.user import User
from app.schemas.proforma import (
    QuoteCreate,
    QuoteUpdate,
    QuoteResponse,
    QuoteListResponse,
    QuoteItemResponse,
    QuoteApprovalRequest,
    QuoteRejectionRequest,
    QuoteCancelRequest,
    QuoteExtendRequest,
    ConversionRateReport,
)
from app.services.proforma_service import ProformaService
from app.services.proforma_report_service import ProformaReportService

router = APIRouter(prefix="/quotes", tags=["Proforma Invoices"])


# ── Reports (before /{quote_id} to avoid path conflicts) ─────────────


@router.get("/reports/conversion-rate", response_model=ConversionRateReport)
async def conversion_rate_report(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get quote conversion rate analytics."""
    service = ProformaReportService(db)
    return service.get_conversion_rate(business_id)


@router.get("/reports/value")
async def value_report(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get quote value statistics for a date range."""
    service = ProformaReportService(db)
    return service.get_value_report(business_id, start_date, end_date)


@router.get("/reports/aging")
async def aging_report(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get quote aging report with buckets."""
    service = ProformaReportService(db)
    return service.get_aging_report(business_id)


@router.get("/reports/lost")
async def lost_quotes_report(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get analysis of rejected and expired quotes."""
    service = ProformaReportService(db)
    return service.get_lost_quotes(business_id, start_date, end_date)


# ── Shareable Link (public, no auth) ─────────────────────────────────


@router.get("/public/{token}")
async def view_quote_public(token: str, request: Request, db=Depends(get_sync_db)):
    """Public endpoint for customers to view a quote via shareable link.

    Records the view event and returns quote details without auth.
    """
    service = ProformaService(db)
    quote = service.record_view(
        token,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found or link expired")
    return _quote_to_response(quote)


@router.post("/public/{token}/approve")
async def approve_quote_public(
    token: str,
    data: QuoteApprovalRequest,
    request: Request,
    db=Depends(get_sync_db),
):
    """Public endpoint for customers to approve a quote."""
    service = ProformaService(db)
    try:
        quote = service.approve_quote_by_token(
            token,
            customer_name=data.customer_name,
            customer_email=data.customer_email,
            signature_data=data.signature_data,
            notes=data.notes,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return _quote_to_response(quote)


@router.post("/public/{token}/reject")
async def reject_quote_public(
    token: str,
    data: QuoteRejectionRequest,
    request: Request,
    db=Depends(get_sync_db),
):
    """Public endpoint for customers to reject a quote."""
    service = ProformaService(db)
    try:
        quote = service.reject_quote_by_token(
            token,
            reason=data.reason,
            customer_name=data.customer_name,
            customer_email=data.customer_email,
            ip_address=request.client.host if request.client else None,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return _quote_to_response(quote)


# ── Expire Maintenance ────────────────────────────────────────────────


@router.post("/expire-old")
async def expire_old_quotes(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Mark expired quotes past their validity date."""
    service = ProformaService(db)
    count = service.expire_old_quotes(business_id)
    return {"expired_count": count}


# ── CRUD ──────────────────────────────────────────────────────────────


@router.post("", response_model=QuoteResponse, status_code=status.HTTP_201_CREATED)
async def create_quote(
    data: QuoteCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Create a new proforma invoice (quote)."""
    service = ProformaService(db)
    items_data = [item.model_dump() for item in data.items]
    quote = service.create_quote(
        business_id=business_id,
        customer_id=data.customer_id,
        validity_days=data.validity_days,
        notes=data.notes,
        terms=data.terms,
        items=items_data,
        discount_pct=data.discount_pct,
        created_by=str(current_user.id),
    )
    return _quote_to_response(quote)


@router.get("", response_model=QuoteListResponse)
async def list_quotes(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    customer_id: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List proforma invoices with optional filters and search."""
    service = ProformaService(db)
    items, total = service.list_quotes(
        business_id, status=status_filter, customer_id=customer_id,
        search=search, page=page, per_page=per_page,
    )
    return QuoteListResponse(
        items=[_quote_to_response(q) for q in items],
        total=total,
        page=page,
        per_page=per_page,
        pages=max(1, math.ceil(total / per_page)),
    )


@router.get("/{quote_id}", response_model=QuoteResponse)
async def get_quote(
    quote_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get a proforma invoice by ID with all details."""
    service = ProformaService(db)
    quote = service.get_quote(str(quote_id), business_id)
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return _quote_to_response(quote)


@router.put("/{quote_id}", response_model=QuoteResponse)
async def update_quote(
    quote_id: UUID,
    data: QuoteUpdate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Update a draft quote. Only DRAFT status quotes can be edited."""
    service = ProformaService(db)
    update_data = data.model_dump(exclude_unset=True)
    if "items" in update_data and update_data["items"] is not None:
        update_data["items"] = [item.model_dump() for item in data.items]
    try:
        quote = service.update_quote(
            str(quote_id), business_id, user_id=str(current_user.id), **update_data,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return _quote_to_response(quote)


@router.post("/{quote_id}/duplicate", response_model=QuoteResponse, status_code=201)
async def duplicate_quote(
    quote_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Duplicate an existing quote as a new draft."""
    service = ProformaService(db)
    try:
        new_quote = service.duplicate_quote(str(quote_id), business_id, str(current_user.id))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _quote_to_response(new_quote)


# ── Actions ───────────────────────────────────────────────────────────


@router.patch("/{quote_id}/send", response_model=QuoteResponse)
async def send_quote(
    quote_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Mark a quote as sent to the customer."""
    service = ProformaService(db)
    try:
        quote = service.send_quote(str(quote_id), business_id, str(current_user.id))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return _quote_to_response(quote)


@router.patch("/{quote_id}/approve", response_model=QuoteResponse)
async def approve_quote(
    quote_id: UUID,
    data: QuoteApprovalRequest = None,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Approve a quote (staff or customer action)."""
    service = ProformaService(db)
    quote = service.approve_quote(
        str(quote_id), business_id,
        customer_name=data.customer_name if data else None,
        customer_email=data.customer_email if data else None,
        signature_data=data.signature_data if data else None,
        notes=data.notes if data else None,
    )
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return _quote_to_response(quote)


@router.patch("/{quote_id}/reject", response_model=QuoteResponse)
async def reject_quote(
    quote_id: UUID,
    data: QuoteRejectionRequest = None,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Reject a quote with optional reason."""
    service = ProformaService(db)
    quote = service.reject_quote(
        str(quote_id), business_id,
        reason=data.reason if data else None,
        customer_name=data.customer_name if data else None,
        customer_email=data.customer_email if data else None,
    )
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return _quote_to_response(quote)


@router.patch("/{quote_id}/cancel", response_model=QuoteResponse)
async def cancel_quote(
    quote_id: UUID,
    data: QuoteCancelRequest,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Cancel a quote with a reason."""
    service = ProformaService(db)
    try:
        quote = service.cancel_quote(str(quote_id), business_id, data.reason, str(current_user.id))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return _quote_to_response(quote)


@router.patch("/{quote_id}/extend", response_model=QuoteResponse)
async def extend_validity(
    quote_id: UUID,
    data: QuoteExtendRequest,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Extend the validity period of a quote."""
    service = ProformaService(db)
    quote = service.extend_validity(str(quote_id), business_id, data.additional_days, str(current_user.id))
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return _quote_to_response(quote)


@router.post("/{quote_id}/convert")
async def convert_quote(
    quote_id: UUID,
    selected_item_ids: Optional[list[str]] = None,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Convert an approved quote into an invoice (full or partial)."""
    service = ProformaService(db)
    try:
        return service.convert_to_invoice(
            str(quote_id), business_id,
            selected_item_ids=selected_item_ids,
            user_id=str(current_user.id),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Audit Trail ───────────────────────────────────────────────────────


@router.get("/{quote_id}/audit")
async def get_audit_trail(
    quote_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """Get the full audit trail for a quote."""
    service = ProformaService(db)
    entries = service.get_audit_trail(str(quote_id))
    return [
        {
            "id": str(e.id),
            "proforma_id": str(e.proforma_id),
            "action": e.action,
            "performed_by": str(e.performed_by) if e.performed_by else None,
            "old_value": e.old_value,
            "new_value": e.new_value,
            "details": e.details,
            "created_at": e.created_at,
        }
        for e in entries
    ]


# ── Revisions ─────────────────────────────────────────────────────────


@router.post("/{quote_id}/revisions", status_code=201)
async def create_revision(
    quote_id: UUID,
    change_summary: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Snapshot the current state of a quote as a new revision."""
    from app.models.proforma import ProformaRevision
    import uuid as _uuid

    service = ProformaService(db)
    quote = service.get_quote(str(quote_id), business_id)
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    existing = (
        db.query(ProformaRevision)
        .filter(ProformaRevision.proforma_id == quote.id)
        .count()
    )
    rev_number = existing + 1

    items_data = []
    for item in (quote.items or []):
        items_data.append({
            "description": item.description,
            "quantity": str(item.quantity),
            "unit_price": str(item.unit_price),
            "discount_pct": str(item.discount_pct),
            "tax_rate": str(item.tax_rate),
            "line_total": str(item.line_total),
        })

    snapshot = {
        "quote_number": quote.quote_number,
        "status": quote.status.value if hasattr(quote.status, "value") else str(quote.status),
        "subtotal": str(quote.subtotal or 0),
        "tax_amount": str(quote.tax_amount or 0),
        "discount_amount": str(quote.discount_amount or 0),
        "total": str(quote.total or 0),
        "notes": quote.notes,
        "terms": quote.terms,
        "items": items_data,
    }

    revision = ProformaRevision(
        id=_uuid.uuid4(),
        proforma_id=quote.id,
        revision_number=rev_number,
        created_by=current_user.id,
        change_summary=change_summary,
        snapshot=snapshot,
    )
    db.add(revision)
    db.commit()
    db.refresh(revision)

    return {
        "id": str(revision.id),
        "proforma_id": str(revision.proforma_id),
        "revision_number": revision.revision_number,
        "change_summary": revision.change_summary,
        "created_at": revision.created_at,
    }


@router.get("/{quote_id}/revisions")
async def list_revisions(
    quote_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """List all revisions for a quote, ordered by revision number."""
    from app.models.proforma import ProformaRevision

    revisions = (
        db.query(ProformaRevision)
        .filter(ProformaRevision.proforma_id == quote_id)
        .order_by(ProformaRevision.revision_number)
        .all()
    )
    return [
        {
            "id": str(r.id),
            "proforma_id": str(r.proforma_id),
            "revision_number": r.revision_number,
            "change_summary": r.change_summary,
            "snapshot": r.snapshot,
            "created_at": r.created_at,
        }
        for r in revisions
    ]


# ── Helpers ───────────────────────────────────────────────────────────


def _quote_to_response(quote) -> QuoteResponse:
    """Convert a ProformaInvoice model to the API response schema."""
    items = []
    for item in (quote.items or []):
        if getattr(item, "deleted_at", None):
            continue
        items.append(QuoteItemResponse(
            id=item.id,
            proforma_id=item.proforma_id,
            product_id=item.product_id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            discount_pct=item.discount_pct,
            tax_rate=item.tax_rate,
            line_total=item.line_total,
            is_converted=getattr(item, "is_converted", False) or False,
        ))

    return QuoteResponse(
        id=str(quote.id),
        business_id=str(quote.business_id),
        customer_id=str(quote.customer_id) if quote.customer_id else None,
        created_by=str(quote.created_by) if getattr(quote, "created_by", None) else None,
        quote_number=quote.quote_number,
        status=quote.status.value if hasattr(quote.status, "value") else str(quote.status),
        issue_date=quote.issue_date.isoformat() if quote.issue_date else None,
        expiry_date=quote.expiry_date.isoformat() if quote.expiry_date else None,
        validity_days=quote.validity_days or 30,
        subtotal=quote.subtotal or Decimal("0"),
        tax_amount=quote.tax_amount or Decimal("0"),
        discount_amount=quote.discount_amount or Decimal("0"),
        discount_pct=getattr(quote, "discount_pct", None) or Decimal("0"),
        total=quote.total or Decimal("0"),
        notes=quote.notes,
        terms=quote.terms,
        approval_token=getattr(quote, "approval_token", None),
        approved_at=getattr(quote, "approved_at", None),
        approved_by_name=getattr(quote, "approved_by_name", None),
        rejection_reason=getattr(quote, "rejection_reason", None),
        rejected_at=getattr(quote, "rejected_at", None),
        viewed_at=getattr(quote, "viewed_at", None),
        cancellation_reason=getattr(quote, "cancellation_reason", None),
        cancelled_at=getattr(quote, "cancelled_at", None),
        converted_invoice_id=str(quote.converted_invoice_id) if quote.converted_invoice_id else None,
        converted_at=getattr(quote, "converted_at", None),
        created_at=quote.created_at,
        items=items,
    )
