"""
backend/app/agents/tools/layby_tools.py

Tool wrappers for layby lifecycle management.
"""

import asyncio
from decimal import Decimal
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.user import User
from app.agents.tools.common import get_business_id_for_user


async def get_laybys(
    db: Session,
    user: User,
    status: Optional[str] = None,
    limit: int = 20,
) -> Dict[str, Any]:
    """List laybys, optionally filtered by status."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    try:
        from app.services.layby_service import LaybyService

        svc = LaybyService(db)
        laybys, total = await asyncio.to_thread(
            svc.list_laybys,
            business_id=UUID(business_id),
            status=status,
            per_page=limit,
        )
        return {
            "total": total,
            "laybys": [
                {
                    "id": str(lb.id),
                    "layby_number": lb.layby_number,
                    "customer_name": lb.customer.display_name if lb.customer else "N/A",
                    "total_amount": float(lb.total_amount or 0),
                    "amount_paid": float(lb.amount_paid or 0),
                    "balance_remaining": float(lb.balance_remaining or 0),
                    "status": lb.status,
                }
                for lb in laybys
            ],
        }
    except Exception as e:
        return {"error": f"Failed to list laybys: {str(e)}"}


async def get_layby_details(
    db: Session, user: User, layby_id: str
) -> Dict[str, Any]:
    """Get full details of a specific layby."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    try:
        from app.services.layby_service import LaybyService

        svc = LaybyService(db)
        layby = await asyncio.to_thread(
            svc.get_layby,
            business_id=UUID(business_id),
            layby_id=UUID(layby_id),
        )
        if not layby:
            return {"error": f"Layby '{layby_id}' not found"}

        return {
            "id": str(layby.id),
            "layby_number": layby.layby_number,
            "customer_name": layby.customer.display_name if layby.customer else "N/A",
            "total_amount": float(layby.total_amount or 0),
            "amount_paid": float(layby.amount_paid or 0),
            "balance_remaining": float(layby.balance_remaining or 0),
            "status": layby.status,
            "created_at": str(layby.created_at),
            "items": [
                {
                    "product_name": item.product.name if item.product else "N/A",
                    "quantity": item.quantity,
                    "price": float(item.price or 0),
                }
                for item in (layby.items or [])
            ],
        }
    except Exception as e:
        return {"error": f"Failed to get layby details: {str(e)}"}


async def create_layby(
    db: Session,
    user: User,
    customer_id: str,
    items: list,
    deposit_amount: float,
    frequency: str = "monthly",
) -> Dict[str, Any]:
    """
    Create a new layby. HITL — requires approval.
    items: [{"product_id": "...", "quantity": 1, "price": 100.0}, ...]
    """
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    try:
        from app.services.layby_service import LaybyService

        svc = LaybyService(db)
        layby = await asyncio.to_thread(
            svc.create_layby,
            business_id=UUID(business_id),
            customer_id=UUID(customer_id),
            items=items,
            deposit_amount=Decimal(str(deposit_amount)),
            frequency=frequency,
            created_by=UUID(str(user.id)),
        )
        return {
            "created": True,
            "layby_id": str(layby.id),
            "layby_number": layby.layby_number,
            "total_amount": float(layby.total_amount or 0),
            "deposit": float(deposit_amount),
            "message": f"Layby {layby.layby_number} created with R{deposit_amount:,.2f} deposit.",
        }
    except Exception as e:
        return {"error": f"Failed to create layby: {str(e)}"}


async def record_layby_payment(
    db: Session,
    user: User,
    layby_id: str,
    amount: float,
    payment_method: str = "cash",
) -> Dict[str, Any]:
    """
    Record a payment against a layby. HITL — requires approval.
    """
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    try:
        from app.services.layby_service import LaybyService

        svc = LaybyService(db)
        payment = await asyncio.to_thread(
            svc.make_payment,
            business_id=UUID(business_id),
            layby_id=UUID(layby_id),
            amount=Decimal(str(amount)),
            payment_method=payment_method,
            processed_by=UUID(str(user.id)),
        )
        return {
            "recorded": True,
            "payment_id": str(payment.id),
            "amount": float(amount),
            "method": payment_method,
            "message": f"Payment of R{amount:,.2f} recorded on layby.",
        }
    except Exception as e:
        return {"error": f"Failed to record layby payment: {str(e)}"}


async def get_overdue_laybys(
    db: Session, user: User, limit: int = 20
) -> Dict[str, Any]:
    """List laybys that have overdue payments."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    try:
        from app.services.layby_service import LaybyService

        svc = LaybyService(db)
        laybys, total = await asyncio.to_thread(
            svc.list_laybys,
            business_id=UUID(business_id),
            status="overdue",
            per_page=limit,
        )
        return {
            "total": total,
            "overdue_laybys": [
                {
                    "id": str(lb.id),
                    "layby_number": lb.layby_number,
                    "customer_name": lb.customer.display_name if lb.customer else "N/A",
                    "balance_remaining": float(lb.balance_remaining or 0),
                    "status": lb.status,
                }
                for lb in laybys
            ],
        }
    except Exception as e:
        return {"error": f"Failed to list overdue laybys: {str(e)}"}
