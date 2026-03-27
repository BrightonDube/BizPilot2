"""
backend/app/agents/tools/notification_tools.py

Tool wrappers for in-app notifications.
"""

import asyncio
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.user import User
from app.agents.tools.common import get_business_id_for_user


async def send_notification(
    db: Session,
    user: User,
    title: str,
    message: str,
    notification_type: str = "info",
) -> Dict[str, Any]:
    """Send an in-app notification to the current user."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    try:
        from app.services.notification_service import NotificationService

        svc = NotificationService(db)
        notification = await asyncio.to_thread(
            svc.create_notification,
            business_id=business_id,
            user_id=str(user.id),
            title=title,
            message=message,
            notification_type=notification_type,
        )

        return {
            "created": True,
            "notification_id": str(notification.id),
            "title": title,
            "message": f"Notification '{title}' sent to you.",
        }
    except Exception as e:
        return {"error": f"Failed to create notification: {str(e)}"}


async def notify_all_staff(
    db: Session,
    user: User,
    title: str,
    message: str,
    notification_type: str = "info",
) -> Dict[str, Any]:
    """
    Send a notification to all staff in the business.
    HITL — requires approval.
    """
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    try:
        from app.services.notification_service import NotificationService
        from app.models.business import BusinessUser

        svc = NotificationService(db)

        # Get all users in the business
        business_users = await asyncio.to_thread(
            lambda: db.query(BusinessUser).filter(
                BusinessUser.business_id == business_id,
                BusinessUser.deleted_at.is_(None),
            ).all()
        )

        count = 0
        for bu in business_users:
            await asyncio.to_thread(
                svc.create_notification,
                business_id=business_id,
                user_id=str(bu.user_id),
                title=title,
                message=message,
                notification_type=notification_type,
            )
            count += 1

        return {
            "sent": True,
            "recipients": count,
            "title": title,
            "message": f"Notification sent to {count} staff members.",
        }
    except Exception as e:
        return {"error": f"Failed to notify staff: {str(e)}"}
