"""
backend/app/agents/tools/crm_tools.py

Tool wrappers for CRM — segments, interactions, customer metrics.
"""

import asyncio
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.user import User
from app.agents.tools.common import get_business_id_for_user


async def list_segments(
    db: Session, user: User
) -> Dict[str, Any]:
    """List all customer segments for the business."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    try:
        from app.services.crm_service import CrmService

        svc = CrmService(db)
        segments = await asyncio.to_thread(svc.list_segments, business_id=business_id)
        return {"total": len(segments), "segments": segments}
    except Exception as e:
        return {"error": f"Failed to list segments: {str(e)}"}


async def create_segment(
    db: Session,
    user: User,
    name: str,
    description: Optional[str] = None,
    color: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create a new customer segment. HITL — requires approval.
    """
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    try:
        from app.services.crm_service import CrmService

        svc = CrmService(db)
        segment = await asyncio.to_thread(
            svc.create_segment,
            business_id=business_id,
            name=name,
            description=description,
            color=color,
        )
        return {
            "created": True,
            "segment_id": str(segment.id),
            "name": name,
            "message": f"Segment '{name}' created.",
        }
    except Exception as e:
        return {"error": f"Failed to create segment: {str(e)}"}


async def log_interaction(
    db: Session,
    user: User,
    customer_id: str,
    interaction_type: str,
    subject: str,
    content: Optional[str] = None,
) -> Dict[str, Any]:
    """Log a customer interaction (call, email, visit, note)."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    try:
        from app.services.crm_service import CrmService

        svc = CrmService(db)
        interaction = await asyncio.to_thread(
            svc.log_interaction,
            customer_id=customer_id,
            business_id=business_id,
            user_id=str(user.id),
            interaction_type=interaction_type,
            subject=subject,
            content=content,
        )
        return {
            "logged": True,
            "interaction_id": str(interaction.id),
            "type": interaction_type,
            "subject": subject,
            "message": "Interaction logged for customer.",
        }
    except Exception as e:
        return {"error": f"Failed to log interaction: {str(e)}"}


async def get_customer_metrics(
    db: Session, user: User, customer_id: str
) -> Dict[str, Any]:
    """Get CRM metrics for a specific customer."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    try:
        from app.services.crm_service import CrmService

        svc = CrmService(db)
        metrics = await asyncio.to_thread(
            svc.update_customer_metrics,
            customer_id=customer_id,
            business_id=business_id,
        )
        return {
            "customer_id": customer_id,
            "total_orders": metrics.total_orders,
            "total_spent": float(metrics.total_spent or 0),
            "average_order_value": float(metrics.average_order_value or 0),
            "last_order_date": str(metrics.last_order_date) if metrics.last_order_date else None,
        }
    except Exception as e:
        return {"error": f"Failed to get customer metrics: {str(e)}"}
