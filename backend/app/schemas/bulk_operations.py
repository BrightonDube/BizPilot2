"""Schemas for bulk operations endpoints."""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ── Request schemas ──────────────────────────────────────────────────────────

class BulkPriceUpdateRequest(BaseModel):
    """Request schema for bulk price update."""

    product_ids: list[str]
    adjustment_type: str = Field(..., pattern="^(percentage|fixed|increment)$")
    adjustment_value: float


class StockAdjustmentItem(BaseModel):
    """Single stock adjustment entry."""

    product_id: str
    quantity_change: int
    reason: Optional[str] = None


class BulkStockAdjustRequest(BaseModel):
    """Request schema for bulk stock adjustment."""

    adjustments: list[StockAdjustmentItem]


class BulkCategoryAssignRequest(BaseModel):
    """Request schema for bulk category assignment."""

    product_ids: list[str]
    category_id: str


class BulkActivateRequest(BaseModel):
    """Request schema for bulk activate/deactivate."""

    product_ids: list[str]
    active: bool


class BulkDeleteRequest(BaseModel):
    """Request schema for bulk soft delete."""

    product_ids: list[str]


class BulkImportRequest(BaseModel):
    """Request schema for CSV import (products or customers)."""

    rows: list[dict[str, Any]]


class BulkSupplierAssignRequest(BaseModel):
    """Request schema for bulk supplier assignment."""

    product_ids: list[str]
    supplier_id: str
    is_primary: bool = False


class BulkSupplierCostUpdateRequest(BaseModel):
    """Request schema for bulk supplier cost price updates."""

    updates: list[dict[str, Any]]
    """Each item: {product_id, supplier_id, cost_price}"""


# ── Response schemas ─────────────────────────────────────────────────────────

class BulkOperationResponse(BaseModel):
    """Standard response for simple bulk operations."""

    count: int
    message: str


class BulkExportResponse(BaseModel):
    """Response for CSV export operations."""

    rows: list[dict[str, Any]]
    total: int


# ── Template schemas ─────────────────────────────────────────────────────────

class BulkTemplateCreate(BaseModel):
    """Create a reusable bulk operation template."""

    name: str = Field(..., min_length=1, max_length=255)
    operation_type: str = Field(
        ...,
        description="One of: price_update, stock_adjustment, import, export, category_assign, supplier_assign",
    )
    description: Optional[str] = None
    template_data: dict[str, Any] = Field(
        ...,
        description="Field mappings, validation rules, default values",
    )


class BulkTemplateUpdate(BaseModel):
    """Update an existing template."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    template_data: Optional[dict[str, Any]] = None


class BulkTemplateResponse(BaseModel):
    """Response for a bulk template."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    operation_type: str
    description: Optional[str] = None
    template_data: dict[str, Any]
    business_id: Optional[UUID] = None
    is_system_template: bool
    created_by: Optional[UUID] = None
    created_at: datetime


class BulkTemplateListResponse(BaseModel):
    """Paginated list of templates."""

    items: list[BulkTemplateResponse]
    total: int


# ── Validation result schemas ────────────────────────────────────────────────

class ValidationError(BaseModel):
    """A single validation error in a bulk operation preview."""

    row: Optional[int] = None
    field: Optional[str] = None
    message: str
    record_id: Optional[str] = None


class ValidationResult(BaseModel):
    """Result of validating a bulk operation before execution."""

    is_valid: bool
    total_records: int
    valid_records: int
    invalid_records: int
    errors: list[ValidationError] = []
    warnings: list[str] = []


# ── Progress tracking schemas ────────────────────────────────────────────────

class OperationProgressResponse(BaseModel):
    """Real-time progress of a running bulk operation."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    operation_type: str
    status: str
    total_records: int
    processed_records: int
    successful_records: int
    failed_records: int
    progress_percentage: float
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_summary: Optional[str] = None


class BulkOperationDetailResponse(BaseModel):
    """Full detail of a bulk operation including parameters."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    operation_type: str
    status: str
    user_id: UUID
    business_id: UUID
    total_records: int
    processed_records: int
    successful_records: int
    failed_records: int
    parameters: Optional[dict[str, Any]] = None
    error_summary: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class BulkOperationListResponse(BaseModel):
    """Paginated list of bulk operations."""

    items: list[BulkOperationDetailResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ── Item-level detail schemas ────────────────────────────────────────────────

class BulkOperationItemResponse(BaseModel):
    """Per-record detail within a bulk operation."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    bulk_operation_id: UUID
    record_id: Optional[UUID] = None
    status: str
    before_data: Optional[dict[str, Any]] = None
    after_data: Optional[dict[str, Any]] = None
    error_message: Optional[str] = None
    processed_at: Optional[datetime] = None


class BulkOperationItemListResponse(BaseModel):
    """Paginated list of operation items."""

    items: list[BulkOperationItemResponse]
    total: int
    page: int
    per_page: int
