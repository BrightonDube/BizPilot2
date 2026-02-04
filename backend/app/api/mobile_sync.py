"""Mobile sync API endpoints.

This module provides endpoints for mobile device synchronization,
including device registration and permission data delivery.

Feature: granular-permissions-subscription
Task: 10.1 Update sync endpoint with device registration and permissions
Requirements: 7.3, 7.4, 7.5
"""

from typing import Optional
from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel

from app.api.deps import (
    get_current_active_user,
    get_current_business_id,
    check_device_limit,
    get_permission_service
)
from app.core.database import get_db
from app.models.user import User
from app.services.permission_service import PermissionService


router = APIRouter(prefix="/mobile", tags=["Mobile Sync"])


class SyncRequest(BaseModel):
    """Request payload for mobile sync."""
    last_sync_at: Optional[str] = None
    device_info: Optional[dict] = None


class SyncResponse(BaseModel):
    """Response payload for mobile sync."""
    success: bool
    message: str
    permissions: dict
    sync_timestamp: str
    device: dict


@router.post("/sync")
async def sync_data(
    request: SyncRequest,
    device_id: Optional[str] = Header(None, alias="X-Device-ID"),
    device_name: Optional[str] = Header(None, alias="X-Device-Name"),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    device: dict = Depends(check_device_limit),
    db=Depends(get_db),
    permission_service: PermissionService = Depends(get_permission_service)
) -> SyncResponse:
    """
    Mobile sync endpoint with device registration and permissions.
    
    This endpoint:
    1. Validates device limits (via check_device_limit dependency) - Requirement 7.4
    2. Registers/updates device in DeviceRegistry - Requirement 7.3
    3. Retrieves business permissions - Requirement 7.3
    4. Returns permissions in sync response - Requirement 7.5
    
    The check_device_limit dependency already handles:
    - Device registration via DeviceService.register_device
    - Device limit enforcement
    - SuperAdmin bypass
    
    Args:
        request: Sync request with last_sync_at and device_info
        device_id: Device ID from X-Device-ID header
        device_name: Device name from X-Device-Name header
        current_user: Authenticated user
        business_id: Current business ID
        device: Device record from check_device_limit dependency
        db: Database session
        permission_service: Permission service instance
    
    Returns:
        SyncResponse with permissions and device info
    
    Validates: Requirements 7.3, 7.4, 7.5
    """
    # Get business permissions - Requirement 7.3
    permissions = await permission_service.get_business_permissions(business_id)
    
    # Get current timestamp for sync
    from datetime import datetime, timezone
    sync_timestamp = datetime.now(timezone.utc).isoformat()
    
    # Build response - Requirement 7.5
    return SyncResponse(
        success=True,
        message="Sync completed successfully",
        permissions=permissions,
        sync_timestamp=sync_timestamp,
        device={
            "device_id": device.get("device_id", device_id),
            "device_name": device.get("device_name", device_name),
            "is_active": device.get("is_active", True),
            "is_superadmin": device.get("is_superadmin", False)
        }
    )


@router.get("/permissions")
async def get_mobile_permissions(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    permission_service: PermissionService = Depends(get_permission_service)
) -> dict:
    """
    Get current permissions for mobile client.
    
    This is a lightweight endpoint for checking permissions without
    performing a full sync operation.
    
    Args:
        current_user: Authenticated user
        business_id: Current business ID
        permission_service: Permission service instance
    
    Returns:
        Permissions dictionary
    """
    permissions = await permission_service.get_business_permissions(business_id)
    return permissions
