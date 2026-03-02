"""Online ordering API endpoints."""

from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel as PydanticBase, ConfigDict

from app.api.deps import get_current_business_id
from app.core.database import get_sync_db
from app.core.rbac import has_permission
from app.models.online_order import FulfillmentType, OnlineOrderStatus
from app.models.user import User
from app.services.online_order_service import OnlineOrderService

router = APIRouter(prefix="/online-orders", tags=["Online Orders"])


# ---- Schemas ----


class StoreResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    business_id: UUID
    store_name: str
    store_url_slug: Optional[str] = None
    is_active: bool
    description: Optional[str] = None
    min_order_amount: Decimal
    delivery_fee: Decimal
    free_delivery_threshold: Optional[Decimal] = None
    estimated_prep_minutes: int
    accepts_delivery: bool
    accepts_collection: bool
    operating_hours: Optional[dict] = None


class StoreUpdate(PydanticBase):
    store_name: Optional[str] = None
    store_url_slug: Optional[str] = None
    is_active: Optional[bool] = None
    description: Optional[str] = None
    min_order_amount: Optional[Decimal] = None
    delivery_fee: Optional[Decimal] = None
    free_delivery_threshold: Optional[Decimal] = None
    estimated_prep_minutes: Optional[int] = None
    accepts_delivery: Optional[bool] = None
    accepts_collection: Optional[bool] = None
    operating_hours: Optional[dict] = None


class MenuItemOut(PydanticBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    product_id: Optional[UUID] = None
    display_name: str
    description: Optional[str] = None
    price: Decimal
    image_url: Optional[str] = None
    is_available: bool
    prep_time_minutes: Optional[int] = None
    course: Optional[str] = None


class OrderItemCreate(PydanticBase):
    product_id: Optional[UUID] = None
    name: str
    quantity: int = 1
    unit_price: Decimal
    modifiers: Optional[str] = None
    notes: Optional[str] = None


class OrderCreate(PydanticBase):
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    fulfillment_type: FulfillmentType
    delivery_address: Optional[str] = None
    notes: Optional[str] = None
    items: List[OrderItemCreate]


class OrderItemResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    order_id: UUID
    product_id: Optional[UUID] = None
    name: str
    quantity: int
    unit_price: Decimal
    total: Decimal
    modifiers: Optional[str] = None
    notes: Optional[str] = None


class OrderResponse(PydanticBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    business_id: UUID
    order_number: str
    customer_name: str
    customer_email: Optional[str] = None
    customer_phone: str
    fulfillment_type: FulfillmentType
    delivery_address: Optional[str] = None
    status: OnlineOrderStatus
    subtotal: Decimal
    delivery_fee: Decimal
    total: Decimal
    notes: Optional[str] = None
    estimated_ready_at: Optional[str] = None
    payment_method: Optional[str] = None
    is_paid: bool
    items: List[OrderItemResponse] = []


class OrderListResponse(PydanticBase):
    items: List[OrderResponse]
    total: int
    page: int
    per_page: int
    pages: int


class StatusUpdate(PydanticBase):
    status: OnlineOrderStatus


class CancelBody(PydanticBase):
    reason: Optional[str] = None


class OrderStatsResponse(PydanticBase):
    total_orders: int
    today_orders: int
    pending: int
    preparing: int
    completed_today: int
    revenue_today: float


# ---- Helpers ----


def _str_id(obj):
    """Ensure UUID fields are serialised as strings."""
    data = {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
    for key in (
        "id", "business_id", "order_id", "product_id",
    ):
        if key in data and data[key] is not None:
            data[key] = str(data[key])
    for key in ("status", "fulfillment_type"):
        if key in data and data[key] is not None:
            data[key] = data[key].value if hasattr(data[key], "value") else str(data[key])
    if "estimated_ready_at" in data and data["estimated_ready_at"] is not None:
        data["estimated_ready_at"] = data["estimated_ready_at"].isoformat()
    return data


def _order_response(order) -> dict:
    """Build an OrderResponse-compatible dict from an OnlineOrder model."""
    d = _str_id(order)
    d["items"] = [_str_id(i) for i in (order.items or [])]
    return d


# ---- Endpoints ----


@router.get("/store", response_model=StoreResponse)
async def get_store(
    current_user: User = Depends(has_permission("orders:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get or create online store configuration."""
    service = OnlineOrderService(db)
    store = service.get_or_create_store(business_id, "My Online Store")
    return StoreResponse(**_str_id(store))


@router.put("/store", response_model=StoreResponse)
async def update_store(
    body: StoreUpdate,
    current_user: User = Depends(has_permission("orders:edit")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Update online store settings."""
    service = OnlineOrderService(db)
    # Ensure store exists first
    service.get_or_create_store(business_id, "My Online Store")
    updates = body.model_dump(exclude_unset=True)
    store = service.update_store(business_id, **updates)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    return StoreResponse(**_str_id(store))


@router.get("/store/menu", response_model=List[MenuItemOut])
async def get_store_menu(
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get public-facing menu for the online store."""
    service = OnlineOrderService(db)
    items = service.get_store_menu(business_id)
    return [MenuItemOut.model_validate(i) for i in items]


@router.post("/orders", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    body: OrderCreate,
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Create an online order (customer-facing)."""
    if not body.items:
        raise HTTPException(status_code=400, detail="Order must contain at least one item")

    service = OnlineOrderService(db)
    items_dicts = [i.model_dump() for i in body.items]
    for d in items_dicts:
        if d.get("product_id"):
            d["product_id"] = str(d["product_id"])

    order = service.create_order(
        business_id=business_id,
        customer_name=body.customer_name,
        customer_phone=body.customer_phone,
        fulfillment_type=body.fulfillment_type,
        items=items_dicts,
        delivery_address=body.delivery_address,
        customer_email=body.customer_email,
        notes=body.notes,
    )
    return OrderResponse(**_order_response(order))


@router.get("/orders", response_model=OrderListResponse)
async def list_orders(
    status_filter: Optional[OnlineOrderStatus] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(has_permission("orders:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """List online orders for the business owner."""
    service = OnlineOrderService(db)
    orders, total = service.list_orders(business_id, status=status_filter, page=page, per_page=per_page)
    pages = (total + per_page - 1) // per_page if per_page else 1
    return OrderListResponse(
        items=[OrderResponse(**_order_response(o)) for o in orders],
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
    )


@router.get("/orders/active", response_model=List[OrderResponse])
async def get_active_orders(
    current_user: User = Depends(has_permission("orders:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get active (in-progress) online orders."""
    service = OnlineOrderService(db)
    orders = service.get_active_orders(business_id)
    return [OrderResponse(**_order_response(o)) for o in orders]


@router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: str,
    current_user: User = Depends(has_permission("orders:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get a single online order."""
    service = OnlineOrderService(db)
    order = service.get_order(order_id, business_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return OrderResponse(**_order_response(order))


@router.patch("/orders/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: str,
    body: StatusUpdate,
    current_user: User = Depends(has_permission("orders:edit")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Update online order status."""
    service = OnlineOrderService(db)
    order = service.update_status(order_id, business_id, body.status)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return OrderResponse(**_order_response(order))


@router.delete("/orders/{order_id}", response_model=OrderResponse)
async def cancel_order(
    order_id: str,
    body: Optional[CancelBody] = None,
    current_user: User = Depends(has_permission("orders:edit")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Cancel an online order."""
    service = OnlineOrderService(db)
    reason = body.reason if body else None
    order = service.cancel_order(order_id, business_id, reason)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return OrderResponse(**_order_response(order))


@router.get("/stats", response_model=OrderStatsResponse)
async def get_order_stats(
    current_user: User = Depends(has_permission("orders:view")),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get online order statistics."""
    service = OnlineOrderService(db)
    stats = service.get_order_stats(business_id)
    return OrderStatsResponse(**stats)
