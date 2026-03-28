"""
backend/app/agents/tools/invoice_tools.py

Thin wrappers around InvoiceService for agent tool calls.
"""

import asyncio
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.user import User
from app.services.invoice_service import InvoiceService
from app.agents.tools.common import get_business_id_for_user


async def get_invoice_stats(db: Session, user: User) -> Dict[str, Any]:
    """Return invoice statistics: total, outstanding, overdue amounts."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    svc = InvoiceService(db)
    stats = await asyncio.to_thread(svc.get_invoice_stats, business_id)
    return stats if isinstance(stats, dict) else {"stats": str(stats)}


async def get_invoices(
    db: Session,
    user: User,
    status: Optional[str] = None,
    limit: int = 20,
) -> Dict[str, Any]:
    """Return a list of recent invoices, optionally filtered by status."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    svc = InvoiceService(db)
    # Build filter kwargs — status filter is optional
    filter_kwargs: Dict[str, Any] = {"business_id": business_id, "limit": limit}
    if status:
        filter_kwargs["status"] = status

    invoices = await asyncio.to_thread(svc.get_invoices, **filter_kwargs)

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


async def get_overdue_invoices(
    db: Session, user: User, limit: int = 20
) -> Dict[str, Any]:
    """Return invoices that are past their due date."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    svc = InvoiceService(db)
    try:
        invoices = await asyncio.to_thread(
            svc.get_overdue_invoices, business_id=business_id, limit=int(limit)
        )
    except AttributeError:
        # Fallback: get all invoices and filter overdue
        from datetime import datetime, timezone
        all_invoices = await asyncio.to_thread(svc.get_invoices, business_id=business_id, limit=100)
        now = datetime.now(timezone.utc)
        invoices = [
            inv for inv in all_invoices
            if getattr(inv, "due_date", None)
            and inv.due_date < now
            and (inv.status.value if hasattr(inv.status, "value") else str(inv.status)) not in ("paid", "cancelled")
        ][:limit]

    return {
        "overdue_count": len(invoices),
        "invoices": [
            {
                "id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "total": float(inv.total or 0),
                "amount_paid": float(getattr(inv, "amount_paid", 0) or 0),
                "due_date": inv.due_date.isoformat() if getattr(inv, "due_date", None) else None,
                "days_overdue": (
                    (datetime.now(timezone.utc) - inv.due_date).days
                    if getattr(inv, "due_date", None) else 0
                ),
            }
            for inv in invoices
        ],
    }


async def create_invoice(
    db: Session, user: User, customer_id: str, items: list, notes: Optional[str] = None
) -> Dict[str, Any]:
    """Create a new invoice. HITL — requires approval."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    svc = InvoiceService(db)
    try:
        invoice = await asyncio.to_thread(
            svc.create_invoice,
            business_id=business_id,
            customer_id=customer_id,
            items=items,
            notes=notes,
        )
        return {
            "created": True,
            "invoice_id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "total": float(invoice.total or 0),
        }
    except Exception as e:
        return {"error": f"Failed to create invoice: {str(e)}"}


async def record_invoice_payment(
    db: Session, user: User, invoice_id: str, amount: float, payment_method: str = "cash"
) -> Dict[str, Any]:
    """Record a payment against an invoice. HITL — requires approval."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    svc = InvoiceService(db)
    try:
        result = await asyncio.to_thread(
            svc.record_payment,
            invoice_id=invoice_id,
            amount=amount,
            payment_method=payment_method,
        )
        return {
            "recorded": True,
            "invoice_id": invoice_id,
            "amount_paid": amount,
            "payment_method": payment_method,
            "result": str(result) if result else "Payment recorded",
        }
    except Exception as e:
        return {"error": f"Failed to record payment: {str(e)}"}
