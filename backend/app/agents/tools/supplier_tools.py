"""
backend/app/agents/tools/supplier_tools.py

Thin wrappers around SupplierService for agent tool calls.
"""

import asyncio
from typing import Any, Dict

from sqlalchemy.orm import Session

from app.models.user import User
from app.services.supplier_service import SupplierService
from app.agents.tools.common import get_business_id_for_user


async def get_suppliers(
    db: Session, user: User, limit: int = 20
) -> Dict[str, Any]:
    """Return a list of suppliers with contact info and payment terms."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    svc = SupplierService(db)
    suppliers = await asyncio.to_thread(svc.get_suppliers, business_id=business_id)

    return {
        "total": len(suppliers),
        "suppliers": [
            {
                "id": str(s.id),
                "name": s.name,
                "email": s.email,
                "phone": s.phone,
                "payment_terms": getattr(s, "payment_terms", None),
            }
            for s in suppliers[:limit]
        ],
    }
