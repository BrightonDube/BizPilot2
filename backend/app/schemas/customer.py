"""Customer schemas for API validation."""

from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime

from app.models.customer import CustomerType


class CustomerBase(BaseModel):
    """Base schema for customer."""
    
    customer_type: CustomerType = CustomerType.INDIVIDUAL
    
    # Contact info
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    
    # Company info
    company_name: Optional[str] = Field(None, max_length=255)
    tax_number: Optional[str] = Field(None, max_length=100)
    
    # Address
    address_line1: Optional[str] = Field(None, max_length=255)
    address_line2: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    country: Optional[str] = Field(None, max_length=100)
    
    # Additional info
    notes: Optional[str] = None
    tags: List[str] = []


class CustomerCreate(CustomerBase):
    """Schema for creating a customer."""
    pass


class CustomerUpdate(BaseModel):
    """Schema for updating a customer."""
    
    customer_type: Optional[CustomerType] = None
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=50)
    company_name: Optional[str] = Field(None, max_length=255)
    tax_number: Optional[str] = Field(None, max_length=100)
    address_line1: Optional[str] = Field(None, max_length=255)
    address_line2: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    country: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None
    tags: Optional[List[str]] = None


class CustomerResponse(CustomerBase):
    """Schema for customer response."""
    
    id: str
    business_id: str
    display_name: str
    full_address: str
    total_orders: int
    total_spent: Decimal
    average_order_value: Decimal
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}


class CustomerListResponse(BaseModel):
    """Schema for paginated customer list."""
    
    items: List[CustomerResponse]
    total: int
    page: int
    per_page: int
    pages: int


class CustomerBulkCreate(BaseModel):
    """Schema for bulk customer creation."""
    
    customers: List[CustomerCreate]


class CustomerBulkDelete(BaseModel):
    """Schema for bulk customer deletion."""
    
    customer_ids: List[str]


class CustomerMetrics(BaseModel):
    """Schema for customer metrics."""
    
    total_orders: int
    total_spent: Decimal
    average_order_value: Decimal
    first_order_date: Optional[datetime] = None
    last_order_date: Optional[datetime] = None
