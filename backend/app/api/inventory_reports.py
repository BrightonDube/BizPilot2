"""
Inventory Reports API — endpoints for stock-level, movement, valuation,
turnover, wastage, and dashboard reports.

Exposes the InventoryReportService's 7 report types as REST endpoints
with date-range filtering and pagination.  Includes CSV export.

Why a dedicated inventory reports API?
Inventory reports are read-heavy, computationally expensive, and often
exported. Separating them from CRUD inventory endpoints keeps the
transactional API responsive while allowing report endpoints to have
their own caching and timeout strategies.
"""

import csv
import io
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_sync_db
from app.api.deps import get_current_active_user, get_current_business_id
from app.services.inventory_report_service import InventoryReportService

router = APIRouter(prefix="/inventory-reports", tags=["Inventory Reports"])


# ------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------

@router.get("/stock-levels")
async def get_stock_levels(
    category_id: Optional[UUID] = None,
    low_stock_only: bool = False,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    business_id: UUID = Depends(get_current_business_id),
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_sync_db),
):
    """
    Current stock levels by product.
    Optionally filter by category or show only low/out-of-stock items.
    """
    service = InventoryReportService(db)
    result = service.get_stock_levels(
        business_id=business_id,
        category_id=category_id,
        low_stock_only=low_stock_only,
        page=page,
        per_page=per_page,
    )
    return result


@router.get("/movements")
async def get_stock_movements(
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    product_id: Optional[UUID] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    business_id: UUID = Depends(get_current_business_id),
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_sync_db),
):
    """
    Stock movement report showing inflows, outflows, and adjustments
    over a date range. Optionally filter by product.
    """
    service = InventoryReportService(db)
    result = service.get_stock_movements(
        business_id=business_id,
        start_date=start_date,
        end_date=end_date,
        product_id=product_id,
        page=page,
        per_page=per_page,
    )
    return result


@router.get("/valuation")
async def get_valuation(
    category_id: Optional[UUID] = None,
    business_id: UUID = Depends(get_current_business_id),
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_sync_db),
):
    """
    Inventory valuation report grouped by category.
    Shows cost value, retail value, and margin per category.
    """
    service = InventoryReportService(db)
    result = service.get_valuation(
        business_id=business_id,
        category_id=category_id,
    )
    return result


@router.get("/turnover")
async def get_turnover_analysis(
    days: int = Query(30, ge=7, le=365, description="Analysis period in days"),
    business_id: UUID = Depends(get_current_business_id),
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_sync_db),
):
    """
    Inventory turnover analysis with fast/slow/dead stock classification.
    Default analysis period is 30 days.
    """
    service = InventoryReportService(db)
    result = service.get_turnover_analysis(
        business_id=business_id,
        days=days,
    )
    return result


@router.get("/supplier-performance")
async def get_supplier_performance(
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    supplier_id: Optional[UUID] = None,
    business_id: UUID = Depends(get_current_business_id),
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_sync_db),
):
    """
    Supplier performance metrics based on purchase orders.
    Optionally filter by specific supplier.
    """
    service = InventoryReportService(db)
    result = service.get_supplier_performance(
        business_id=business_id,
        start_date=start_date,
        end_date=end_date,
        supplier_id=supplier_id,
    )
    return result


@router.get("/wastage")
async def get_wastage_report(
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    business_id: UUID = Depends(get_current_business_id),
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_sync_db),
):
    """
    Wastage report tracking items lost to waste, expiration, or damage.
    """
    service = InventoryReportService(db)
    result = service.get_wastage_report(
        business_id=business_id,
        start_date=start_date,
        end_date=end_date,
    )
    return result


@router.get("/dashboard")
async def get_inventory_dashboard(
    business_id: UUID = Depends(get_current_business_id),
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_sync_db),
):
    """
    Aggregated inventory dashboard with KPIs and alerts.
    Returns total stock value, low-stock alerts, and key metrics.
    """
    service = InventoryReportService(db)
    result = service.get_inventory_dashboard(
        business_id=business_id,
    )
    return result


@router.get("/export/stock-levels/csv")
async def export_stock_levels_csv(
    category_id: Optional[str] = Query(None),
    low_stock_only: bool = Query(False),
    business_id: UUID = Depends(get_current_business_id),
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_sync_db),
):
    """Export current stock levels as a CSV file."""
    service = InventoryReportService(db)
    report = service.get_stock_levels(
        business_id=business_id,
        category_id=category_id,
        low_stock_only=low_stock_only,
    )

    output = io.StringIO()
    fields = [
        "product_name", "sku", "category_name", "current_stock",
        "reorder_level", "cost_price", "selling_price", "stock_value",
        "is_low_stock", "is_out_of_stock",
    ]
    writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(report.get("items", []))

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=stock_levels.csv"},
    )


@router.get("/export/wastage/csv")
async def export_wastage_csv(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str = Query(..., description="YYYY-MM-DD"),
    business_id: UUID = Depends(get_current_business_id),
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_sync_db),
):
    """Export wastage report as a CSV file."""
    from datetime import date as date_type

    sd = date_type.fromisoformat(start_date)
    ed = date_type.fromisoformat(end_date)

    service = InventoryReportService(db)
    report = service.get_wastage_report(
        business_id=business_id,
        start_date=sd,
        end_date=ed,
    )

    output = io.StringIO()
    fields = [
        "product_name", "wastage_type", "quantity",
        "incident_count", "estimated_value",
    ]
    writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(report.get("items", []))

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=wastage_report.csv"},
    )
