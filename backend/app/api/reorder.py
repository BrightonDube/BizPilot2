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
