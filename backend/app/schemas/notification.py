"""Notification schemas for API validation."""

from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from datetime import datetime



class NotificationResponse(BaseModel):
    """Schema for notification response."""

    model_config = ConfigDict(from_attributes=True)

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
    created_at: datetime
    updated_at: datetime


class NotificationListResponse(BaseModel):
    """Schema for paginated notification list."""

    items: List[NotificationResponse]
    total: int
    page: int
    per_page: int
    pages: int


class NotificationPreferenceResponse(BaseModel):
    """Schema for notification preference response."""

    model_config = ConfigDict(from_attributes=True)

    order_notifications: bool
    inventory_alerts: bool
    payment_notifications: bool
    system_notifications: bool
    email_enabled: bool
    push_enabled: bool


class NotificationPreferenceUpdate(BaseModel):
    """Schema for updating notification preferences."""

    order_notifications: Optional[bool] = None
    inventory_alerts: Optional[bool] = None
    payment_notifications: Optional[bool] = None
    system_notifications: Optional[bool] = None
    email_enabled: Optional[bool] = None
    push_enabled: Optional[bool] = None
