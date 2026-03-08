"""Pydantic schemas for proforma invoices (quotes).

Covers creation, update, response, approval, audit, and report schemas.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ── Item Schemas ──────────────────────────────────────────────────────────


class QuoteItemCreate(BaseModel):
    """Schema for adding a line item to a quote."""

    product_id: Optional[str] = None
    description: str
    quantity: Decimal = Decimal("1")
    unit_price: Decimal
    discount_pct: Decimal = Decimal("0")
    tax_rate: Decimal = Decimal("15")


class QuoteItemUpdate(BaseModel):
    """Schema for updating an existing line item."""

    description: Optional[str] = None
    quantity: Optional[Decimal] = None
    unit_price: Optional[Decimal] = None
    discount_pct: Optional[Decimal] = None
    tax_rate: Optional[Decimal] = None


class QuoteItemResponse(BaseModel):
    """Response schema for a quote line item."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    proforma_id: UUID
    product_id: Optional[UUID] = None
    description: str
    quantity: Decimal
    unit_price: Decimal
    discount_pct: Decimal
    tax_rate: Decimal
    line_total: Decimal
    is_converted: bool = False


# ── Quote Schemas ─────────────────────────────────────────────────────────


class QuoteCreate(BaseModel):
    """Schema for creating a new proforma invoice."""

    customer_id: Optional[str] = None
    validity_days: int = 30
    notes: Optional[str] = None
    terms: Optional[str] = None
    discount_pct: Decimal = Decimal("0")
    items: list[QuoteItemCreate] = []


class QuoteUpdate(BaseModel):
    """Schema for updating a draft quote."""

    customer_id: Optional[str] = None
    validity_days: Optional[int] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    discount_pct: Optional[Decimal] = None
    items: Optional[list[QuoteItemCreate]] = None


class QuoteResponse(BaseModel):
    """Full response schema for a proforma invoice."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    business_id: str
    customer_id: Optional[str] = None
    created_by: Optional[str] = None
    quote_number: str
    status: str
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None
    validity_days: int
    subtotal: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    discount_pct: Decimal = Decimal("0")
    total: Decimal
    notes: Optional[str] = None
    terms: Optional[str] = None
    approval_token: Optional[str] = None
    approved_at: Optional[datetime] = None
    approved_by_name: Optional[str] = None
    rejection_reason: Optional[str] = None
    rejected_at: Optional[datetime] = None
    viewed_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    cancelled_at: Optional[datetime] = None
    converted_invoice_id: Optional[str] = None
    converted_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    items: list[QuoteItemResponse] = []


class QuoteListResponse(BaseModel):
    """Paginated list of quotes."""

    items: list[QuoteResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ── Approval Schemas ──────────────────────────────────────────────────────


class QuoteApprovalRequest(BaseModel):
    """Customer approval submission."""

    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    signature_data: Optional[str] = None
    notes: Optional[str] = None


class QuoteRejectionRequest(BaseModel):
    """Customer rejection submission."""

    reason: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None


class QuoteCancelRequest(BaseModel):
    """Cancellation request."""

    reason: str


class QuoteExtendRequest(BaseModel):
    """Request to extend validity."""

    additional_days: int = Field(ge=1, le=365)


# ── Revision Schemas ──────────────────────────────────────────────────────


class ProformaRevisionCreate(BaseModel):
    """Create a new revision of a proforma invoice."""

    change_summary: Optional[str] = None


class ProformaRevisionResponse(BaseModel):
    """Response schema for a proforma revision."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    proforma_id: UUID
    revision_number: int
    created_by: Optional[UUID] = None
    change_summary: Optional[str] = None
    snapshot: dict[str, Any]
    created_at: datetime


# ── Audit Schemas ─────────────────────────────────────────────────────────


class ProformaAuditResponse(BaseModel):
    """Response schema for an audit trail entry."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    proforma_id: UUID
    action: str
    performed_by: Optional[UUID] = None
    old_value: Optional[dict] = None
    new_value: Optional[dict] = None
    details: Optional[str] = None
    created_at: datetime


# ── Report Schemas ────────────────────────────────────────────────────────


class ConversionRateReport(BaseModel):
    """Quote conversion rate statistics."""

    total_quotes: int
    approved: int
    converted: int
    rejected: int
    expired: int
    cancelled: int
    conversion_rate: float
    approval_rate: float


class QuoteValueReport(BaseModel):
    """Aggregate quote value statistics for a period."""

    period_start: date
    period_end: date
    total_quotes: int
    total_value: Decimal
    avg_value: Decimal
    min_value: Decimal
    max_value: Decimal


class QuoteAgingReport(BaseModel):
    """Quote aging buckets by days outstanding."""

    bucket_0_7: int = 0
    bucket_8_14: int = 0
    bucket_15_30: int = 0
    bucket_30_plus: int = 0
    total: int = 0


class LostQuoteItem(BaseModel):
    """A single lost (rejected/expired) quote summary."""

    quote_id: str
    quote_number: str
    customer_id: Optional[str] = None
    total: Decimal
    status: str
    reason: Optional[str] = None
    created_at: Optional[datetime] = None


class LostQuotesReport(BaseModel):
    """Analysis of rejected and expired quotes."""

    total_lost: int
    total_value: Decimal
    rejected_count: int
    expired_count: int
    items: list[LostQuoteItem]
