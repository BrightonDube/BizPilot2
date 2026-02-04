"""Inventory API endpoints."""

import math
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_sync_db
from app.api.deps import get_current_active_user, get_current_business_id
from app.core.rbac import has_permission
from app.models.user import User
from app.models.inventory import TransactionType
from app.models.product import Product
from app.schemas.inventory import (
    InventoryItemCreate,
    InventoryItemUpdate,
    InventoryItemResponse,
    InventoryItemListResponse,
    InventoryAdjustment,
    InventoryTransactionResponse,
    InventorySummary,
)
from app.services.inventory_service import InventoryService
from app.services.inventory_excel_service import InventoryExcelService
from app.core.config import settings

router = APIRouter(prefix="/inventory", tags=["Inventory"])


def _item_to_response(item, db: Session = None) -> InventoryItemResponse:
    """Convert inventory item to response schema."""
    product_name = None
    sku = None
    
    if db:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if product:
            product_name = product.name
            sku = product.sku
    
    return InventoryItemResponse(
        id=str(item.id),
        business_id=str(item.business_id),
        product_id=str(item.product_id),
        product_name=product_name,
        sku=sku,
        quantity_on_hand=item.quantity_on_hand,
        quantity_reserved=item.quantity_reserved,
        quantity_incoming=item.quantity_incoming,
        quantity_available=item.quantity_available,
        reorder_point=item.reorder_point,
        reorder_quantity=item.reorder_quantity,
        location=item.location,
        bin_location=item.bin_location,
        average_cost=item.average_cost,
        last_cost=item.last_cost,
        is_low_stock=item.is_low_stock,
        stock_value=item.stock_value,
        last_counted_at=item.last_counted_at,
        last_received_at=item.last_received_at,
        last_sold_at=item.last_sold_at,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _transaction_to_response(transaction) -> InventoryTransactionResponse:
    """Convert transaction to response schema."""
    return InventoryTransactionResponse(
        id=str(transaction.id),
        business_id=str(transaction.business_id),
        product_id=str(transaction.product_id),
        transaction_type=transaction.transaction_type,
        quantity_change=transaction.quantity_change,
        quantity_before=transaction.quantity_before,
        quantity_after=transaction.quantity_after,
        unit_cost=transaction.unit_cost,
        total_cost=transaction.total_cost,
        reference_type=transaction.reference_type,
        reference_id=str(transaction.reference_id) if transaction.reference_id else None,
        notes=transaction.notes,
        from_location=transaction.from_location,
        to_location=transaction.to_location,
        user_id=str(transaction.user_id) if transaction.user_id else None,
        created_at=transaction.created_at,
    )


@router.get("", response_model=InventoryItemListResponse)
async def list_inventory(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    low_stock_only: bool = False,
    location: Optional[str] = None,
    sort_by: str = Query("created_at", pattern="^(quantity_on_hand|location|created_at|updated_at)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """List inventory items with filtering and pagination."""
    service = InventoryService(db)
    items, total = service.get_inventory_items(
        business_id=business_id,
        page=page,
        per_page=per_page,
        search=search,
        low_stock_only=low_stock_only,
        location=location,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    
    return InventoryItemListResponse(
        items=[_item_to_response(item, db) for item in items],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.get("/summary", response_model=InventorySummary)
async def get_inventory_summary(
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get inventory summary statistics."""
    service = InventoryService(db)
    summary = service.get_inventory_summary(business_id)
    return InventorySummary(**summary)


@router.get("/low-stock", response_model=list[InventoryItemResponse])
async def get_low_stock_items(
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get items below reorder point."""
    service = InventoryService(db)
    items = service.get_low_stock_items(business_id)
    return [_item_to_response(item, db) for item in items]


@router.get("/transactions", response_model=list[InventoryTransactionResponse])
async def list_transactions(
    product_id: Optional[str] = None,
    transaction_type: Optional[TransactionType] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """List inventory transactions."""
    service = InventoryService(db)
    transactions, _ = service.get_transactions(
        business_id=business_id,
        product_id=product_id,
        transaction_type=transaction_type,
        page=page,
        per_page=per_page,
    )
    return [_transaction_to_response(t) for t in transactions]


# ==================== Excel Import/Export Routes ====================
# NOTE: These must be defined BEFORE /{item_id} to avoid route conflicts

@router.get("/export/excel")
async def export_inventory_excel(
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """
    Export all inventory items to Excel spreadsheet (.xlsx).
    
    The exported file contains:
    - SKU, Product Name
    - Quantity fields (on hand, reserved, incoming)
    - Reorder settings (point, quantity)
    - Location info
    - Cost data (average cost, last cost)
    """
    excel_service = InventoryExcelService(db)
    output = excel_service.export_inventory(business_id)
    
    filename = f"inventory_export_{business_id[:8]}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.get("/export/pdf")
async def export_inventory_pdf(
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """
    Export inventory report to PDF.
    
    The exported file contains:
    - Summary statistics (total items, value, low stock count)
    - List of all inventory items with quantities and values
    """
    from fastapi.responses import Response
    from app.core.pdf import build_simple_pdf
    from datetime import date
    
    service = InventoryService(db)
    items, total = service.get_inventory_items(
        business_id=business_id,
        page=1,
        per_page=1000,  # Get all items for PDF
    )
    
    # Calculate summary stats
    total_value = 0.0
    low_stock_count = 0
    out_of_stock_count = 0
    
    for item in items:
        qty = float(item.quantity_on_hand or 0)
        cost = float(item.average_cost or 0)
        total_value += qty * cost
        if qty <= 0:
            out_of_stock_count += 1
        elif item.is_low_stock:
            low_stock_count += 1
    
    # Build PDF content
    lines: list[str] = []
    lines.append("Inventory Report")
    lines.append(f"Date: {date.today()}")
    lines.append("")
    lines.append("Summary")
    lines.append(f"Total Items: {total}")
    lines.append(f"Total Value: R {total_value:,.2f}")
    lines.append(f"Low Stock Items: {low_stock_count}")
    lines.append(f"Out of Stock Items: {out_of_stock_count}")
    lines.append("")
    lines.append("Inventory Items")
    lines.append("-" * 60)
    
    for item in items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        name = product.name if product else "Unknown"
        sku = product.sku if product else "-"
        qty = float(item.quantity_on_hand or 0)
        cost = float(item.average_cost or 0)
        value = qty * cost
        status = "OUT" if qty <= 0 else ("LOW" if item.is_low_stock else "OK")
        lines.append(f"{name} ({sku})")
        lines.append(f"  Qty: {qty:.0f} | Value: R {value:,.2f} | Status: {status}")
    
    pdf_bytes = build_simple_pdf(lines)
    filename = f"inventory_report_{date.today()}.pdf"
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/template/excel")
async def get_inventory_template(
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """
    Download an empty Excel template for inventory import.
    
    The template includes:
    - Correct column headers matching database schema
    - Instructions sheet with column descriptions
    - Required vs optional field indicators
    """
    excel_service = InventoryExcelService(db)
    output = excel_service.generate_template()
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=inventory_template.xlsx",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.post("/import/excel")
async def import_inventory_excel(
    file: UploadFile = File(...),
    current_user: User = Depends(has_permission("inventory:edit")),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """
    Import inventory data from Excel spreadsheet (.xlsx).
    
    Requirements:
    - File must be .xlsx format (Excel 2007+)
    - Must have columns: SKU (required), Quantity On Hand (required)
    - SKU must match existing products in the business
    - Updates existing inventory items or creates new ones
    
    Returns:
    - success: Whether import completed without critical errors
    - updated: Count of updated inventory items
    - created: Count of newly created inventory items
    - skipped: Count of rows that were skipped
    - errors: List of error messages for problematic rows
    """
    # Validate file type
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file provided",
        )
    
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an Excel spreadsheet (.xlsx or .xls)",
        )
    
    # Read file content
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read file: {str(e)}",
        )
    
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is empty",
        )
    
    # File size limit: 10MB max to prevent DoS
    max_file_size = 10 * 1024 * 1024  # 10MB
    if len(content) > max_file_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is 10MB, received {len(content) / (1024*1024):.2f}MB",
        )
    
    # Process import
    excel_service = InventoryExcelService(db)
    result = excel_service.import_inventory(business_id, content, str(current_user.id))
    
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Import failed",
                "errors": result["errors"],
                "updated": result["updated"],
                "created": result["created"],
                "skipped": result["skipped"],
            },
        )
    
    return {
        "success": True,
        "message": "Successfully imported inventory data",
        "updated": result["updated"],
        "created": result["created"],
        "skipped": result["skipped"],
        "errors": result["errors"],
    }


# ==================== Item-specific Routes ====================

@router.get("/{item_id}", response_model=InventoryItemResponse)
async def get_inventory_item(
    item_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get an inventory item by ID."""
    service = InventoryService(db)
    item = service.get_inventory_item(item_id, business_id)
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found",
        )
    
    return _item_to_response(item, db)


@router.get("/product/{product_id}", response_model=InventoryItemResponse)
async def get_inventory_by_product(
    product_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get inventory for a specific product."""
    service = InventoryService(db)
    item = service.get_inventory_by_product(product_id, business_id)
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory not found for this product",
        )
    
    return _item_to_response(item, db)


@router.post("", response_model=InventoryItemResponse, status_code=status.HTTP_201_CREATED)
async def create_inventory_item(
    data: InventoryItemCreate,
    current_user: User = Depends(has_permission("inventory:create")),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Create a new inventory item."""
    service = InventoryService(db)
    
    # Check if product already has inventory
    existing = service.get_inventory_by_product(data.product_id, business_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inventory item already exists for this product",
        )
    
    item = service.create_inventory_item(business_id, data)
    return _item_to_response(item, db)


@router.put("/{item_id}", response_model=InventoryItemResponse)
async def update_inventory_item(
    item_id: str,
    data: InventoryItemUpdate,
    current_user: User = Depends(has_permission("inventory:edit")),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Update an inventory item."""
    service = InventoryService(db)
    item = service.get_inventory_item(item_id, business_id)
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found",
        )
    
    item = service.update_inventory_item(item, data)
    return _item_to_response(item, db)


@router.post("/{item_id}/adjust", response_model=InventoryTransactionResponse)
async def adjust_inventory(
    item_id: str,
    data: InventoryAdjustment,
    current_user: User = Depends(has_permission("inventory:edit")),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Adjust inventory quantity."""
    service = InventoryService(db)
    item = service.get_inventory_item(item_id, business_id)
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found",
        )
    
    try:
        transaction = service.adjust_inventory(item, data, str(current_user.id))
        return _transaction_to_response(transaction)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e) if settings.DEBUG else "Failed to adjust inventory",
        )
