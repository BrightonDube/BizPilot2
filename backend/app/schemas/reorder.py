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


# --- Product Reorder Settings Schemas ---

class ProductReorderSettingsCreate(BaseModel):
    """Schema for creating/updating per-product reorder configuration.

    Why separate from ReorderRule?
    ReorderRules drive automation (trigger thresholds).
    ProductReorderSettings store planning parameters (safety stock,
    par level, EOQ) that inform manual and automated decisions.
    """

    product_id: str
    reorder_point: int = Field(0, ge=0)
    safety_stock: int = Field(0, ge=0)
    par_level: Optional[int] = Field(None, ge=0)
    eoq: Optional[int] = Field(None, ge=1)
    auto_reorder: bool = False
    preferred_supplier_id: Optional[str] = None


class ProductReorderSettingsUpdate(BaseModel):
    """Schema for partial update of reorder settings."""

    reorder_point: Optional[int] = Field(None, ge=0)
    safety_stock: Optional[int] = Field(None, ge=0)
    par_level: Optional[int] = Field(None, ge=0)
    eoq: Optional[int] = Field(None, ge=1)
    auto_reorder: Optional[bool] = None
    preferred_supplier_id: Optional[str] = None


class ProductReorderSettingsResponse(BaseModel):
    """Schema for returning per-product reorder settings."""

    id: str
    product_id: str
    business_id: str
    reorder_point: int
    safety_stock: int
    par_level: Optional[int] = None
    eoq: Optional[int] = None
    auto_reorder: bool
    preferred_supplier_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Goods Received Note (GRN) Schemas ---

class GRNItemCreate(BaseModel):
    """Schema for a single item within a goods received note."""

    po_item_id: str
    quantity_received: int = Field(..., ge=1)
    variance: int = Field(0)
    variance_reason: Optional[str] = None


class GRNCreate(BaseModel):
    """Schema for creating a goods received note against a purchase order."""

    purchase_order_id: str
    items: List[GRNItemCreate]
    notes: Optional[str] = None


class GRNItemResponse(BaseModel):
    """Schema for returning a GRN line item."""

    id: str
    po_item_id: str
    quantity_received: int
    variance: int
    variance_reason: Optional[str] = None

    model_config = {"from_attributes": True}


class GRNResponse(BaseModel):
    """Schema for returning a goods received note."""

    id: str
    purchase_order_id: str
    business_id: str
    grn_number: str
    received_by: Optional[str] = None
    received_at: Optional[datetime] = None
    notes: Optional[str] = None
    items: List[GRNItemResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class GRNListResponse(BaseModel):
    """Schema for paginated GRN list."""

    items: List[GRNResponse]
    total: int
    page: int
    per_page: int
    pages: int


# --- Reorder Audit Log Schemas ---

class ReorderAuditLogResponse(BaseModel):
    """Schema for returning a reorder audit log entry."""

    id: str
    business_id: str
    action: str
    entity_type: str
    entity_id: str
    details: Optional[dict] = None
    performed_by: Optional[str] = None
    is_automated: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ReorderAuditLogListResponse(BaseModel):
    """Schema for paginated audit log list."""

    items: List[ReorderAuditLogResponse]
    total: int
    page: int
    per_page: int
    pages: int


# --- Report Schemas ---

class StockoutReportItem(BaseModel):
    """A product that experienced or is approaching a stockout."""

    product_id: str
    product_name: str
    current_stock: int
    days_until_stockout: Optional[int] = None
    avg_daily_sales: Optional[float] = None
    last_stockout_date: Optional[datetime] = None


class InventoryTurnoverItem(BaseModel):
    """Inventory turnover metrics for a product."""

    product_id: str
    product_name: str
    turnover_ratio: float
    avg_inventory: float
    total_sold: int
    period_days: int


class POHistoryItem(BaseModel):
    """Purchase order history record for reporting."""

    id: str
    reference: str
    supplier_name: Optional[str] = None
    status: str
    total_amount: Decimal
    items_count: int
    created_at: datetime
    received_at: Optional[datetime] = None
