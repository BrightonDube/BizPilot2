"""Reorder API endpoints."""

import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_business_id
from app.core.database import get_sync_db
from app.core.rbac import has_permission
from app.models.reorder import PurchaseOrderStatus, ReorderRuleStatus
from app.models.user import User
from app.schemas.reorder import (
    AutoReorderResponse,
    LowStockItem,
    PurchaseRequestCreate,
    PurchaseRequestItemResponse,
    PurchaseRequestListResponse,
    PurchaseRequestResponse,
    ReceiveItemsRequest,
    ReorderRuleCreate,
    ReorderRuleListResponse,
    ReorderRuleResponse,
    ReorderRuleUpdate,
    ReorderSuggestion,
    ReorderSuggestionsResponse,
    StockCheckResponse,
    ProductReorderSettingsCreate,
    ProductReorderSettingsResponse,
    GRNCreate,
    GRNResponse,
    GRNItemResponse,
    GRNListResponse,
)
from app.services.reorder_service import ReorderService

router = APIRouter(prefix="/reorder", tags=["Reorder"])


def _rule_to_response(rule) -> ReorderRuleResponse:
    """Convert a ReorderRule model to response schema."""
    return ReorderRuleResponse(
        id=str(rule.id),
        business_id=str(rule.business_id),
        product_id=str(rule.product_id),
        product_name=rule.product.name if rule.product else None,
        supplier_id=str(rule.supplier_id) if rule.supplier_id else None,
        supplier_name=rule.supplier.name if rule.supplier else None,
        min_stock_level=rule.min_stock_level,
        reorder_quantity=rule.reorder_quantity,
        max_stock_level=rule.max_stock_level,
        lead_time_days=rule.lead_time_days,
        status=rule.status,
        auto_approve=rule.auto_approve,
        last_triggered_at=rule.last_triggered_at,
        created_at=rule.created_at,
        updated_at=rule.updated_at,
    )


def _pr_to_response(pr) -> PurchaseRequestResponse:
    """Convert a PurchaseRequest model to response schema."""
    return PurchaseRequestResponse(
        id=str(pr.id),
        business_id=str(pr.business_id),
        reference=pr.reference,
        supplier_id=str(pr.supplier_id) if pr.supplier_id else None,
        supplier_name=pr.supplier.name if pr.supplier else None,
        status=pr.status,
        total_amount=pr.total_amount,
        notes=pr.notes,
        requested_by_id=str(pr.requested_by_id) if pr.requested_by_id else None,
        approved_by_id=str(pr.approved_by_id) if pr.approved_by_id else None,
        approved_at=pr.approved_at,
        expected_delivery=pr.expected_delivery,
        is_auto_generated=pr.is_auto_generated,
        items=[
            PurchaseRequestItemResponse(
                id=str(item.id),
                product_id=str(item.product_id),
                product_name=item.product.name if item.product else None,
                quantity=item.quantity,
                unit_cost=item.unit_cost,
                total=item.total,
                received_quantity=item.received_quantity or 0,
            )
            for item in (pr.items or [])
        ],
        created_at=pr.created_at,
        updated_at=pr.updated_at,
    )


# --- Reorder Rules ---


@router.post("/rules", response_model=ReorderRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_rule(
    data: ReorderRuleCreate,
    current_user: User = Depends(has_permission("inventory:edit")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Create a new reorder rule."""
    service = ReorderService(db)
    rule = service.create_rule(
        business_id=business_id,
        product_id=data.product_id,
        min_stock=data.min_stock_level,
        reorder_qty=data.reorder_quantity,
        supplier_id=data.supplier_id,
        max_stock=data.max_stock_level,
        lead_time=data.lead_time_days,
        auto_approve=data.auto_approve,
    )
    return _rule_to_response(rule)


@router.get("/rules", response_model=ReorderRuleListResponse)
async def list_rules(
    status: Optional[ReorderRuleStatus] = None,
    current_user: User = Depends(has_permission("inventory:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List reorder rules for the current business."""
    service = ReorderService(db)
    rules = service.list_rules(business_id, status=status)
    return ReorderRuleListResponse(
        items=[_rule_to_response(r) for r in rules],
        total=len(rules),
    )


@router.put("/rules/{rule_id}", response_model=ReorderRuleResponse)
async def update_rule(
    rule_id: str,
    data: ReorderRuleUpdate,
    current_user: User = Depends(has_permission("inventory:edit")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Update a reorder rule."""
    service = ReorderService(db)
    update_data = data.model_dump(exclude_unset=True)
    rule = service.update_rule(rule_id, business_id, **update_data)
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reorder rule not found")
    return _rule_to_response(rule)


@router.patch("/rules/{rule_id}/toggle", response_model=ReorderRuleResponse)
async def toggle_rule(
    rule_id: str,
    current_user: User = Depends(has_permission("inventory:edit")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Toggle a reorder rule between active and paused."""
    service = ReorderService(db)
    rule = service.toggle_rule(rule_id, business_id)
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reorder rule not found")
    return _rule_to_response(rule)


# --- Stock Check ---


@router.get("/check-stock", response_model=StockCheckResponse)
async def check_stock(
    current_user: User = Depends(has_permission("inventory:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Check stock levels against reorder rules."""
    service = ReorderService(db)
    items = service.check_stock_levels(business_id)
    return StockCheckResponse(
        items=[LowStockItem(**i) for i in items],
        total=len(items),
    )


# --- Auto Reorder ---


@router.post("/auto-reorder", response_model=AutoReorderResponse)
async def auto_reorder(
    current_user: User = Depends(has_permission("inventory:edit")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Run automatic reorder for rules with auto_approve enabled."""
    service = ReorderService(db)
    created = service.auto_reorder(business_id)
    total_items = sum(len(pr.items or []) for pr in created)
    return AutoReorderResponse(
        purchase_requests_created=len(created),
        items_reordered=total_items,
        details=[_pr_to_response(pr) for pr in created],
    )


# --- Suggestions ---


@router.get("/suggestions", response_model=ReorderSuggestionsResponse)
async def get_suggestions(
    current_user: User = Depends(has_permission("inventory:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get reorder suggestions for products without rules."""
    service = ReorderService(db)
    suggestions = service.get_reorder_suggestions(business_id)
    return ReorderSuggestionsResponse(
        items=[ReorderSuggestion(**s) for s in suggestions],
        total=len(suggestions),
    )


# --- Purchase Requests ---


@router.post("/purchase-requests", response_model=PurchaseRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_purchase_request(
    data: PurchaseRequestCreate,
    current_user: User = Depends(has_permission("inventory:edit")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Create a purchase request manually."""
    service = ReorderService(db)
    items = [
        {
            "product_id": item.product_id,
            "quantity": item.quantity,
            "unit_cost": item.unit_cost,
        }
        for item in data.items
    ]
    pr = service.generate_purchase_request(
        business_id=business_id,
        items=items,
        supplier_id=data.supplier_id,
        user_id=str(current_user.id),
        is_auto=False,
    )
    return _pr_to_response(pr)


@router.get("/purchase-requests", response_model=PurchaseRequestListResponse)
async def list_purchase_requests(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[PurchaseOrderStatus] = None,
    current_user: User = Depends(has_permission("inventory:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List purchase requests with pagination."""
    service = ReorderService(db)
    requests, total = service.list_requests(business_id, status=status, page=page, per_page=per_page)
    return PurchaseRequestListResponse(
        items=[_pr_to_response(r) for r in requests],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.get("/purchase-requests/{request_id}", response_model=PurchaseRequestResponse)
async def get_purchase_request(
    request_id: str,
    current_user: User = Depends(has_permission("inventory:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get a purchase request by ID."""
    service = ReorderService(db)
    pr = service.get_request(request_id, business_id)
    if not pr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase request not found")
    return _pr_to_response(pr)


@router.patch("/purchase-requests/{request_id}/approve", response_model=PurchaseRequestResponse)
async def approve_purchase_request(
    request_id: str,
    current_user: User = Depends(has_permission("inventory:edit")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Approve a purchase request."""
    service = ReorderService(db)
    pr = service.approve_request(request_id, business_id, str(current_user.id))
    if not pr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase request not found")
    return _pr_to_response(pr)


@router.post("/purchase-requests/{request_id}/receive", response_model=PurchaseRequestResponse)
async def receive_purchase_request_items(
    request_id: str,
    data: ReceiveItemsRequest,
    current_user: User = Depends(has_permission("inventory:edit")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Receive items on a purchase request."""
    service = ReorderService(db)
    items = [{"item_id": i.item_id, "quantity_received": i.quantity_received} for i in data.items]
    pr = service.receive_items(request_id, business_id, items)
    if not pr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase request not found")
    return _pr_to_response(pr)


# ===================================================================
# Product Reorder Settings endpoints
# ===================================================================

@router.post("/settings", response_model=ProductReorderSettingsResponse, status_code=status.HTTP_201_CREATED)
async def upsert_reorder_settings(
    data: ProductReorderSettingsCreate,
    current_user: User = Depends(has_permission("inventory:edit")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Create or update reorder settings for a product."""
    from app.services.reorder_settings_service import ReorderSettingsService

    service = ReorderSettingsService(db)
    settings = service.upsert_settings(data, business_id, current_user.id)
    return ProductReorderSettingsResponse(
        id=str(settings.id),
        product_id=str(settings.product_id),
        business_id=str(settings.business_id),
        reorder_point=settings.reorder_point,
        safety_stock=settings.safety_stock,
        par_level=settings.par_level,
        eoq=settings.eoq,
        auto_reorder=settings.auto_reorder,
        preferred_supplier_id=(
            str(settings.preferred_supplier_id)
            if settings.preferred_supplier_id
            else None
        ),
        created_at=settings.created_at,
        updated_at=settings.updated_at,
    )


@router.get("/settings/{product_id}", response_model=ProductReorderSettingsResponse)
async def get_reorder_settings(
    product_id: str,
    current_user: User = Depends(has_permission("inventory:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get reorder settings for a specific product."""
    from app.services.reorder_settings_service import ReorderSettingsService

    service = ReorderSettingsService(db)
    settings = service.get_settings(product_id, business_id)
    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No reorder settings found for this product",
        )
    return ProductReorderSettingsResponse(
        id=str(settings.id),
        product_id=str(settings.product_id),
        business_id=str(settings.business_id),
        reorder_point=settings.reorder_point,
        safety_stock=settings.safety_stock,
        par_level=settings.par_level,
        eoq=settings.eoq,
        auto_reorder=settings.auto_reorder,
        preferred_supplier_id=(
            str(settings.preferred_supplier_id)
            if settings.preferred_supplier_id
            else None
        ),
        created_at=settings.created_at,
        updated_at=settings.updated_at,
    )


@router.post("/settings/bulk", response_model=list[ProductReorderSettingsResponse])
async def bulk_update_reorder_settings(
    items: list[ProductReorderSettingsCreate],
    current_user: User = Depends(has_permission("inventory:edit")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Bulk create/update reorder settings for multiple products."""
    from app.services.reorder_settings_service import ReorderSettingsService

    service = ReorderSettingsService(db)
    results = service.bulk_update(items, business_id, current_user.id)
    return [
        ProductReorderSettingsResponse(
            id=str(s.id),
            product_id=str(s.product_id),
            business_id=str(s.business_id),
            reorder_point=s.reorder_point,
            safety_stock=s.safety_stock,
            par_level=s.par_level,
            eoq=s.eoq,
            auto_reorder=s.auto_reorder,
            preferred_supplier_id=(
                str(s.preferred_supplier_id) if s.preferred_supplier_id else None
            ),
            created_at=s.created_at,
            updated_at=s.updated_at,
        )
        for s in results
    ]


# ===================================================================
# Goods Received Note (GRN) endpoints
# ===================================================================

@router.post("/grn", response_model=GRNResponse, status_code=status.HTTP_201_CREATED)
async def create_grn(
    data: GRNCreate,
    current_user: User = Depends(has_permission("inventory:edit")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Create a goods received note to receive goods against a purchase order."""
    from app.services.grn_service import GRNService

    service = GRNService(db)
    try:
        grn = service.create_grn(data, business_id, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    return GRNResponse(
        id=str(grn.id),
        purchase_order_id=str(grn.purchase_order_id),
        business_id=str(grn.business_id),
        grn_number=grn.grn_number,
        received_by=str(grn.received_by) if grn.received_by else None,
        received_at=grn.received_at,
        notes=grn.notes,
        items=[
            GRNItemResponse(
                id=str(item.id),
                po_item_id=str(item.po_item_id),
                quantity_received=item.quantity_received,
                variance=item.variance,
                variance_reason=item.variance_reason,
            )
            for item in grn.items
        ],
        created_at=grn.created_at,
    )


@router.get("/grn", response_model=GRNListResponse)
async def list_grns(
    purchase_order_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(has_permission("inventory:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List goods received notes, optionally filtered by purchase order."""
    from app.services.grn_service import GRNService

    service = GRNService(db)
    grns, total = service.list_grns(
        business_id,
        purchase_order_id=purchase_order_id,
        page=page,
        per_page=per_page,
    )

    return GRNListResponse(
        items=[
            GRNResponse(
                id=str(g.id),
                purchase_order_id=str(g.purchase_order_id),
                business_id=str(g.business_id),
                grn_number=g.grn_number,
                received_by=str(g.received_by) if g.received_by else None,
                received_at=g.received_at,
                notes=g.notes,
                items=[
                    GRNItemResponse(
                        id=str(item.id),
                        po_item_id=str(item.po_item_id),
                        quantity_received=item.quantity_received,
                        variance=item.variance,
                        variance_reason=item.variance_reason,
                    )
                    for item in g.items
                ],
                created_at=g.created_at,
            )
            for g in grns
        ],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.get("/grn/{grn_id}", response_model=GRNResponse)
async def get_grn(
    grn_id: str,
    current_user: User = Depends(has_permission("inventory:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get a specific goods received note by ID."""
    from app.services.grn_service import GRNService

    service = GRNService(db)
    grn = service.get_grn(grn_id, business_id)
    if not grn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="GRN not found")

    return GRNResponse(
        id=str(grn.id),
        purchase_order_id=str(grn.purchase_order_id),
        business_id=str(grn.business_id),
        grn_number=grn.grn_number,
        received_by=str(grn.received_by) if grn.received_by else None,
        received_at=grn.received_at,
        notes=grn.notes,
        items=[
            GRNItemResponse(
                id=str(item.id),
                po_item_id=str(item.po_item_id),
                quantity_received=item.quantity_received,
                variance=item.variance,
                variance_reason=item.variance_reason,
            )
            for item in grn.items
        ],
        created_at=grn.created_at,
    )


# ===================================================================
# Reporting endpoints
# ===================================================================

@router.get("/reports/history")
async def get_po_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = None,
    current_user: User = Depends(has_permission("inventory:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get purchase order history for reporting."""
    from app.models.reorder import PurchaseRequest

    query = db.query(PurchaseRequest).filter(
        PurchaseRequest.business_id == business_id,
        PurchaseRequest.deleted_at.is_(None),
    )

    if status_filter:
        query = query.filter(PurchaseRequest.status == status_filter)

    query = query.order_by(PurchaseRequest.created_at.desc())
    total = query.count()
    items = query.offset((page - 1) * per_page).limit(per_page).all()

    return {
        "items": [
            {
                "id": str(po.id),
                "reference": po.reference,
                "supplier_name": po.supplier.name if po.supplier else None,
                "status": po.status.value if hasattr(po.status, "value") else po.status,
                "total_amount": float(po.total_amount or 0),
                "items_count": len(po.items),
                "created_at": po.created_at.isoformat() if po.created_at else None,
            }
            for po in items
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 0,
    }


@router.get("/reports/stockouts")
async def get_stockout_report(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(has_permission("inventory:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get products at risk of stockout based on current velocity."""
    from app.services.stock_monitor_service import StockMonitorService
    from app.models.product import Product

    monitor = StockMonitorService(db)
    products = (
        db.query(Product)
        .filter(
            Product.business_id == business_id,
            Product.deleted_at.is_(None),
            Product.stock_quantity > 0,
        )
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    total = (
        db.query(Product)
        .filter(
            Product.business_id == business_id,
            Product.deleted_at.is_(None),
            Product.stock_quantity > 0,
        )
        .count()
    )

    results = []
    for product in products:
        days = monitor.calculate_stockout_date(product.id, business_id)
        velocity = monitor.calculate_sales_velocity(product.id, business_id)
        results.append({
            "product_id": str(product.id),
            "product_name": product.name,
            "current_stock": product.stock_quantity or 0,
            "days_until_stockout": days,
            "avg_daily_sales": velocity,
        })

    return {
        "items": results,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 0,
    }


@router.get("/reports/turnover")
async def get_inventory_turnover(
    days: int = Query(30, ge=1, le=365),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(has_permission("inventory:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get inventory turnover ratios for products.

    Turnover ratio = total units sold in period / average inventory.
    """
    from app.services.stock_monitor_service import StockMonitorService
    from app.models.product import Product

    monitor = StockMonitorService(db)
    products = (
        db.query(Product)
        .filter(
            Product.business_id == business_id,
            Product.deleted_at.is_(None),
        )
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    total = (
        db.query(Product)
        .filter(
            Product.business_id == business_id,
            Product.deleted_at.is_(None),
        )
        .count()
    )

    results = []
    for product in products:
        velocity = monitor.calculate_sales_velocity(
            product.id, business_id, lookback_days=days
        )
        total_sold = round(velocity * days)
        current_stock = product.stock_quantity or 0
        avg_inventory = max(current_stock, 1)  # avoid division by zero
        turnover = round(total_sold / avg_inventory, 2)

        results.append({
            "product_id": str(product.id),
            "product_name": product.name,
            "turnover_ratio": turnover,
            "avg_inventory": float(current_stock),
            "total_sold": total_sold,
            "period_days": days,
        })

    return {
        "items": results,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total > 0 else 0,
    }
