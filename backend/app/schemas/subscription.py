"""Pydantic schemas for subscription and permissions system.

Feature: granular-permissions-subscription
Task: 1.3 Create Pydantic schemas
Requirements: 7.1, 7.2
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


class TierFeatureSchema(BaseModel):
    """Schema for tier feature configuration."""
    model_config = ConfigDict(from_attributes=True)
    
    tier_name: str = Field(..., description="Tier name (demo, pilot_core, pilot_pro, enterprise)")
    max_devices: Optional[int] = Field(None, description="Maximum devices (NULL = unlimited)")
    max_users: Optional[int] = Field(None, description="Maximum users (NULL = unlimited)")
    has_payroll: bool = Field(..., description="Payroll feature access")
    has_ai: bool = Field(..., description="AI features access")
    has_api_access: bool = Field(..., description="API integrations access")
    has_advanced_reporting: bool = Field(..., description="Advanced reporting access")
    has_multi_location: bool = Field(..., description="Multi-location support")
    has_loyalty_programs: bool = Field(..., description="Loyalty programs access")
    has_recipe_management: bool = Field(..., description="Recipe management access")
    has_accounting_integration: bool = Field(..., description="Accounting integration access")
    price_monthly: float = Field(..., description="Monthly price in ZAR")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")


class BusinessSubscriptionSchema(BaseModel):
    """Schema for business subscription."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int = Field(..., description="Subscription ID")
    business_id: UUID = Field(..., description="Business ID")
    tier_name: str = Field(..., description="Subscription tier name")
    status: str = Field(..., description="Subscription status (active, suspended, cancelled, expired)")
    valid_until: Optional[datetime] = Field(None, description="Demo expiry date (for demo tier)")
    trial_end_date: Optional[datetime] = Field(None, description="Trial period end date")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")


class FeatureOverrideSchema(BaseModel):
    """Schema for feature override."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int = Field(..., description="Override ID")
    business_id: UUID = Field(..., description="Business ID")
    feature_name: str = Field(..., description="Feature name being overridden")
    feature_value: str = Field(..., description="Override value (as text)")
    created_by: UUID = Field(..., description="SuperAdmin user ID who created override")
    created_at: datetime = Field(..., description="Creation timestamp")


class PermissionsResponse(BaseModel):
    """
    Response schema for GET /api/permissions/me endpoint.
    
    Returns all permissions for the current user's business.
    Validates: Requirements 7.1, 7.2
    """
    model_config = ConfigDict(from_attributes=True)
    
    granted_features: List[str] = Field(..., description="List of granted feature names")
    tier: str = Field(..., description="Current subscription tier")
    status: str = Field(..., description="Subscription status")
    demo_expires_at: Optional[datetime] = Field(None, description="Demo expiry date")
    device_limit: int = Field(..., description="Maximum devices allowed")


class DeviceRegistrySchema(BaseModel):
    """Schema for device registry entry."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int = Field(..., description="Device registry ID")
    device_id: str = Field(..., description="Unique device identifier")
    device_name: str = Field(..., description="Human-readable device name")
    business_id: UUID = Field(..., description="Business ID")
    user_id: UUID = Field(..., description="User ID who registered device")
    last_sync_time: datetime = Field(..., description="Last sync timestamp")
    is_active: bool = Field(..., description="Whether device is active")
    created_at: datetime = Field(..., description="Registration timestamp")


class AuditLogSchema(BaseModel):
    """Schema for audit log entry."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int = Field(..., description="Audit log ID")
    business_id: Optional[UUID] = Field(None, description="Business ID (nullable for system-wide actions)")
    admin_user_id: UUID = Field(..., description="SuperAdmin user ID")
    action: str = Field(..., description="Action type")
    changes: Dict[str, Any] = Field(..., description="Changes as JSONB")
    created_at: datetime = Field(..., description="Action timestamp")


# Request schemas for API endpoints

class CreateSubscriptionRequest(BaseModel):
    """Request schema for creating a subscription."""
    
    business_id: UUID = Field(..., description="Business ID")
    tier_name: str = Field(..., description="Tier name")
    device_limit: int = Field(1, description="Device limit (default 1)")
    demo_expires_at: Optional[datetime] = Field(None, description="Demo expiry date")


class UpdateSubscriptionRequest(BaseModel):
    """Request schema for updating a subscription."""
    
    tier_name: Optional[str] = Field(None, description="New tier name")
    status: Optional[str] = Field(None, description="New status")
    device_limit: Optional[int] = Field(None, description="New device limit")
    demo_expires_at: Optional[datetime] = Field(None, description="New demo expiry date")


class FeatureOverrideRequest(BaseModel):
    """Request schema for adding/updating a feature override."""
    
    feature_name: str = Field(..., description="Feature name to override")
    granted: bool = Field(..., description="Whether to grant or deny the feature")


class DeviceRegistrationRequest(BaseModel):
    """Request schema for device registration."""
    
    device_id: str = Field(..., description="Unique device identifier")
    device_name: str = Field(..., description="Human-readable device name")


# Additional schemas for API compatibility

class BusinessPermissions(BaseModel):
    """Business permissions response schema."""
    
    granted_features: List[str] = Field(..., description="List of granted features")
    tier: str = Field(..., description="Subscription tier")
    status: str = Field(..., description="Subscription status")
    demo_expires_at: Optional[datetime] = Field(None, description="Demo expiry date")
    device_limit: int = Field(..., description="Device limit")


class TierUpdateRequest(BaseModel):
    """Request to update subscription tier."""
    
    tier_name: str = Field(..., description="New tier name")


class FeatureOverridesRequest(BaseModel):
    """Request to update feature overrides."""
    
    overrides: Dict[str, bool] = Field(..., description="Feature overrides map")


class DeviceDetail(BaseModel):
    """Device details response."""
    model_config = ConfigDict(from_attributes=True)
    
    device_id: str = Field(..., description="Device ID")
    device_name: str = Field(..., description="Device name")
    last_sync_time: datetime = Field(..., description="Last sync time")
    is_active: bool = Field(..., description="Active status")


class BusinessSubscriptionDetail(BaseModel):
    """Detailed business subscription response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int = Field(..., description="Subscription ID")
    business_id: UUID = Field(..., description="Business ID")
    tier_name: str = Field(..., description="Tier name")
    status: str = Field(..., description="Status")
    valid_until: Optional[datetime] = Field(None, description="Valid until date")
    devices: List[DeviceDetail] = Field(default_factory=list, description="Registered devices")


class SyncResponse(BaseModel):
    """Mobile sync response with permissions."""
    
    permissions: BusinessPermissions = Field(..., description="Business permissions")
    sync_timestamp: datetime = Field(..., description="Sync timestamp")


class PermissionCheckResponse(BaseModel):
    """Permission check response."""
    
    has_access: bool = Field(..., description="Whether access is granted")
    feature: str = Field(..., description="Feature name")


class SubscriptionStatusUpdate(BaseModel):
    """Subscription status update request."""
    
    status: str = Field(..., description="New status")


class AuditLogEntry(BaseModel):
    """Audit log entry response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int = Field(..., description="Log ID")
    business_id: Optional[UUID] = Field(None, description="Business ID")
    admin_user_id: UUID = Field(..., description="Admin user ID")
    action: str = Field(..., description="Action")
    changes: Dict[str, Any] = Field(..., description="Changes")
    created_at: datetime = Field(..., description="Timestamp")
