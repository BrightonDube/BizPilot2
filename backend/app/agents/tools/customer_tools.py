"""
backend/app/agents/tools/customer_tools.py

Thin wrappers around CustomerService for agent tool calls.
"""

import asyncio
from typing import Any, Dict, Optional

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
    # CustomerService.get_customers returns (List[Customer], int) using page/per_page
    result = await asyncio.to_thread(
        svc.get_customers, business_id=business_id, per_page=int(limit)
    )
    # Handle both (list, total) tuple and plain list return shapes
    if isinstance(result, tuple):
        customers, total = result
    else:
        customers = result or []
        total = len(customers)

    return {
        "total": total,
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
    customers = await asyncio.to_thread(svc.get_top_customers, business_id=business_id, limit=int(limit))

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


async def search_customers(
    db: Session, user: User, query: str, limit: int = 20
) -> Dict[str, Any]:
    """Search customers by name, email, or phone."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    svc = CustomerService(db)
    try:
        customers = await asyncio.to_thread(
            svc.search_customers, business_id=business_id, query=query, limit=int(limit)
        )
    except AttributeError:
        # Fallback: filter from full list if search method doesn't exist
        raw = await asyncio.to_thread(svc.get_customers, business_id=business_id, per_page=100)
        all_customers = raw[0] if isinstance(raw, tuple) else (raw or [])
        q = query.lower()
        customers = [
            c for c in all_customers
            if q in (c.display_name or "").lower()
            or q in (c.email or "").lower()
            or q in (getattr(c, "phone", "") or "").lower()
        ][:limit]

    return {
        "total": len(customers),
        "customers": [
            {
                "id": str(c.id),
                "name": c.display_name,
                "email": c.email,
                "phone": getattr(c, "phone", None),
            }
            for c in customers
        ],
    }


async def create_customer(
    db: Session, user: User, name: str, email: Optional[str] = None, phone: Optional[str] = None
) -> Dict[str, Any]:
    """Create a new customer. HITL — requires approval."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    svc = CustomerService(db)
    try:
        customer = await asyncio.to_thread(
            svc.create_customer,
            business_id=business_id,
            name=name,
            email=email,
            phone=phone,
        )
        return {
            "created": True,
            "customer_id": str(customer.id),
            "name": customer.display_name,
            "email": customer.email,
        }
    except Exception as e:
        return {"error": f"Failed to create customer: {str(e)}"}


async def update_customer(
    db: Session, user: User, customer_id: str,
    name: Optional[str] = None, email: Optional[str] = None, phone: Optional[str] = None
) -> Dict[str, Any]:
    """Update customer details. HITL — requires approval."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    svc = CustomerService(db)
    update_data: Dict[str, Any] = {}
    if name is not None:
        update_data["name"] = name
    if email is not None:
        update_data["email"] = email
    if phone is not None:
        update_data["phone"] = phone

    try:
        customer = await asyncio.to_thread(
            svc.update_customer, customer_id=customer_id, **update_data
        )
        return {
            "updated": True,
            "customer_id": str(customer.id),
            "name": customer.display_name,
        }
    except Exception as e:
        return {"error": f"Failed to update customer: {str(e)}"}
