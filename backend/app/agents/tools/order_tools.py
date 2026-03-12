"""
backend/app/agents/tools/order_tools.py

Thin wrappers around OrderService for agent tool calls.
No business logic lives here — only input/output transformation.
"""

from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.user import User
from app.services.ai_service import AIService
from app.services.order_service import OrderService


def _get_business_id(db: Session, user: User) -> Optional[str]:
    """Resolve the business_id for a user. Returns None if not found."""
    ai_svc = AIService(db)
    business = ai_svc._get_business_for_user(user.id)
    return str(business.id) if business else None


async def get_orders(
    db: Session, user: User, limit: int = 20
) -> Dict[str, Any]:
    """Return a list of recent purchase orders."""
    business_id = _get_business_id(db, user)
    if not business_id:
        return {"error": "No business found for user"}

    svc = OrderService(db)
    orders = svc.get_orders(business_id=business_id, limit=limit)

    return {
        "orders": [
            {
                "id": str(o.id),
                "order_number": o.order_number,
                "status": o.status.value if hasattr(o.status, "value") else str(o.status),
                "total": float(o.total or 0),
                "created_at": o.created_at.isoformat() if o.created_at else None,
            }
            for o in (orders if isinstance(orders, list) else [])
        ]
    }


async def get_order(
    db: Session, user: User, order_number: str
) -> Dict[str, Any]:
    """Return full details of a single order by order number."""
    business_id = _get_business_id(db, user)
    if not business_id:
        return {"error": "No business found for user"}

    svc = OrderService(db)
    order = svc.get_order_by_number(order_number, business_id)
    if not order:
        return {"error": f"Order {order_number} not found"}

    items = svc.get_order_items(str(order.id))
    return {
        "id": str(order.id),
        "order_number": order.order_number,
        "status": order.status.value if hasattr(order.status, "value") else str(order.status),
        "total": float(order.total or 0),
        "item_count": len(items),
        "created_at": order.created_at.isoformat() if order.created_at else None,
    }


async def create_order_draft(
    db: Session,
    user: User,
    supplier_name: str,
    items: List[Dict[str, Any]],
    notes: str = "",
) -> Dict[str, Any]:
    """
    Create a draft order — not submitted, not sent to supplier.
    Returns the draft details for user review.
    """
    business_id = _get_business_id(db, user)
    if not business_id:
        return {"error": "No business found for user"}

    # Resolve supplier
    from app.services.supplier_service import SupplierService
    sup_svc = SupplierService(db)
    suppliers = sup_svc.get_suppliers(business_id=business_id)
    supplier = next(
        (s for s in suppliers if supplier_name.lower() in s.name.lower()), None
    )
    if not supplier:
        return {"error": f"Supplier '{supplier_name}' not found. Check the supplier list."}

    from app.schemas.order import OrderCreate, OrderItemCreate
    from app.models.order import OrderDirection, OrderStatus

    item_schemas = []
    for item in items:
        # Each item dict must have product_id and quantity
        if "product_id" not in item or "quantity" not in item:
            return {"error": "Each item must have 'product_id' and 'quantity'"}
        item_schemas.append(
            OrderItemCreate(
                product_id=item["product_id"],
                quantity=item["quantity"],
                unit_price=item.get("unit_price"),
            )
        )

    order_data = OrderCreate(
        supplier_id=str(supplier.id),
        items=item_schemas,
        notes=notes,
        status=OrderStatus.DRAFT,
        direction=OrderDirection.INBOUND,
    )

    svc = OrderService(db)
    order = svc.create_order(business_id=business_id, data=order_data)

    return {
        "draft_created": True,
        "order_id": str(order.id),
        "order_number": order.order_number,
        "supplier": supplier.name,
        "total": float(order.total or 0),
        "status": "DRAFT",
        "message": "Draft created. Awaiting your approval to submit.",
    }


async def submit_order_draft(
    db: Session, user: User, order_id: str
) -> Dict[str, Any]:
    """
    Submit a previously created draft order.
    This is a HITL tool — must only be called after explicit user approval.
    """
    business_id = _get_business_id(db, user)
    if not business_id:
        return {"error": "No business found for user"}

    svc = OrderService(db)
    order = svc.get_order(order_id, business_id)
    if not order:
        return {"error": f"Order {order_id} not found"}

    from app.models.order import OrderStatus
    updated = svc.update_order_status(order, OrderStatus.SUBMITTED)

    return {
        "submitted": True,
        "order_id": str(updated.id),
        "order_number": updated.order_number,
        "status": updated.status.value,
        "message": f"Order {updated.order_number} submitted successfully.",
    }


async def update_order_status(
    db: Session, user: User, order_id: str, status: str
) -> Dict[str, Any]:
    """Update the status of a purchase order. HITL — requires approval."""
    business_id = _get_business_id(db, user)
    if not business_id:
        return {"error": "No business found for user"}

    from app.models.order import OrderStatus

    try:
        new_status = OrderStatus(status)
    except ValueError:
        return {"error": f"Invalid status '{status}'"}

    svc = OrderService(db)
    order = svc.get_order(order_id, business_id)
    if not order:
        return {"error": f"Order {order_id} not found"}

    updated = svc.update_order_status(order, new_status)
    return {
        "updated": True,
        "order_number": updated.order_number,
        "new_status": updated.status.value,
    }
