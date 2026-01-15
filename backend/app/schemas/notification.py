"""Notification schemas for API validation."""

from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime

from app.models.notification import NotificationType, NotificationPriority


class NotificationBase(BaseModel):
    """Base schema for notification."""
    
    notification_type: NotificationType
    priority: NotificationPriority = NotificationPriority.MEDIUM
    title: str
    message: str
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    action_url: Optional[str] = None
    action_label: Optional[str] = None


class NotificationCreate(NotificationBase):
    """Schema for creating a notification."""
    
    user_id: Optional[str] = None  # Null = broadcast to all users


class NotificationUpdate(BaseModel):
    """Schema for updating a notification."""
    
    is_read: Optional[bool] = None
    is_archived: Optional[bool] = None


class NotificationResponse(NotificationBase):
    """Schema for notification response."""
    
    id: str
    business_id: str
    user_id: Optional[str] = None
    is_read: bool
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    """Schema for paginated notification list."""
    
    notifications: List[NotificationResponse]
    total: int
    unread_count: int
    page: int
    per_page: int
    pages: int


class NotificationStats(BaseModel):
    """Schema for notification statistics."""
    
    total: int
    unread: int
    by_type: dict[str, int]
    by_priority: dict[str, int]
