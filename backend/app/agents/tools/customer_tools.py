"""
backend/app/agents/tools/customer_tools.py

Thin wrappers around CustomerService for agent tool calls.
"""

import asyncio
from typing import Any, Dict

from sqlalchemy.orm import Session

from app.models.user import User
from app.services.customer_service import CustomerService
from app.agents.tools.common import get_business_id_for_user


async def get_customers(
    db: Session, user: User, limit: int = 20
) -> Dict[str, Any]:
    """Return a list of customers with basic info."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    svc = CustomerService(db)
    customers = await asyncio.to_thread(svc.get_customers, business_id=business_id, limit=limit)

    return {
        "total": len(customers),
        "customers": [
            {
                "id": str(c.id),
                "name": c.display_name,
                "email": c.email,
                "total_orders": int(c.total_orders or 0),
                "total_spent": float(c.total_spent or 0),
            }
            for c in customers
        ],
    }


async def get_top_customers(
    db: Session, user: User, limit: int = 10
) -> Dict[str, Any]:
    """Return highest-value customers ranked by total spend."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    svc = CustomerService(db)
    customers = await asyncio.to_thread(svc.get_top_customers, business_id=business_id, limit=limit)

    return {
        "top_customers": [
            {
                "name": c.display_name,
                "total_spent": float(c.total_spent or 0),
                "total_orders": int(c.total_orders or 0),
                "average_order_value": float(c.average_order_value or 0),
            }
            for c in customers
        ]
    }
