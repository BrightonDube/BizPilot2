"""Invoice schemas for API validation."""

from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field
from datetime import datetime, date

from app.models.invoice import InvoiceStatus


class InvoiceItemBase(BaseModel):
    """Base schema for invoice item."""
    
    product_id: Optional[str] = None
    description: str = Field(..., min_length=1, max_length=500)
    quantity: Decimal = Field(Decimal("1"), gt=0)
    unit_price: Decimal = Field(..., ge=0)
    tax_rate: Decimal = Field(Decimal("0"), ge=0, le=100)
    discount_percent: Decimal = Field(Decimal("0"), ge=0, le=100)


class InvoiceItemCreate(InvoiceItemBase):
    """Schema for creating an invoice item."""
    pass


class InvoiceItemResponse(InvoiceItemBase):
    """Schema for invoice item response."""
    
    id: str
    invoice_id: str
    discount_amount: Decimal
    tax_amount: Decimal
    total: Decimal
    line_total: float
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}


class AddressSchema(BaseModel):
    """Schema for address."""
    
    line1: Optional[str] = None
    line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None


class InvoiceBase(BaseModel):
    """Base schema for invoice."""
    
    customer_id: Optional[str] = None
    order_id: Optional[str] = None
    status: InvoiceStatus = InvoiceStatus.DRAFT
    issue_date: date = Field(default_factory=date.today)
    due_date: Optional[date] = None
    billing_address: Optional[AddressSchema] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    footer: Optional[str] = None


class InvoiceCreate(InvoiceBase):
    """Schema for creating an invoice."""
    
    items: List[InvoiceItemCreate] = []


class InvoiceUpdate(BaseModel):
    """Schema for updating an invoice."""
    
    customer_id: Optional[str] = None
    status: Optional[InvoiceStatus] = None
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    billing_address: Optional[AddressSchema] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    footer: Optional[str] = None
    discount_amount: Optional[Decimal] = None


class InvoiceResponse(InvoiceBase):
    """Schema for invoice response."""
    
    id: str
    business_id: str
    invoice_number: str
    subtotal: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    total: Decimal
    amount_paid: Decimal
    balance_due: float
    is_paid: bool
    is_overdue: bool
    paid_date: Optional[date] = None
    pdf_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: List[InvoiceItemResponse] = []
    
    model_config = {"from_attributes": True}


class InvoiceListResponse(BaseModel):
    """Schema for paginated invoice list."""
    
    items: List[InvoiceResponse]
    total: int
    page: int
    per_page: int
    pages: int


class PaymentRecord(BaseModel):
    """Schema for recording a payment."""
    
    amount: Decimal = Field(..., gt=0)
    payment_method: str = Field(..., min_length=1)
    reference: Optional[str] = None
    notes: Optional[str] = None


class InvoiceSummary(BaseModel):
    """Schema for invoice summary/stats."""
    
    total_invoices: int
    total_amount: Decimal
    total_paid: Decimal
    total_outstanding: Decimal
    overdue_count: int
    overdue_amount: Decimal
