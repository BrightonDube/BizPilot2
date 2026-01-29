"""Permissions API endpoints.

Feature: granular-permissions-subscription
Task: 6.1 Implement GET /api/permissions/me endpoint
Requirements: 7.1, 7.2
"""

from fastapi import APIRouter, Depends

from app.api.deps import (
    get_current_active_user,
    get_current_business_id,
    get_permission_service
)
from app.models.user import User
from app.services.permission_service import PermissionService
from app.schemas.subscription import PermissionsResponse

router = APIRouter(prefix="/permissions", tags=["permissions"])


@router.get("/me", response_model=PermissionsResponse)
async def get_my_permissions(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    permission_service: PermissionService = Depends(get_permission_service)
) -> PermissionsResponse:
    """
    Get current user's permissions.
    
    Returns all permissions for the authenticated user's business, including:
    - granted_features: List of feature names the business has access to
    - tier: Current subscription tier name
    - status: Subscription status (active, suspended, cancelled, expired, demo)
    - demo_expires_at: Demo expiry date (null if not in demo mode)
    - device_limit: Maximum number of devices allowed
    
    This endpoint is used by:
    - Frontend usePermissions hook to determine feature availability
    - FeatureGate component to conditionally render UI
    - Mobile clients to cache permissions for offline access
    
    Returns:
        PermissionsResponse with all permission data
    
    Validates: Requirements 7.1, 7.2
    
    Example Response:
        {
            "granted_features": ["has_payroll", "has_ai", "has_api_access"],
            "tier": "pilot_pro",
            "status": "active",
            "demo_expires_at": null,
            "device_limit": 5
        }
    """
    # Get business permissions from PermissionService
    permissions = await permission_service.get_business_permissions(business_id)
    
    # Return as PermissionsResponse schema
    return PermissionsResponse(**permissions)
