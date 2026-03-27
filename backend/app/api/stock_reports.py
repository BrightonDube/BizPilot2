"""Stock control reports API.

Provides four report endpoints:
  GET /stock-reports/levels   — current stock levels with reorder alerts
  GET /stock-reports/value    — total inventory valuation
  GET /stock-reports/movements — movement history (InventoryTransaction log)
  GET /stock-reports/waste    — waste events by category and product
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_current_business_id
from app.core.database import get_sync_db
from app.models.inventory import InventoryItem, TransactionType
from app.services.inventory_service import InventoryService
from app.services.waste_service import WasteService

router = APIRouter(prefix="/stock-reports", tags=["Stock Reports"])


@router.get("/levels")
def stock_levels(
    search: Optional[str] = Query(None),
    low_stock_only: bool = Query(False),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Current stock levels with reorder point alerts."""
    svc = InventoryService(db)
    items, total = svc.get_inventory_items(
        business_id=business_id,
        page=page,
        per_page=per_page,
        search=search,
        low_stock_only=low_stock_only,
    )
    low_stock_count = svc.get_inventory_summary(business_id)["low_stock_count"]
    return {
        "items": [
            {
                "id": str(item.id),
                "product_id": str(item.product_id),
                "quantity_on_hand": item.quantity_on_hand,
                "quantity_reserved": item.quantity_reserved,
                "quantity_available": item.quantity_available,
                "reorder_point": item.reorder_point,
                "reorder_quantity": item.reorder_quantity,
                "is_low_stock": item.is_low_stock,
                "location": item.location,
                "last_received_at": item.last_received_at.isoformat() if item.last_received_at else None,
                "last_sold_at": item.last_sold_at.isoformat() if item.last_sold_at else None,
            }
            for item in items
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
        "low_stock_count": low_stock_count,
    }


@router.get("/value")
def stock_value(
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Total inventory valuation (quantity × average cost per product)."""
    svc = InventoryService(db)
    summary = svc.get_inventory_summary(business_id)

    # Per-product breakdown
    items = (
        db.query(InventoryItem)
        .filter(
            InventoryItem.business_id == business_id,
            InventoryItem.deleted_at.is_(None),
            InventoryItem.quantity_on_hand > 0,
        )
        .all()
    )

    breakdown = [
        {
            "product_id": str(item.product_id),
            "quantity_on_hand": item.quantity_on_hand,
            "average_cost": float(item.average_cost or 0),
            "stock_value": float(item.stock_value),
        }
        for item in items
    ]

    return {
        "total_value": float(summary["total_value"]),
        "total_items": summary["total_items"],
        "breakdown": breakdown,
    }


@router.get("/movements")
def stock_movements(
    product_id: Optional[UUID] = Query(None),
    movement_type: Optional[str] = Query(None, description="Filter by transaction type"),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Paginated movement history from the InventoryTransaction ledger."""
    svc = InventoryService(db)
    txn_type = None
    if movement_type:
        try:
            txn_type = TransactionType(movement_type)
        except ValueError:
            pass

    transactions, total = svc.get_transactions(
        business_id=business_id,
        product_id=str(product_id) if product_id else None,
        transaction_type=txn_type,
        page=page,
        per_page=per_page,
    )

    return {
        "movements": [
            {
                "id": str(txn.id),
                "product_id": str(txn.product_id),
                "transaction_type": txn.transaction_type.value,
                "quantity_change": txn.quantity_change,
                "quantity_before": txn.quantity_before,
                "quantity_after": txn.quantity_after,
                "unit_cost": float(txn.unit_cost or 0),
                "total_cost": float(txn.total_cost or 0),
                "reference_type": txn.reference_type,
                "reference_id": str(txn.reference_id) if txn.reference_id else None,
                "notes": txn.notes,
                "created_at": txn.created_at.isoformat() if txn.created_at else None,
            }
            for txn in transactions
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.get("/waste")
def waste_report(
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Waste events aggregated by category and product."""
    from uuid import UUID as _UUID
    svc = WasteService(db)
    return svc.get_waste_report(
        business_id=_UUID(business_id),
        date_from=date_from,
        date_to=date_to,
    )
