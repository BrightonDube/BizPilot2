"""Order management API endpoints."""

from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel as PydanticBaseModel, ConfigDict

from app.api.deps import get_sync_db, get_current_active_user, get_current_business_id
from app.services.order_management_service import OrderManagementService
from app.models.order import OrderStatus, OrderType

router = APIRouter(prefix="/order-management", tags=["Order Management"])


class StatusUpdateRequest(PydanticBaseModel):
    status: OrderStatus
    reason: Optional[str] = None


class AssignTableRequest(PydanticBaseModel):
    table_id: UUID


class TransferTableRequest(PydanticBaseModel):
    new_table_id: UUID


class MergeOrdersRequest(PydanticBaseModel):
    order_ids: List[UUID]
    target_order_id: Optional[UUID] = None


class SplitOrderRequest(PydanticBaseModel):
    item_ids: List[UUID]


class OpenTabRequest(PydanticBaseModel):
    tab_name: str
    customer_id: Optional[UUID] = None
    table_id: Optional[UUID] = None


class AddItemRequest(PydanticBaseModel):
    name: str
    unit_price: Decimal
    quantity: int = 1
    product_id: Optional[UUID] = None
    notes: Optional[str] = None


class RemoveItemRequest(PydanticBaseModel):
    reason: Optional[str] = None


class DeliveryInfoRequest(PydanticBaseModel):
    delivery_address: Optional[str] = None
    delivery_phone: Optional[str] = None
    driver_id: Optional[UUID] = None
    estimated_time: Optional[datetime] = None
    delivery_fee: Optional[Decimal] = None


class StatusHistoryResponse(PydanticBaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    order_id: UUID
    old_status: Optional[str] = None
    new_status: str
    changed_by_id: Optional[UUID] = None
    reason: Optional[str] = None
    changed_at: datetime


@router.patch("/{order_id}/status")
def update_order_status(
    order_id: UUID,
    data: StatusUpdateRequest,
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    user=Depends(get_current_active_user),
):
    """Update order status with validation."""
    service = OrderManagementService(db)
    order = service.update_order_status(
        order_id=order_id,
        business_id=business_id,
        new_status=data.status,
        user_id=user.id,
        reason=data.reason,
    )
    return {"detail": "Status updated", "order_id": str(order.id), "status": order.status.value}


@router.post("/{order_id}/assign-table")
def assign_table(
    order_id: UUID,
    data: AssignTableRequest,
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Assign an order to a table."""
    service = OrderManagementService(db)
    order = service.assign_table(order_id, data.table_id, business_id)
    return {"detail": "Table assigned", "order_id": str(order.id), "table_id": str(order.table_id)}


@router.post("/{order_id}/transfer-table")
def transfer_table(
    order_id: UUID,
    data: TransferTableRequest,
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Transfer order to a different table."""
    service = OrderManagementService(db)
    order = service.transfer_table(order_id, data.new_table_id, business_id)
    return {"detail": "Table transferred", "order_id": str(order.id), "table_id": str(order.table_id)}


@router.post("/merge")
def merge_orders(
    data: MergeOrdersRequest,
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Merge multiple orders into one."""
    service = OrderManagementService(db)
    order = service.merge_orders(data.order_ids, business_id, data.target_order_id)
    return {"detail": "Orders merged", "order_id": str(order.id), "order_number": order.order_number}


@router.post("/{order_id}/split")
def split_order(
    order_id: UUID,
    data: SplitOrderRequest,
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Split items from an order into a new order."""
    service = OrderManagementService(db)
    new_order = service.split_order(order_id, data.item_ids, business_id)
    return {"detail": "Order split", "new_order_id": str(new_order.id), "new_order_number": new_order.order_number}


@router.post("/tabs")
def open_tab(
    data: OpenTabRequest,
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Open a new tab."""
    service = OrderManagementService(db)
    tab = service.open_tab(business_id, data.tab_name, data.customer_id, data.table_id)
    return {"detail": "Tab opened", "order_id": str(tab.id), "tab_name": tab.tab_name}


@router.post("/tabs/{order_id}/close")
def close_tab(
    order_id: UUID,
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Close a tab."""
    service = OrderManagementService(db)
    order = service.close_tab(order_id, business_id)
    return {"detail": "Tab closed", "order_id": str(order.id)}


@router.get("/tabs")
def get_open_tabs(
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Get all open tabs."""
    service = OrderManagementService(db)
    tabs = service.get_open_tabs(business_id)
    return [
        {
            "id": str(t.id),
            "order_number": t.order_number,
            "tab_name": t.tab_name,
            "total": float(t.total or 0),
            "item_count": t.item_count,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in tabs
    ]


@router.post("/{order_id}/items")
def add_item(
    order_id: UUID,
    data: AddItemRequest,
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Add an item to an order."""
    service = OrderManagementService(db)
    item = service.add_item_to_order(
        order_id=order_id,
        business_id=business_id,
        name=data.name,
        unit_price=data.unit_price,
        quantity=data.quantity,
        product_id=data.product_id,
        notes=data.notes,
    )
    return {"detail": "Item added", "item_id": str(item.id)}


@router.delete("/{order_id}/items/{item_id}")
def remove_item(
    order_id: UUID,
    item_id: UUID,
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Remove an item from an order."""
    service = OrderManagementService(db)
    service.remove_item_from_order(order_id, item_id, business_id)
    return {"detail": "Item removed"}


@router.get("/{order_id}/status-history", response_model=list[StatusHistoryResponse])
def get_status_history(
    order_id: UUID,
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Get order status change history."""
    service = OrderManagementService(db)
    return service.get_status_history(order_id, business_id)


@router.post("/{order_id}/delivery")
def set_delivery_info(
    order_id: UUID,
    data: DeliveryInfoRequest,
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Set delivery information for an order."""
    service = OrderManagementService(db)
    order = service.set_delivery_info(
        order_id=order_id,
        business_id=business_id,
        delivery_address=data.delivery_address,
        delivery_phone=data.delivery_phone,
        driver_id=data.driver_id,
        estimated_time=data.estimated_time,
        delivery_fee=data.delivery_fee,
    )
    return {"detail": "Delivery info updated", "order_id": str(order.id)}


@router.get("/history")
def get_order_history(
    search: Optional[str] = None,
    status: Optional[OrderStatus] = None,
    order_type: Optional[OrderType] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Get order history with search and filtering."""
    service = OrderManagementService(db)
    orders, total = service.get_order_history(
        business_id=business_id,
        search=search,
        status_filter=status,
        order_type=order_type,
        date_from=date_from,
        date_to=date_to,
        page=page,
        per_page=per_page,
    )
    return {
        "items": [
            {
                "id": str(o.id),
                "order_number": o.order_number,
                "status": o.status.value if hasattr(o.status, 'value') else o.status,
                "order_type": o.order_type.value if o.order_type and hasattr(o.order_type, 'value') else o.order_type,
                "total": float(o.total or 0),
                "item_count": o.item_count,
                "customer_name": o.customer.name if o.customer else None,
                "order_date": o.order_date.isoformat() if o.order_date else None,
                "is_tab": o.is_tab,
                "tab_name": o.tab_name,
            }
            for o in orders
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
    }
