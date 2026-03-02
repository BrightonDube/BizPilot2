"""Bulk operations API endpoints.

Contains both the original simple (fire-and-forget) endpoints and the newer
tracked operations that record per-item progress and audit trails.
"""

import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import get_current_business_id
from app.core.database import get_sync_db
from app.core.rbac import has_permission
from app.models.user import User
from app.schemas.bulk_operations import (
    BulkActivateRequest,
    BulkCategoryAssignRequest,
    BulkDeleteRequest,
    BulkExportResponse,
    BulkImportRequest,
    BulkOperationDetailResponse,
    BulkOperationItemListResponse,
    BulkOperationItemResponse,
    BulkOperationListResponse,
    BulkOperationResponse,
    BulkPriceUpdateRequest,
    BulkStockAdjustRequest,
    BulkSupplierAssignRequest,
    BulkTemplateCreate,
    BulkTemplateListResponse,
    BulkTemplateResponse,
    BulkTemplateUpdate,
    OperationProgressResponse,
    ValidationResult,
)
from app.services.bulk_operations_service import BulkOperationsService
from app.services.tracked_bulk_service import TrackedBulkOperationService
from app.services.bulk_template_service import BulkTemplateService

router = APIRouter(prefix="/bulk", tags=["Bulk Operations"])


@router.post("/price-update", response_model=BulkOperationResponse)
async def bulk_price_update(
    body: BulkPriceUpdateRequest,
    current_user: User = Depends(has_permission("products:edit")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Bulk update product prices."""
    service = BulkOperationsService(db)
    count = service.bulk_price_update(
        business_id, body.product_ids, body.adjustment_type, body.adjustment_value
    )
    return BulkOperationResponse(count=count, message=f"{count} product(s) updated")


@router.post("/stock-adjust", response_model=BulkOperationResponse)
async def bulk_stock_adjust(
    body: BulkStockAdjustRequest,
    current_user: User = Depends(has_permission("inventory:edit")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Bulk adjust inventory stock levels."""
    service = BulkOperationsService(db)
    adjustments = [adj.model_dump() for adj in body.adjustments]
    count = service.bulk_stock_adjust(business_id, adjustments)
    return BulkOperationResponse(count=count, message=f"{count} item(s) adjusted")


@router.post("/category-assign", response_model=BulkOperationResponse)
async def bulk_category_assign(
    body: BulkCategoryAssignRequest,
    current_user: User = Depends(has_permission("products:edit")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Bulk assign products to a category."""
    service = BulkOperationsService(db)
    count = service.bulk_category_assign(
        business_id, body.product_ids, body.category_id
    )
    return BulkOperationResponse(count=count, message=f"{count} product(s) assigned")


@router.post("/activate", response_model=BulkOperationResponse)
async def bulk_activate(
    body: BulkActivateRequest,
    current_user: User = Depends(has_permission("products:edit")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Bulk activate or deactivate products."""
    service = BulkOperationsService(db)
    count = service.bulk_activate_products(
        business_id, body.product_ids, body.active
    )
    action = "activated" if body.active else "deactivated"
    return BulkOperationResponse(count=count, message=f"{count} product(s) {action}")


@router.post("/delete", response_model=BulkOperationResponse)
async def bulk_delete(
    body: BulkDeleteRequest,
    current_user: User = Depends(has_permission("products:delete")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Bulk soft-delete products."""
    service = BulkOperationsService(db)
    count = service.bulk_delete_products(business_id, body.product_ids)
    return BulkOperationResponse(count=count, message=f"{count} product(s) deleted")


@router.get("/export/products", response_model=BulkExportResponse)
async def export_products(
    current_user: User = Depends(has_permission("products:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Export all products as a list of dicts for CSV generation."""
    service = BulkOperationsService(db)
    rows = service.export_products_csv(business_id)
    return BulkExportResponse(rows=rows, total=len(rows))


@router.post("/import/products", response_model=BulkOperationResponse)
async def import_products(
    body: BulkImportRequest,
    current_user: User = Depends(has_permission("products:create")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Import products from parsed CSV rows."""
    service = BulkOperationsService(db)
    count = service.import_products_csv(business_id, body.rows)
    return BulkOperationResponse(count=count, message=f"{count} product(s) imported")


@router.get("/export/customers", response_model=BulkExportResponse)
async def export_customers(
    current_user: User = Depends(has_permission("customers:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Export all customers as a list of dicts for CSV generation."""
    service = BulkOperationsService(db)
    rows = service.export_customers_csv(business_id)
    return BulkExportResponse(rows=rows, total=len(rows))


@router.post("/import/customers", response_model=BulkOperationResponse)
async def import_customers(
    body: BulkImportRequest,
    current_user: User = Depends(has_permission("customers:create")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Import customers from parsed CSV rows."""
    service = BulkOperationsService(db)
    count = service.import_customers_csv(business_id, body.rows)
    return BulkOperationResponse(count=count, message=f"{count} customer(s) imported")


# ──────────────────────────────────────────────────────────────────────────────
# Tracked operations  (create audit trail + per-item progress)
# ──────────────────────────────────────────────────────────────────────────────


@router.get("/operations", response_model=BulkOperationListResponse)
async def list_operations(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    operation_type: Optional[str] = None,
    current_user: User = Depends(has_permission("products:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List tracked bulk operations for the current business."""
    service = TrackedBulkOperationService(db)
    items, total = service.list_operations(
        business_id, page=page, per_page=per_page,
        status=status, operation_type=operation_type,
    )
    return BulkOperationListResponse(
        items=items, total=total, page=page, per_page=per_page,
        pages=max(1, math.ceil(total / per_page)),
    )


@router.get("/operations/{operation_id}", response_model=BulkOperationDetailResponse)
async def get_operation(
    operation_id: str,
    current_user: User = Depends(has_permission("products:view")),
    db=Depends(get_sync_db),
):
    """Get details of a specific bulk operation."""
    service = TrackedBulkOperationService(db)
    op = service.get_operation(operation_id)
    if not op:
        raise HTTPException(status_code=404, detail="Operation not found")
    return op


@router.get("/operations/{operation_id}/progress", response_model=OperationProgressResponse)
async def get_operation_progress(
    operation_id: str,
    current_user: User = Depends(has_permission("products:view")),
    db=Depends(get_sync_db),
):
    """Get real-time progress of a bulk operation."""
    service = TrackedBulkOperationService(db)
    op = service.get_operation(operation_id)
    if not op:
        raise HTTPException(status_code=404, detail="Operation not found")
    return OperationProgressResponse(
        id=op.id,
        operation_type=op.operation_type,
        status=op.status,
        total_records=op.total_records,
        processed_records=op.processed_records,
        successful_records=op.successful_records,
        failed_records=op.failed_records,
        progress_percentage=op.progress_percentage,
        started_at=op.started_at,
        completed_at=op.completed_at,
        error_summary=op.error_summary,
    )


@router.get("/operations/{operation_id}/items", response_model=BulkOperationItemListResponse)
async def get_operation_items(
    operation_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    current_user: User = Depends(has_permission("products:view")),
    db=Depends(get_sync_db),
):
    """Get per-record items for a bulk operation."""
    service = TrackedBulkOperationService(db)
    items, total = service.get_operation_items(
        operation_id, page=page, per_page=per_page, status=status,
    )
    return BulkOperationItemListResponse(
        items=items, total=total, page=page, per_page=per_page,
    )


@router.post("/operations/{operation_id}/cancel", response_model=BulkOperationResponse)
async def cancel_operation(
    operation_id: str,
    current_user: User = Depends(has_permission("products:edit")),
    db=Depends(get_sync_db),
):
    """Cancel a pending or in-progress operation."""
    service = TrackedBulkOperationService(db)
    if not service.cancel_operation(operation_id):
        raise HTTPException(status_code=400, detail="Cannot cancel this operation")
    return BulkOperationResponse(count=0, message="Operation cancelled")


@router.post("/operations/{operation_id}/rollback", response_model=BulkOperationResponse)
async def rollback_operation(
    operation_id: str,
    current_user: User = Depends(has_permission("products:edit")),
    db=Depends(get_sync_db),
):
    """Roll back a completed operation using stored before/after snapshots."""
    service = TrackedBulkOperationService(db)
    rolled_back, failed = service.rollback_operation(operation_id)
    return BulkOperationResponse(
        count=rolled_back,
        message=f"Rolled back {rolled_back} records ({failed} failed)",
    )


# ── Validation / preview endpoints ───────────────────────────────────────────

@router.post("/validate/price-update", response_model=ValidationResult)
async def validate_price_update(
    body: BulkPriceUpdateRequest,
    current_user: User = Depends(has_permission("products:edit")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Dry-run validation for a bulk price update."""
    service = TrackedBulkOperationService(db)
    return service.validate_price_update(
        business_id, body.product_ids, body.adjustment_type, body.adjustment_value,
    )


@router.post("/validate/stock-adjust", response_model=ValidationResult)
async def validate_stock_adjustment(
    body: BulkStockAdjustRequest,
    current_user: User = Depends(has_permission("inventory:edit")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Dry-run validation for bulk stock adjustments."""
    service = TrackedBulkOperationService(db)
    adjustments = [adj.model_dump() for adj in body.adjustments]
    return service.validate_stock_adjustment(business_id, adjustments)


# ── Tracked execution endpoints ──────────────────────────────────────────────

@router.post("/tracked/price-update", response_model=BulkOperationDetailResponse)
async def tracked_price_update(
    body: BulkPriceUpdateRequest,
    current_user: User = Depends(has_permission("products:edit")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Execute a tracked bulk price update with per-item audit trail."""
    service = TrackedBulkOperationService(db)
    return service.execute_price_update(
        user_id=str(current_user.id),
        business_id=business_id,
        product_ids=body.product_ids,
        adjustment_type=body.adjustment_type,
        adjustment_value=body.adjustment_value,
    )


@router.post("/tracked/stock-adjust", response_model=BulkOperationDetailResponse)
async def tracked_stock_adjust(
    body: BulkStockAdjustRequest,
    current_user: User = Depends(has_permission("inventory:edit")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Execute a tracked bulk stock adjustment with per-item audit trail."""
    service = TrackedBulkOperationService(db)
    adjustments = [adj.model_dump() for adj in body.adjustments]
    return service.execute_stock_adjustment(
        user_id=str(current_user.id),
        business_id=business_id,
        adjustments=adjustments,
    )


@router.post("/tracked/category-assign", response_model=BulkOperationDetailResponse)
async def tracked_category_assign(
    body: BulkCategoryAssignRequest,
    current_user: User = Depends(has_permission("products:edit")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Execute a tracked bulk category assignment."""
    service = TrackedBulkOperationService(db)
    return service.execute_category_assign(
        user_id=str(current_user.id),
        business_id=business_id,
        product_ids=body.product_ids,
        category_id=body.category_id,
    )


@router.post("/tracked/supplier-assign", response_model=BulkOperationDetailResponse)
async def tracked_supplier_assign(
    body: BulkSupplierAssignRequest,
    current_user: User = Depends(has_permission("products:edit")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Execute a tracked bulk supplier assignment."""
    service = TrackedBulkOperationService(db)
    return service.execute_supplier_assign(
        user_id=str(current_user.id),
        business_id=business_id,
        product_ids=body.product_ids,
        supplier_id=body.supplier_id,
        is_primary=body.is_primary,
    )


# ── Template management endpoints ────────────────────────────────────────────

@router.get("/templates", response_model=BulkTemplateListResponse)
async def list_templates(
    operation_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(has_permission("products:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List available bulk operation templates."""
    service = BulkTemplateService(db)
    items, total = service.list_templates(
        business_id, operation_type=operation_type, page=page, per_page=per_page,
    )
    return BulkTemplateListResponse(items=items, total=total)


@router.post("/templates", response_model=BulkTemplateResponse, status_code=201)
async def create_template(
    body: BulkTemplateCreate,
    current_user: User = Depends(has_permission("products:edit")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Create a new bulk operation template."""
    service = BulkTemplateService(db)
    return service.create_template(
        name=body.name,
        operation_type=body.operation_type,
        template_data=body.template_data,
        description=body.description,
        business_id=business_id,
        created_by=str(current_user.id),
    )


@router.get("/templates/{template_id}", response_model=BulkTemplateResponse)
async def get_template(
    template_id: str,
    current_user: User = Depends(has_permission("products:view")),
    db=Depends(get_sync_db),
):
    """Get a specific template."""
    service = BulkTemplateService(db)
    template = service.get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.put("/templates/{template_id}", response_model=BulkTemplateResponse)
async def update_template(
    template_id: str,
    body: BulkTemplateUpdate,
    current_user: User = Depends(has_permission("products:edit")),
    db=Depends(get_sync_db),
):
    """Update an existing template."""
    service = BulkTemplateService(db)
    template = service.update_template(
        template_id,
        name=body.name,
        description=body.description,
        template_data=body.template_data,
    )
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.delete("/templates/{template_id}", response_model=BulkOperationResponse)
async def delete_template(
    template_id: str,
    current_user: User = Depends(has_permission("products:edit")),
    db=Depends(get_sync_db),
):
    """Soft-delete a template."""
    service = BulkTemplateService(db)
    if not service.delete_template(template_id):
        raise HTTPException(status_code=404, detail="Template not found")
    return BulkOperationResponse(count=1, message="Template deleted")
