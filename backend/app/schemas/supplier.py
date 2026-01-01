"""Supplier schemas for API validation."""

from typing import Optional, List
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime


class SupplierBase(BaseModel):
    """Base schema for supplier."""

    name: str = Field(..., min_length=1, max_length=255)
    contact_name: Optional[str] = Field(None, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)

    tax_number: Optional[str] = Field(None, max_length=100)
    website: Optional[str] = Field(None, max_length=255)

    address_line1: Optional[str] = Field(None, max_length=255)
    address_line2: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    country: Optional[str] = Field(None, max_length=100)

    notes: Optional[str] = None
    tags: List[str] = []


class SupplierCreate(SupplierBase):
    """Schema for creating a supplier."""

    pass


class SupplierUpdate(BaseModel):
    """Schema for updating a supplier."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    contact_name: Optional[str] = Field(None, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)

    tax_number: Optional[str] = Field(None, max_length=100)
    website: Optional[str] = Field(None, max_length=255)

    address_line1: Optional[str] = Field(None, max_length=255)
    address_line2: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    country: Optional[str] = Field(None, max_length=100)

    notes: Optional[str] = None
    tags: Optional[List[str]] = None


class SupplierResponse(SupplierBase):
    """Schema for supplier response."""

    id: str
    business_id: str
    display_name: str
    full_address: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SupplierListResponse(BaseModel):
    """Schema for paginated supplier list."""

    items: List[SupplierResponse]
    total: int
    page: int
    per_page: int
    pages: int
