"""
backend/app/agents/tools/supplier_tools.py

Thin wrappers around SupplierService for agent tool calls.
"""

from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.user import User
from app.services.ai_service import AIService
from app.services.supplier_service import SupplierService


def _get_business_id(db: Session, user: User) -> Optional[str]:
    ai_svc = AIService(db)
    business = ai_svc._get_business_for_user(user.id)
    return str(business.id) if business else None


async def get_suppliers(
    db: Session, user: User, limit: int = 20
) -> Dict[str, Any]:
    """Return a list of suppliers with contact info and payment terms."""
    business_id = _get_business_id(db, user)
    if not business_id:
        return {"error": "No business found for user"}

    svc = SupplierService(db)
    suppliers = svc.get_suppliers(business_id=business_id)

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
