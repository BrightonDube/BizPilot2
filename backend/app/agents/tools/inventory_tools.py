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
