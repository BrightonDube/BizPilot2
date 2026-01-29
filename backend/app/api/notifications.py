"""Notification API endpoints."""

import math
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db, get_sync_db
from app.api.deps import get_current_active_user, get_current_business_id
from app.core.rbac import has_permission
from app.models.user import User
from app.models.notification import NotificationType
from app.schemas.notification import (
    NotificationCreate,
    NotificationUpdate,
    NotificationResponse,
    NotificationListResponse,
    NotificationStats,
)
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _notification_to_response(notification) -> NotificationResponse:
    """Convert notification to response schema."""
    return NotificationResponse(
        id=str(notification.id),
        business_id=str(notification.business_id),
        user_id=str(notification.user_id) if notification.user_id else None,
        notification_type=notification.notification_type,
        priority=notification.priority,
        title=notification.title,
        message=notification.message,
        reference_type=notification.reference_type,
        reference_id=str(notification.reference_id) if notification.reference_id else None,
        action_url=notification.action_url,
        action_label=notification.action_label,
        is_read=notification.is_read,
        is_archived=notification.is_archived,
        created_at=notification.created_at,
        updated_at=notification.updated_at,
    )


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    unread_only: bool = False,
    notification_type: Optional[NotificationType] = None,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """List notifications for the current user."""
    service = NotificationService(db)
    
    notifications, total = service.get_notifications(
        business_id=business_id,
        user_id=str(current_user.id),
        unread_only=unread_only,
        notification_type=notification_type,
        page=page,
        per_page=per_page,
    )
    
    unread_count = service.get_unread_count(business_id, str(current_user.id))
    
    return NotificationListResponse(
        notifications=[_notification_to_response(n) for n in notifications],
        total=total,
        unread_count=unread_count,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.get("/stats", response_model=NotificationStats)
async def get_notification_stats(
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get notification statistics."""
    service = NotificationService(db)
    stats = service.get_notification_stats(business_id, str(current_user.id))
    return NotificationStats(**stats)


@router.get("/unread-count")
async def get_unread_count(
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get count of unread notifications."""
    service = NotificationService(db)
    count = service.get_unread_count(business_id, str(current_user.id))
    return {"unread_count": count}


@router.post("/check-low-stock")
async def check_low_stock(
    current_user: User = Depends(has_permission("inventory:view")),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Check inventory and create low stock notifications."""
    service = NotificationService(db)
    notifications = service.check_and_create_low_stock_alerts(business_id)
    
    return {
        "success": True,
        "notifications_created": len(notifications),
        "notifications": [_notification_to_response(n) for n in notifications],
    }


@router.post("/mark-all-read")
async def mark_all_as_read(
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Mark all notifications as read."""
    service = NotificationService(db)
    count = service.mark_all_as_read(business_id, str(current_user.id))
    
    return {
        "success": True,
        "marked_read": count,
    }


@router.get("/{notification_id}", response_model=NotificationResponse)
async def get_notification(
    notification_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get a notification by ID."""
    service = NotificationService(db)
    notification = service.get_notification(notification_id, business_id)
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    
    # Check if user has access to this notification
    if notification.user_id and str(notification.user_id) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this notification",
        )
    
    return _notification_to_response(notification)


@router.patch("/{notification_id}", response_model=NotificationResponse)
async def update_notification(
    notification_id: str,
    data: NotificationUpdate,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Update a notification (mark as read/archived)."""
    service = NotificationService(db)
    notification = service.get_notification(notification_id, business_id)
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    
    # Check if user has access to this notification
    if notification.user_id and str(notification.user_id) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this notification",
        )
    
    notification = service.update_notification(notification, data)
    return _notification_to_response(notification)


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Delete a notification."""
    service = NotificationService(db)
    notification = service.get_notification(notification_id, business_id)
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    
    # Check if user has access to this notification
    if notification.user_id and str(notification.user_id) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this notification",
        )
    
    service.delete_notification(notification)
    
    return {"success": True, "message": "Notification deleted"}


@router.post("", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED)
async def create_notification(
    data: NotificationCreate,
    current_user: User = Depends(has_permission("notifications:create")),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Create a new notification (admin only)."""
    service = NotificationService(db)
    notification = service.create_notification(business_id, data)
    return _notification_to_response(notification)
