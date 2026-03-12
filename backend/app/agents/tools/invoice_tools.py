"""
backend/app/agents/tools/invoice_tools.py

Thin wrappers around InvoiceService for agent tool calls.
"""

from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.user import User
from app.services.ai_service import AIService
from app.services.invoice_service import InvoiceService


def _get_business_id(db: Session, user: User) -> Optional[str]:
    ai_svc = AIService(db)
    business = ai_svc._get_business_for_user(user.id)
    return str(business.id) if business else None


async def get_invoice_stats(db: Session, user: User) -> Dict[str, Any]:
    """Return invoice statistics: total, outstanding, overdue amounts."""
    business_id = _get_business_id(db, user)
    if not business_id:
        return {"error": "No business found for user"}

    svc = InvoiceService(db)
    stats = svc.get_invoice_stats(business_id)
    return stats if isinstance(stats, dict) else {"stats": str(stats)}


async def get_invoices(
    db: Session,
    user: User,
    status: Optional[str] = None,
    limit: int = 20,
) -> Dict[str, Any]:
    """Return a list of recent invoices, optionally filtered by status."""
    business_id = _get_business_id(db, user)
    if not business_id:
        return {"error": "No business found for user"}

    svc = InvoiceService(db)
    # Build filter kwargs — status filter is optional
    filter_kwargs: Dict[str, Any] = {"business_id": business_id, "limit": limit}
    if status:
        filter_kwargs["status"] = status

    invoices = svc.get_invoices(**filter_kwargs)

    return {
        "total": len(invoices),
        "invoices": [
            {
                "id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "status": inv.status.value if hasattr(inv.status, "value") else str(inv.status),
                "total": float(inv.total or 0),
                "amount_paid": float(getattr(inv, "amount_paid", 0) or 0),
                "created_at": inv.created_at.isoformat() if inv.created_at else None,
            }
            for inv in invoices
        ],
    }
