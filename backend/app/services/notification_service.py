"""Notification service for managing in-app notifications."""

import math
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from uuid import UUID

from app.models.notification import Notification, NotificationType, NotificationPriority
from app.models.inventory import InventoryItem
from app.models.product import Product
from app.schemas.notification import NotificationCreate, NotificationUpdate


class NotificationService:
    """Service for managing notifications."""

    def __init__(self, db: Session):
        self.db = db

    def create_notification(
        self,
        business_id: str,
        data: NotificationCreate,
    ) -> Notification:
        """Create a new notification."""
        notification = Notification(
            business_id=UUID(business_id),
            user_id=UUID(data.user_id) if data.user_id else None,
            notification_type=data.notification_type,
            priority=data.priority,
            title=data.title,
            message=data.message,
            reference_type=data.reference_type,
            reference_id=UUID(data.reference_id) if data.reference_id else None,
            action_url=data.action_url,
            action_label=data.action_label,
        )
        
        self.db.add(notification)
        self.db.commit()
        self.db.refresh(notification)
        
        return notification

    def get_notifications(
        self,
        business_id: str,
        user_id: Optional[str] = None,
        unread_only: bool = False,
        notification_type: Optional[NotificationType] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[Notification], int]:
        """Get notifications with filtering and pagination."""
        query = self.db.query(Notification).filter(
            Notification.business_id == UUID(business_id),
            Notification.is_archived == False,
        )
        
        # Filter by user (include broadcast notifications)
        if user_id:
            query = query.filter(
                or_(
                    Notification.user_id == UUID(user_id),
                    Notification.user_id == None,
                )
            )
        
        if unread_only:
            query = query.filter(Notification.is_read == False)
        
        if notification_type:
            query = query.filter(Notification.notification_type == notification_type)
        
        # Get total count
        total = query.count()
        
        # Apply pagination and ordering
        notifications = (
            query.order_by(Notification.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        
        return notifications, total

    def get_notification(
        self,
        notification_id: str,
        business_id: str,
    ) -> Optional[Notification]:
        """Get a notification by ID."""
        return (
            self.db.query(Notification)
            .filter(
                Notification.id == UUID(notification_id),
                Notification.business_id == UUID(business_id),
            )
            .first()
        )

    def update_notification(
        self,
        notification: Notification,
        data: NotificationUpdate,
    ) -> Notification:
        """Update a notification."""
        if data.is_read is not None:
            notification.is_read = data.is_read
        
        if data.is_archived is not None:
            notification.is_archived = data.is_archived
        
        self.db.commit()
        self.db.refresh(notification)
        
        return notification

    def mark_all_as_read(
        self,
        business_id: str,
        user_id: Optional[str] = None,
    ) -> int:
        """Mark all notifications as read."""
        query = self.db.query(Notification).filter(
            Notification.business_id == UUID(business_id),
            Notification.is_read == False,
        )
        
        if user_id:
            query = query.filter(
                or_(
                    Notification.user_id == UUID(user_id),
                    Notification.user_id == None,
                )
            )
        
        count = query.update({"is_read": True})
        self.db.commit()
        
        return count

    def delete_notification(
        self,
        notification: Notification,
    ) -> None:
        """Delete a notification."""
        self.db.delete(notification)
        self.db.commit()

    def get_unread_count(
        self,
        business_id: str,
        user_id: Optional[str] = None,
    ) -> int:
        """Get count of unread notifications."""
        query = self.db.query(func.count(Notification.id)).filter(
            Notification.business_id == UUID(business_id),
            Notification.is_read == False,
            Notification.is_archived == False,
        )
        
        if user_id:
            query = query.filter(
                or_(
                    Notification.user_id == UUID(user_id),
                    Notification.user_id == None,
                )
            )
        
        return query.scalar() or 0

    def get_notification_stats(
        self,
        business_id: str,
        user_id: Optional[str] = None,
    ) -> dict:
        """Get notification statistics."""
        query = self.db.query(Notification).filter(
            Notification.business_id == UUID(business_id),
            Notification.is_archived == False,
        )
        
        if user_id:
            query = query.filter(
                or_(
                    Notification.user_id == UUID(user_id),
                    Notification.user_id == None,
                )
            )
        
        notifications = query.all()
        
        total = len(notifications)
        unread = sum(1 for n in notifications if not n.is_read)
        
        by_type = {}
        by_priority = {}
        
        for notification in notifications:
            # Count by type
            type_key = notification.notification_type.value
            by_type[type_key] = by_type.get(type_key, 0) + 1
            
            # Count by priority
            priority_key = notification.priority.value
            by_priority[priority_key] = by_priority.get(priority_key, 0) + 1
        
        return {
            "total": total,
            "unread": unread,
            "by_type": by_type,
            "by_priority": by_priority,
        }

    # ==================== Low Stock Notifications ====================

    def check_and_create_low_stock_alerts(
        self,
        business_id: str,
    ) -> List[Notification]:
        """Check inventory and create low stock notifications."""
        # Get all low stock items
        low_stock_items = (
            self.db.query(InventoryItem)
            .filter(
                InventoryItem.business_id == UUID(business_id),
                InventoryItem.quantity_on_hand <= InventoryItem.reorder_point,
                InventoryItem.quantity_on_hand > 0,
            )
            .all()
        )
        
        out_of_stock_items = (
            self.db.query(InventoryItem)
            .filter(
                InventoryItem.business_id == UUID(business_id),
                InventoryItem.quantity_on_hand <= 0,
            )
            .all()
        )
        
        notifications = []
        
        # Create low stock notifications
        for item in low_stock_items:
            product = self.db.query(Product).filter(Product.id == item.product_id).first()
            if not product:
                continue
            
            # Check if notification already exists for this product
            existing = (
                self.db.query(Notification)
                .filter(
                    Notification.business_id == UUID(business_id),
                    Notification.notification_type == NotificationType.LOW_STOCK,
                    Notification.reference_id == item.product_id,
                    Notification.is_read == False,
                )
                .first()
            )
            
            if existing:
                continue  # Don't create duplicate notifications
            
            notification_data = NotificationCreate(
                notification_type=NotificationType.LOW_STOCK,
                priority=NotificationPriority.MEDIUM,
                title=f"Low Stock Alert: {product.name}",
                message=f"{product.name} is running low. Current stock: {item.quantity_on_hand}, Reorder point: {item.reorder_point}",
                reference_type="product",
                reference_id=str(item.product_id),
                action_url=f"/inventory/{item.id}",
                action_label="View Inventory",
            )
            
            notification = self.create_notification(business_id, notification_data)
            notifications.append(notification)
        
        # Create out of stock notifications
        for item in out_of_stock_items:
            product = self.db.query(Product).filter(Product.id == item.product_id).first()
            if not product:
                continue
            
            # Check if notification already exists
            existing = (
                self.db.query(Notification)
                .filter(
                    Notification.business_id == UUID(business_id),
                    Notification.notification_type == NotificationType.OUT_OF_STOCK,
                    Notification.reference_id == item.product_id,
                    Notification.is_read == False,
                )
                .first()
            )
            
            if existing:
                continue
            
            notification_data = NotificationCreate(
                notification_type=NotificationType.OUT_OF_STOCK,
                priority=NotificationPriority.HIGH,
                title=f"Out of Stock: {product.name}",
                message=f"{product.name} is out of stock. Immediate reorder recommended.",
                reference_type="product",
                reference_id=str(item.product_id),
                action_url=f"/inventory/{item.id}",
                action_label="Reorder Now",
            )
            
            notification = self.create_notification(business_id, notification_data)
            notifications.append(notification)
        
        return notifications
