"""Bulk operations API endpoints."""

from fastapi import APIRouter, Depends

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
    BulkOperationResponse,
    BulkPriceUpdateRequest,
    BulkStockAdjustRequest,
)
from app.services.bulk_operations_service import BulkOperationsService

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
