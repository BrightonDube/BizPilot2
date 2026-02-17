"""Reorder schemas for API validation."""

from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field
from datetime import datetime

from app.models.reorder import ReorderRuleStatus, PurchaseOrderStatus


# --- Reorder Rule Schemas ---

class ReorderRuleCreate(BaseModel):
    """Schema for creating a reorder rule."""

    product_id: str
    supplier_id: Optional[str] = None
    min_stock_level: int = Field(..., ge=0)
    reorder_quantity: int = Field(..., ge=1)
    max_stock_level: Optional[int] = Field(None, ge=0)
    lead_time_days: int = Field(7, ge=0)
    auto_approve: bool = False


class ReorderRuleUpdate(BaseModel):
    """Schema for updating a reorder rule."""

    supplier_id: Optional[str] = None
    min_stock_level: Optional[int] = Field(None, ge=0)
    reorder_quantity: Optional[int] = Field(None, ge=1)
    max_stock_level: Optional[int] = Field(None, ge=0)
    lead_time_days: Optional[int] = Field(None, ge=0)
    auto_approve: Optional[bool] = None


class ReorderRuleResponse(BaseModel):
    """Schema for reorder rule response."""

    id: str
    business_id: str
    product_id: str
    product_name: Optional[str] = None
    supplier_id: Optional[str] = None
    supplier_name: Optional[str] = None
    min_stock_level: int
    reorder_quantity: int
    max_stock_level: Optional[int] = None
    lead_time_days: int
    status: ReorderRuleStatus
    auto_approve: bool
    last_triggered_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReorderRuleListResponse(BaseModel):
    """Schema for reorder rule list."""

    items: List[ReorderRuleResponse]
    total: int


# --- Stock Check Schemas ---

class LowStockItem(BaseModel):
    """Item that is below its reorder threshold."""

    product_id: str
    product_name: str
    current_stock: int
    min_stock_level: int
    reorder_quantity: int
    supplier_id: Optional[str] = None
    supplier_name: Optional[str] = None
    unit_cost: Optional[Decimal] = None
    rule_id: Optional[str] = None


class StockCheckResponse(BaseModel):
    """Response from stock level check."""

    items: List[LowStockItem]
    total: int


class ReorderSuggestion(BaseModel):
    """Product needing reorder but without a rule."""

    product_id: str
    product_name: str
    current_stock: int
    low_stock_threshold: int
    suggested_reorder_qty: int


class ReorderSuggestionsResponse(BaseModel):
    """Response for reorder suggestions."""

    items: List[ReorderSuggestion]
    total: int


# --- Purchase Request Schemas ---

class PurchaseRequestItemCreate(BaseModel):
    """Schema for a purchase request line item."""

    product_id: str
    quantity: int = Field(..., ge=1)
    unit_cost: Decimal = Field(..., ge=0)


class PurchaseRequestCreate(BaseModel):
    """Schema for creating a purchase request."""

    supplier_id: Optional[str] = None
    items: List[PurchaseRequestItemCreate]
    notes: Optional[str] = None
    expected_delivery: Optional[datetime] = None


class PurchaseRequestItemResponse(BaseModel):
    """Schema for purchase request item response."""

    id: str
    product_id: str
    product_name: Optional[str] = None
    quantity: int
    unit_cost: Decimal
    total: Decimal
    received_quantity: int

    model_config = {"from_attributes": True}


class PurchaseRequestResponse(BaseModel):
    """Schema for purchase request response."""

    id: str
    business_id: str
    reference: str
    supplier_id: Optional[str] = None
    supplier_name: Optional[str] = None
    status: PurchaseOrderStatus
    total_amount: Decimal
    notes: Optional[str] = None
    requested_by_id: Optional[str] = None
    approved_by_id: Optional[str] = None
    approved_at: Optional[datetime] = None
    expected_delivery: Optional[datetime] = None
    is_auto_generated: bool
    items: List[PurchaseRequestItemResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PurchaseRequestListResponse(BaseModel):
    """Schema for paginated purchase request list."""

    items: List[PurchaseRequestResponse]
    total: int
    page: int
    per_page: int
    pages: int


class ReceiveItemInput(BaseModel):
    """Schema for receiving a line item."""

    item_id: str
    quantity_received: int = Field(..., ge=1)


class ReceiveItemsRequest(BaseModel):
    """Schema for receiving items on a purchase request."""

    items: List[ReceiveItemInput]


class AutoReorderResponse(BaseModel):
    """Response from auto-reorder run."""

    purchase_requests_created: int
    items_reordered: int
    details: List[PurchaseRequestResponse] = []
