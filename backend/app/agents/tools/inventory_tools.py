"""
backend/app/agents/tools/inventory_tools.py

Thin wrappers around InventoryService for agent tool calls.
"""

import asyncio
from typing import Any, Dict

from sqlalchemy.orm import Session

from app.models.user import User
from app.services.inventory_service import InventoryService
from app.agents.tools.common import get_business_id_for_user


async def get_inventory_summary(
    db: Session, user: User
) -> Dict[str, Any]:
    """Return a high-level inventory summary: total items, low-stock count, value."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    svc = InventoryService(db)
    summary = await asyncio.to_thread(svc.get_inventory_summary, business_id)
    return summary if isinstance(summary, dict) else {"summary": str(summary)}


async def get_low_stock_items(
    db: Session, user: User, limit: int = 20
) -> Dict[str, Any]:
    """Return items at or below their reorder threshold."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    svc = InventoryService(db)
    items = await asyncio.to_thread(svc.get_low_stock_items, business_id)

    return {
        "low_stock_count": len(items),
        "items": [
            {
                "product_id": str(i.product_id),
                "quantity_on_hand": int(i.quantity_on_hand),
                "reorder_point": int(i.reorder_point),
                "location": i.location,
            }
            for i in items[:limit]
        ],
    }


async def adjust_stock(
    db: Session, user: User, product_id: str, adjustment: int, reason: str
) -> Dict[str, Any]:
    """Adjust stock quantity. HITL — requires approval."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    svc = InventoryService(db)
    try:
        result = await asyncio.to_thread(
            svc.adjust_stock,
            product_id=product_id,
            adjustment=adjustment,
            reason=reason,
            business_id=business_id,
        )
        return {
            "adjusted": True,
            "product_id": product_id,
            "adjustment": adjustment,
            "reason": reason,
            "result": str(result) if result else "Stock adjusted",
        }
    except Exception as e:
        return {"error": f"Failed to adjust stock: {str(e)}"}


async def get_inventory_value(db: Session, user: User) -> Dict[str, Any]:
    """Get total inventory value."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    svc = InventoryService(db)
    try:
        value = await asyncio.to_thread(svc.get_inventory_value, business_id=business_id)
        if isinstance(value, dict):
            return value
        return {"total_value": float(value) if value else 0}
    except AttributeError:
        summary = await asyncio.to_thread(svc.get_inventory_summary, business_id)
        if isinstance(summary, dict):
            return {"total_value": summary.get("total_value", 0)}
        return {"total_value": 0, "note": "Inventory value calculation not available"}


async def get_reorder_suggestions(
    db: Session, user: User, limit: int = 10
) -> Dict[str, Any]:
    """Get reorder suggestions based on stock levels."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    svc = InventoryService(db)
    try:
        suggestions = await asyncio.to_thread(
            svc.get_reorder_suggestions, business_id=business_id, limit=int(limit)
        )
        if isinstance(suggestions, list):
            return {"suggestions": suggestions}
        return {"suggestions": suggestions}
    except AttributeError:
        # Fallback: derive from low stock items
        items = await asyncio.to_thread(svc.get_low_stock_items, business_id)
        return {
            "suggestions": [
                {
                    "product_id": str(i.product_id),
                    "current_stock": int(i.quantity_on_hand),
                    "reorder_point": int(i.reorder_point),
                    "suggested_quantity": max(int(i.reorder_point) * 2 - int(i.quantity_on_hand), 0),
                }
                for i in items[:limit]
            ]
        }
