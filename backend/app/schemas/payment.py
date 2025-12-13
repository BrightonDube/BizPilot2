"""Payment schemas for API validation."""

from datetime import date
from typing import Optional, List
from pydantic import BaseModel, Field
from uuid import UUID
from enum import Enum


class PaymentStatus(str, Enum):
    """Payment status enum."""
    
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"


class PaymentMethod(str, Enum):
    """Payment method enum."""
    
    CASH = "cash"
    CARD = "card"
    BANK_TRANSFER = "bank_transfer"
    MOBILE = "mobile"
    CHECK = "check"
    OTHER = "other"


class PaymentBase(BaseModel):
    """Base payment schema."""
    
    invoice_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    amount: float = Field(..., gt=0)
    payment_method: PaymentMethod = PaymentMethod.CASH
    payment_date: date = Field(default_factory=date.today)
    reference: Optional[str] = None
    notes: Optional[str] = None


class PaymentCreate(PaymentBase):
    """Schema for creating a payment."""
    pass


class PaymentUpdate(BaseModel):
    """Schema for updating a payment."""
    
    amount: Optional[float] = Field(None, gt=0)
    payment_method: Optional[PaymentMethod] = None
    status: Optional[PaymentStatus] = None
    payment_date: Optional[date] = None
    reference: Optional[str] = None
    notes: Optional[str] = None


class PaymentResponse(BaseModel):
    """Schema for payment response."""
    
    id: UUID
    payment_number: str
    invoice_id: Optional[UUID] = None
    invoice_number: Optional[str] = None
    customer_id: Optional[UUID] = None
    customer_name: Optional[str] = None
    amount: float
    payment_method: str
    status: str
    payment_date: date
    reference: Optional[str] = None
    notes: Optional[str] = None
    
    model_config = {"from_attributes": True}


class PaymentListResponse(BaseModel):
    """Schema for paginated payment list response."""
    
    items: List[PaymentResponse]
    total: int
    skip: int
    limit: int
