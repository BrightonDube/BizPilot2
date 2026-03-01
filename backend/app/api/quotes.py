"""Proforma invoice (quote) API endpoints."""

import math
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel as PydanticBase, ConfigDict

from app.api.deps import get_current_active_user, get_current_business_id
from app.core.database import get_sync_db
from app.models.user import User
from app.services.proforma_service import ProformaService

router = APIRouter(prefix="/quotes", tags=["Proforma Invoices"])


# ---------- Schemas ----------


class QuoteItemCreate(PydanticBase):
    product_id: Optional[str] = None
    description: str
    quantity: Decimal = Decimal("1")
    unit_price: Decimal
    discount_pct: Decimal = Decimal("0")
    tax_rate: Decimal = Decimal("15")


class QuoteCreate(PydanticBase):
    customer_id: Optional[str] = None
    validity_days: int = 30
    notes: Optional[str] = None
    terms: Optional[str] = None
    items: list[QuoteItemCreate] = []


class QuoteItemResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    product_id: Optional[str] = None
    description: str
    quantity: Decimal
    unit_price: Decimal
    discount_pct: Decimal
    tax_rate: Decimal
    line_total: Decimal


class QuoteResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    business_id: str
    customer_id: Optional[str] = None
    quote_number: str
    status: str
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None
    validity_days: int
    subtotal: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    total: Decimal
    notes: Optional[str] = None
    terms: Optional[str] = None
    converted_invoice_id: Optional[str] = None
    created_at: Optional[datetime] = None


class QuoteListResponse(PydanticBase):
    items: list[QuoteResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ---------- Endpoints ----------


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
    )
    return _quote_to_response(quote)


@router.get("", response_model=QuoteListResponse)
async def list_quotes(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    customer_id: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List proforma invoices with optional filters."""
    service = ProformaService(db)
    items, total = service.list_quotes(
        business_id, status=status_filter, customer_id=customer_id,
        page=page, per_page=per_page,
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
    """Get a proforma invoice by ID."""
    service = ProformaService(db)
    quote = service.get_quote(str(quote_id), business_id)
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return _quote_to_response(quote)


@router.patch("/{quote_id}/approve", response_model=QuoteResponse)
async def approve_quote(
    quote_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Approve a quote."""
    service = ProformaService(db)
    quote = service.approve_quote(str(quote_id), business_id)
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return _quote_to_response(quote)


@router.patch("/{quote_id}/reject", response_model=QuoteResponse)
async def reject_quote(
    quote_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Reject a quote."""
    service = ProformaService(db)
    quote = service.reject_quote(str(quote_id), business_id)
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return _quote_to_response(quote)


@router.post("/{quote_id}/convert")
async def convert_quote(
    quote_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Convert an approved quote into an invoice."""
    service = ProformaService(db)
    try:
        return service.convert_to_invoice(str(quote_id), business_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


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


# ---------- Helpers ----------


def _quote_to_response(quote) -> QuoteResponse:
    return QuoteResponse(
        id=str(quote.id),
        business_id=str(quote.business_id),
        customer_id=str(quote.customer_id) if quote.customer_id else None,
        quote_number=quote.quote_number,
        status=quote.status.value if hasattr(quote.status, "value") else str(quote.status),
        issue_date=quote.issue_date.isoformat() if quote.issue_date else None,
        expiry_date=quote.expiry_date.isoformat() if quote.expiry_date else None,
        validity_days=quote.validity_days or 30,
        subtotal=quote.subtotal or Decimal("0"),
        tax_amount=quote.tax_amount or Decimal("0"),
        discount_amount=quote.discount_amount or Decimal("0"),
        total=quote.total or Decimal("0"),
        notes=quote.notes,
        terms=quote.terms,
        converted_invoice_id=str(quote.converted_invoice_id) if quote.converted_invoice_id else None,
        created_at=quote.created_at,
    )
