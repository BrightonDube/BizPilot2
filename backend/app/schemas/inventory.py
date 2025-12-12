"""Inventory schemas for API validation."""

from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field
from datetime import datetime

from app.models.inventory import TransactionType


class InventoryItemBase(BaseModel):
    """Base schema for inventory item."""
    
    product_id: str
    quantity_on_hand: int = 0
    quantity_reserved: int = 0
    quantity_incoming: int = 0
    reorder_point: int = 10
    reorder_quantity: int = 50
    location: Optional[str] = None
    bin_location: Optional[str] = None
    average_cost: Decimal = Decimal("0")
    last_cost: Decimal = Decimal("0")


class InventoryItemCreate(InventoryItemBase):
    """Schema for creating an inventory item."""
    pass


class InventoryItemUpdate(BaseModel):
    """Schema for updating an inventory item."""
    
    quantity_on_hand: Optional[int] = None
    quantity_reserved: Optional[int] = None
    quantity_incoming: Optional[int] = None
    reorder_point: Optional[int] = None
    reorder_quantity: Optional[int] = None
    location: Optional[str] = None
    bin_location: Optional[str] = None


class InventoryItemResponse(InventoryItemBase):
    """Schema for inventory item response."""
    
    id: str
    business_id: str
    quantity_available: int
    is_low_stock: bool
    stock_value: float
    last_counted_at: Optional[datetime] = None
    last_received_at: Optional[datetime] = None
    last_sold_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}


class InventoryItemListResponse(BaseModel):
    """Schema for paginated inventory list."""
    
    items: List[InventoryItemResponse]
    total: int
    page: int
    per_page: int
    pages: int


class InventoryAdjustment(BaseModel):
    """Schema for adjusting inventory."""
    
    quantity_change: int = Field(..., description="Positive to increase, negative to decrease")
    reason: str = Field(..., min_length=1)
    notes: Optional[str] = None


class InventoryTransactionBase(BaseModel):
    """Base schema for inventory transaction."""
    
    transaction_type: TransactionType
    quantity_change: int
    quantity_before: int
    quantity_after: int
    unit_cost: Optional[Decimal] = None
    total_cost: Optional[Decimal] = None
    reference_type: Optional[str] = None
    notes: Optional[str] = None


class InventoryTransactionCreate(BaseModel):
    """Schema for creating a transaction."""
    
    product_id: str
    transaction_type: TransactionType
    quantity_change: int
    unit_cost: Optional[Decimal] = None
    notes: Optional[str] = None
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None


class InventoryTransactionResponse(InventoryTransactionBase):
    """Schema for transaction response."""
    
    id: str
    business_id: str
    product_id: str
    reference_id: Optional[str] = None
    from_location: Optional[str] = None
    to_location: Optional[str] = None
    user_id: Optional[str] = None
    created_at: datetime
    
    model_config = {"from_attributes": True}


class LowStockAlert(BaseModel):
    """Schema for low stock alert."""
    
    product_id: str
    product_name: str
    quantity_on_hand: int
    reorder_point: int
    reorder_quantity: int


class InventorySummary(BaseModel):
    """Schema for inventory summary."""
    
    total_items: int
    total_value: Decimal
    low_stock_count: int
    out_of_stock_count: int
