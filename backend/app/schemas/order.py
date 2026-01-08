"""Order schemas for API validation."""

from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field
from datetime import datetime

from app.models.order import OrderStatus, PaymentStatus, OrderDirection


class AddressSchema(BaseModel):
    """Schema for address."""
    
    line1: Optional[str] = None
    line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None


class OrderItemBase(BaseModel):
    """Base schema for order item."""
    
    product_id: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=255)
    sku: Optional[str] = None
    description: Optional[str] = None
    unit_price: Decimal = Field(..., ge=0)
    quantity: int = Field(1, ge=1)
    tax_rate: Decimal = Field(Decimal("0"), ge=0, le=100)
    discount_percent: Decimal = Field(Decimal("0"), ge=0, le=100)
    notes: Optional[str] = None


class OrderItemCreate(OrderItemBase):
    """Schema for creating an order item."""
    pass


class OrderItemUpdate(BaseModel):
    """Schema for updating an order item."""
    
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    unit_price: Optional[Decimal] = Field(None, ge=0)
    quantity: Optional[int] = Field(None, ge=1)
    tax_rate: Optional[Decimal] = Field(None, ge=0, le=100)
    discount_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    notes: Optional[str] = None


class OrderItemResponse(OrderItemBase):
    """Schema for order item response."""
    
    id: str
    order_id: str
    discount_amount: Decimal
    tax_amount: Decimal
    total: Decimal
    line_total: float
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}


class OrderBase(BaseModel):
    """Base schema for order."""
    
    customer_id: Optional[str] = None
    supplier_id: Optional[str] = None
    direction: OrderDirection = OrderDirection.INBOUND
    status: OrderStatus = OrderStatus.DRAFT
    payment_status: PaymentStatus = PaymentStatus.PENDING
    payment_method: Optional[str] = None
    shipping_address: Optional[AddressSchema] = None
    billing_address: Optional[AddressSchema] = None
    notes: Optional[str] = None
    internal_notes: Optional[str] = None
    tags: List[str] = []
    source: str = "manual"


class OrderCreate(OrderBase):
    """Schema for creating an order."""
    
    items: List[OrderItemCreate] = []


class OrderUpdate(BaseModel):
    """Schema for updating an order."""
    
    customer_id: Optional[str] = None
    supplier_id: Optional[str] = None
    direction: Optional[OrderDirection] = None
    status: Optional[OrderStatus] = None
    payment_status: Optional[PaymentStatus] = None
    payment_method: Optional[str] = None
    shipping_address: Optional[AddressSchema] = None
    billing_address: Optional[AddressSchema] = None
    notes: Optional[str] = None
    internal_notes: Optional[str] = None
    tags: Optional[List[str]] = None
    shipping_amount: Optional[Decimal] = None
    discount_amount: Optional[Decimal] = None


class OrderResponse(OrderBase):
    """Schema for order response."""
    
    id: str
    business_id: str
    order_number: str
    customer_name: Optional[str] = None  # Computed from customer relationship
    supplier_name: Optional[str] = None  # Computed from supplier relationship
    subtotal: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    shipping_amount: Decimal
    total: Decimal
    amount_paid: Decimal
    balance_due: float
    is_paid: bool
    order_date: datetime
    shipped_date: Optional[datetime] = None
    delivered_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    items: List[OrderItemResponse] = []
    items_count: int = 0  # Number of line items
    
    model_config = {"from_attributes": True}


class OrderListResponse(BaseModel):
    """Schema for paginated order list."""
    
    items: List[OrderResponse]
    total: int
    page: int
    per_page: int
    pages: int


class OrderStatusUpdate(BaseModel):
    """Schema for updating order status."""
    
    status: OrderStatus


class PaymentRecord(BaseModel):
    """Schema for recording a payment."""
    
    amount: Decimal = Field(..., gt=0)
    payment_method: str = Field(..., min_length=1)
    reference: Optional[str] = None
    notes: Optional[str] = None


class OrderSummary(BaseModel):
    """Schema for order summary/stats."""
    
    total_orders: int
    total_revenue: Decimal
    average_order_value: Decimal
    pending_orders: int
    completed_orders: int


class ReceiveItemData(BaseModel):
    """Schema for individual item receiving data."""
    
    item_id: str
    quantity_received: int = Field(..., ge=0)
    unit_price: Optional[Decimal] = Field(None, ge=0)  # Updated price if changed


class ReceivePurchaseOrder(BaseModel):
    """Schema for receiving a purchase order."""
    
    items: List[ReceiveItemData]
    notes: Optional[str] = None


class ReceivePurchaseOrderResponse(BaseModel):
    """Response after receiving a purchase order."""
    
    success: bool
    order_id: str
    order_number: str
    status: str
    items_received: int
    total_quantity_received: int
    inventory_updated: bool
    message: str
