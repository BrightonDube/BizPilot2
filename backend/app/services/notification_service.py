"""Notification service for managing in-app notifications."""

from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func
from uuid import UUID

from app.models.notification import (
    Notification,
    NotificationPreference,
)
from app.models.business_user import BusinessUser, BusinessUserStatus


class NotificationService:
    """Service for managing notifications."""

    def __init__(self, db: Session):
        self.db = db

    # ── core CRUD ──────────────────────────────────────────────

    def create_notification(
        self,
        business_id: str,
        user_id: str,
        title: str,
        message: str,
        notification_type: str = "info",
        channel: str = "in_app",
        action_url: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
    ) -> Notification:
        """Create a single notification."""
        notification = Notification(
            business_id=UUID(business_id),
            user_id=UUID(user_id),
            title=title,
            message=message,
            notification_type=notification_type,
            channel=channel,
            action_url=action_url,
            resource_type=resource_type,
            resource_id=resource_id,
        )
        self.db.add(notification)
        self.db.commit()
        self.db.refresh(notification)
        return notification

    def notify_business_users(
        self,
        business_id: str,
        title: str,
        message: str,
        notification_type: str = "info",
        exclude_user_id: Optional[str] = None,
    ) -> List[Notification]:
        """Notify all active users in a business."""
        query = self.db.query(BusinessUser).filter(
            BusinessUser.business_id == UUID(business_id),
            BusinessUser.status == BusinessUserStatus.ACTIVE,
            BusinessUser.deleted_at.is_(None),
        )
        if exclude_user_id:
            query = query.filter(BusinessUser.user_id != UUID(exclude_user_id))

        business_users = query.all()
        notifications: List[Notification] = []
        for bu in business_users:
            n = Notification(
                business_id=UUID(business_id),
                user_id=bu.user_id,
                title=title,
                message=message,
                notification_type=notification_type,
            )
            self.db.add(n)
            notifications.append(n)

        self.db.commit()
        for n in notifications:
            self.db.refresh(n)
        return notifications

    # ── listing / counts ───────────────────────────────────────

    def list_notifications(
        self,
        user_id: str,
        is_read: Optional[bool] = None,
        notification_type: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[Notification], int]:
        """List user notifications with optional filters and pagination."""
        query = self.db.query(Notification).filter(
            Notification.user_id == UUID(user_id),
            Notification.deleted_at.is_(None),
        )
        if is_read is not None:
            query = query.filter(Notification.is_read == is_read)
        if notification_type:
            query = query.filter(Notification.notification_type == notification_type)

        total = query.count()
        items = (
            query.order_by(Notification.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def get_unread_count(self, user_id: str) -> int:
        """Count unread notifications for a user."""
        return (
            self.db.query(func.count(Notification.id))
            .filter(
                Notification.user_id == UUID(user_id),
                Notification.is_read.is_(False),
                Notification.deleted_at.is_(None),
            )
            .scalar()
            or 0
        )

    # ── read / delete ──────────────────────────────────────────

    def mark_as_read(self, notification_id: str, user_id: str) -> Optional[Notification]:
        """Mark a single notification as read."""
        notification = (
            self.db.query(Notification)
            .filter(
                Notification.id == UUID(notification_id),
                Notification.user_id == UUID(user_id),
                Notification.deleted_at.is_(None),
            )
            .first()
        )
        if not notification:
            return None
        notification.is_read = True
        self.db.commit()
        self.db.refresh(notification)
        return notification

    def mark_all_as_read(self, user_id: str) -> int:
        """Mark all unread notifications as read for a user."""
        count = (
            self.db.query(Notification)
            .filter(
                Notification.user_id == UUID(user_id),
                Notification.is_read.is_(False),
                Notification.deleted_at.is_(None),
            )
            .update({"is_read": True})
        )
        self.db.commit()
        return count

    def delete_notification(self, notification_id: str, user_id: str) -> bool:
        """Soft-delete a notification."""
        notification = (
            self.db.query(Notification)
            .filter(
                Notification.id == UUID(notification_id),
                Notification.user_id == UUID(user_id),
                Notification.deleted_at.is_(None),
            )
            .first()
        )
        if not notification:
            return False
        notification.soft_delete()
        self.db.commit()
        return True

    # ── preferences ────────────────────────────────────────────

    def get_preferences(self, user_id: str) -> NotificationPreference:
        """Get or create default notification preferences for a user."""
        pref = (
            self.db.query(NotificationPreference)
            .filter(NotificationPreference.user_id == UUID(user_id))
            .first()
        )
        if not pref:
            pref = NotificationPreference(user_id=UUID(user_id))
            self.db.add(pref)
            self.db.commit()
            self.db.refresh(pref)
        return pref

    def update_preferences(self, user_id: str, **kwargs) -> NotificationPreference:
        """Update notification preferences for a user."""
        pref = self.get_preferences(user_id)
        allowed = {
            "order_notifications",
            "inventory_alerts",
            "payment_notifications",
            "system_notifications",
            "email_enabled",
            "push_enabled",
        }
        for key, value in kwargs.items():
            if key in allowed and value is not None:
                setattr(pref, key, value)
        self.db.commit()
        self.db.refresh(pref)
        return pref

