"""Notification API endpoints."""

import math
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel as PydanticBase

from app.core.database import get_sync_db
from app.api.deps import get_current_active_user, get_current_business_id
from app.models.user import User
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])


# ── request / response schemas ─────────────────────────────

class NotificationOut(PydanticBase):
    id: str
    business_id: str
    user_id: str
    title: str
    message: str
    notification_type: str
    channel: str
    is_read: bool
    action_url: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class NotificationListOut(PydanticBase):
    items: List[NotificationOut]
    total: int
    page: int
    per_page: int
    pages: int


class PreferenceOut(PydanticBase):
    order_notifications: bool
    inventory_alerts: bool
    payment_notifications: bool
    system_notifications: bool
    email_enabled: bool
    push_enabled: bool

    model_config = {"from_attributes": True}


class PreferenceUpdate(PydanticBase):
    order_notifications: Optional[bool] = None
    inventory_alerts: Optional[bool] = None
    payment_notifications: Optional[bool] = None
    system_notifications: Optional[bool] = None
    email_enabled: Optional[bool] = None
    push_enabled: Optional[bool] = None


class SendNotificationBody(PydanticBase):
    user_id: Optional[str] = None  # None = all business users
    title: str
    message: str
    notification_type: str = "info"


# ── helpers ────────────────────────────────────────────────

def _to_out(n) -> NotificationOut:
    return NotificationOut(
        id=str(n.id),
        business_id=str(n.business_id),
        user_id=str(n.user_id),
        title=n.title,
        message=n.message,
        notification_type=n.notification_type if isinstance(n.notification_type, str) else n.notification_type.value,
        channel=n.channel if isinstance(n.channel, str) else n.channel.value,
        is_read=n.is_read,
        action_url=n.action_url,
        resource_type=n.resource_type,
        resource_id=n.resource_id,
        created_at=n.created_at.isoformat(),
        updated_at=n.updated_at.isoformat(),
    )


# ── endpoints ──────────────────────────────────────────────

@router.get("", response_model=NotificationListOut)
async def list_notifications(
    is_read: Optional[bool] = None,
    notification_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """List notifications for the current user."""
    service = NotificationService(db)
    items, total = service.list_notifications(
        user_id=str(current_user.id),
        is_read=is_read,
        notification_type=notification_type,
        page=page,
        per_page=per_page,
    )
    return NotificationListOut(
        items=[_to_out(n) for n in items],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.get("/unread-count")
async def get_unread_count(
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """Get count of unread notifications."""
    service = NotificationService(db)
    count = service.get_unread_count(str(current_user.id))
    return {"unread_count": count}


@router.patch("/{notification_id}/read")
async def mark_as_read(
    notification_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """Mark a single notification as read."""
    service = NotificationService(db)
    notification = service.mark_as_read(notification_id, str(current_user.id))
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return {"success": True}


@router.post("/mark-all-read")
async def mark_all_as_read(
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """Mark all notifications as read."""
    service = NotificationService(db)
    count = service.mark_all_as_read(str(current_user.id))
    return {"success": True, "marked_read": count}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """Delete (soft) a notification."""
    service = NotificationService(db)
    deleted = service.delete_notification(notification_id, str(current_user.id))
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return {"success": True}


@router.get("/preferences", response_model=PreferenceOut)
async def get_preferences(
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """Get notification preferences."""
    service = NotificationService(db)
    return service.get_preferences(str(current_user.id))


@router.put("/preferences", response_model=PreferenceOut)
async def update_preferences(
    data: PreferenceUpdate,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
):
    """Update notification preferences."""
    service = NotificationService(db)
    return service.update_preferences(str(current_user.id), **data.model_dump(exclude_unset=True))


@router.post("/send", status_code=status.HTTP_201_CREATED)
async def send_notification(
    data: SendNotificationBody,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Send notification to a user or all business users (admin endpoint)."""
    service = NotificationService(db)
    if data.user_id:
        notification = service.create_notification(
            business_id=business_id,
            user_id=data.user_id,
            title=data.title,
            message=data.message,
            notification_type=data.notification_type,
        )
        return {"success": True, "notifications_sent": 1, "notifications": [_to_out(notification)]}
    else:
        notifications = service.notify_business_users(
            business_id=business_id,
            title=data.title,
            message=data.message,
            notification_type=data.notification_type,
        )
        return {
            "success": True,
            "notifications_sent": len(notifications),
            "notifications": [_to_out(n) for n in notifications],
        }
