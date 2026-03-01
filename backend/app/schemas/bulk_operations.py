"""Schemas for bulk operations endpoints."""

from typing import Any, Optional

from pydantic import BaseModel, Field


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


class BulkOperationResponse(BaseModel):
    """Standard response for bulk operations."""

    count: int
    message: str


class BulkExportResponse(BaseModel):
    """Response for CSV export operations."""

    rows: list[dict[str, Any]]
    total: int
