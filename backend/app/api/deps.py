"""Authentication dependencies for FastAPI."""

import inspect
from typing import Optional, Literal
from fastapi import Depends, HTTPException, status, Request, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from redis.asyncio import Redis

from app.core.database import get_db
from app.core.redis import get_redis
from app.core.security import decode_token
from app.models.user import User, UserStatus
from app.models.business_user import BusinessUser, BusinessUserStatus
from app.services.auth_service import AuthService
from app.services.permission_service import PermissionService
from app.services.device_service import DeviceService

# HTTP Bearer token security (auto_error=False to allow cookie fallback)
security = HTTPBearer(auto_error=False)


def extract_token_from_request(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = None,
) -> Optional[str]:
    """
    Extract JWT token from request.
    Priority: 1. Bearer token, 2. Cookie
    """
    # First, try Bearer token from Authorization header
    if credentials and credentials.credentials:
        return credentials.credentials
    
    # Fallback to cookie for web clients
    access_token = request.cookies.get("access_token")
    if access_token:
        return access_token
    
    return None


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db=Depends(get_db),
) -> User:
    """
    Get the current authenticated user from JWT token.
    
    Supports both:
    - Bearer token (Authorization header) for mobile clients
    - HttpOnly cookie for web clients
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token = extract_token_from_request(request, credentials)
    
    if not token:
        raise credentials_exception
    
    payload = decode_token(token)
    
    if payload is None:
        raise credentials_exception
    
    if payload.get("type") != "access":
        raise credentials_exception
    
    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    
    auth_service = AuthService(db)
    user = await auth_service.get_user_by_id(user_id)
    
    if user is None:
        raise credentials_exception
    
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get the current active user."""
    if current_user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is not active",
        )
    return current_user


async def get_current_user_for_onboarding(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Get the current user for onboarding endpoints.
    Allows PENDING and ACTIVE users (for business setup flow).
    Only blocks INACTIVE and SUSPENDED users.
    """
    if current_user.status in (UserStatus.INACTIVE, UserStatus.SUSPENDED):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is suspended or inactive",
        )
    return current_user


async def get_current_verified_user(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """Get the current user with verified email."""
    if not current_user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified",
        )
    return current_user


async def get_optional_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db=Depends(get_db),
) -> Optional[User]:
    """Get the current user if authenticated, otherwise None."""
    token = extract_token_from_request(request, credentials)
    
    if not token:
        return None
    
    payload = decode_token(token)
    
    if payload is None or payload.get("type") != "access":
        return None
    
    user_id: str = payload.get("sub")
    if user_id is None:
        return None
    
    auth_service = AuthService(db)
    return await auth_service.get_user_by_id(user_id)


async def get_current_business_id(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_db),
) -> str:
    """
    Get the current user's active business ID.
    
    Superadmins can specify a business via X-Business-ID header to target
    specific businesses. If not provided, defaults to the oldest business.
    """
    from app.models.business import Business
    from sqlalchemy import select
    
    # Superadmins can access all businesses
    if current_user.is_superadmin:
        # Check for X-Business-ID header to allow targeting specific business
        requested_business_id = request.headers.get("X-Business-ID")
        
        if requested_business_id:
            # Validate the requested business exists
            stmt = select(Business).filter(
                Business.id == requested_business_id,
                Business.deleted_at.is_(None)
            )
            result = db.execute(stmt)
            if inspect.isawaitable(result):
                result = await result
            business = result.scalars().first()
            
            if not business:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Business with ID {requested_business_id} not found."
                )
            
            return str(business.id)
        
        # Default: return the oldest available business
        stmt = select(Business).filter(
            Business.deleted_at.is_(None)
        ).order_by(Business.created_at.asc())
        result = db.execute(stmt)
        if inspect.isawaitable(result):
            result = await result
        first_business = result.scalars().first()
        
        if not first_business:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No businesses found in the system."
            )
        
        return str(first_business.id)
    
    # Regular users need an active BusinessUser record
    stmt = select(BusinessUser).filter(
        BusinessUser.user_id == current_user.id,
        BusinessUser.status == BusinessUserStatus.ACTIVE
    )
    result = db.execute(stmt)
    if inspect.isawaitable(result):
        result = await result
    business_user = result.scalars().first()
    
    if not business_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No business found for user. Please create or join a business first."
        )
    
    return str(business_user.business_id)


async def get_permission_service(
    db=Depends(get_db),
    redis: Optional[Redis] = Depends(get_redis)
) -> PermissionService:
    """
    FastAPI dependency to get PermissionService instance.
    
    Provides a configured PermissionService with database and Redis connections.
    Redis is optional - if unavailable, service falls back to direct database queries.
    
    Usage:
        @router.get("/endpoint")
        async def endpoint(
            permission_service: PermissionService = Depends(get_permission_service)
        ):
            has_access = await permission_service.check_feature(...)
    
    Args:
        db: Async database session
        redis: Optional Redis client for caching
    
    Returns:
        Configured PermissionService instance
    
    Validates: Requirement 20.1
    """
    return PermissionService(db, redis)


# Type alias for feature names
FeatureType = Literal["payroll", "ai", "api_access", "advanced_reporting"]


def check_feature(feature_name: str):
    """
    FastAPI dependency factory to check if current user's business has access to a feature.
    
    Returns a dependency function that:
    1. Bypasses check if user is SuperAdmin (Requirement 20.4)
    2. Uses PermissionService to check feature access
    3. Raises HTTPException 403 with clear error message if denied (Requirement 20.5)
    
    Usage:
        @router.get("/payroll/reports", dependencies=[Depends(check_feature("has_payroll"))])
        async def get_payroll_reports(
            current_user: User = Depends(get_current_active_user),
            db=Depends(get_db)
        ):
            # Endpoint logic here - access already verified
    
    Args:
        feature_name: Feature name to check (e.g., "has_payroll", "has_ai")
    
    Returns:
        Dependency function that raises HTTPException 403 if feature not available
    
    Validates: Requirements 20.1, 20.4, 20.5
    """
    async def _check_feature(
        current_user: User = Depends(get_current_active_user),
        business_id: str = Depends(get_current_business_id),
        permission_service: PermissionService = Depends(get_permission_service)
    ) -> User:
        """Check if business has access to the specified feature."""
        # SuperAdmin bypass - Requirement 20.4
        if current_user.is_superadmin:
            return current_user
        
        # Check feature access
        has_access = await permission_service.check_feature(
            business_id=business_id,
            feature_name=feature_name,
            is_superadmin=False
        )
        
        if not has_access:
            # Requirement 20.5 - clear error message
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Feature '{feature_name}' not available in your subscription. Upgrade to access this feature."
            )
        
        return current_user
    
    return _check_feature


async def check_device_limit(
    device_id: Optional[str] = Header(None, alias="X-Device-ID"),
    device_name: Optional[str] = Header(None, alias="X-Device-Name"),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_db),
    permission_service: PermissionService = Depends(get_permission_service)
) -> dict:
    """
    FastAPI dependency to check device limits before allowing sync operations.
    
    Validates device registration and enforces device limits based on subscription.
    SuperAdmins bypass device limit checks.
    
    Usage:
        @router.post("/sync", dependencies=[Depends(check_device_limit)])
        async def sync_data(
            device: dict = Depends(check_device_limit),
            current_user: User = Depends(get_current_active_user),
            db=Depends(get_db)
        ):
            # Sync logic here - device already validated
    
    Args:
        device_id: Device ID from X-Device-ID header
        device_name: Device name from X-Device-Name header
        current_user: Current authenticated user
        business_id: Current business ID
        db: Async database session
        permission_service: Permission service instance
    
    Returns:
        Device record as dictionary
    
    Raises:
        HTTPException 403 if device limit exceeded (Requirement 20.5)
        HTTPException 400 if device headers missing
    
    Validates: Requirements 20.2, 20.3, 20.5
    """
    # SuperAdmin bypass - Requirement 20.4
    if current_user.is_superadmin:
        return {
            'device_id': device_id or 'superadmin-device',
            'device_name': device_name or 'SuperAdmin Device',
            'is_superadmin': True
        }
    
    # Validate device headers
    if not device_id or not device_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Device ID and Device Name headers are required (X-Device-ID, X-Device-Name)"
        )
    
    device_service = DeviceService(db)
    
    try:
        # Get business permissions to check device limit
        permissions = await permission_service.get_business_permissions(business_id)
        max_devices = permissions.get("device_limit", 1)
        
        # Check device limit - Requirement 20.2
        can_register = await device_service.check_device_limit(
            business_id=business_id,
            device_id=device_id
        )
        
        if not can_register:
            active_count = await device_service.get_active_device_count(business_id)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Device limit reached ({active_count}/{max_devices} devices). Contact support to increase your limit."
            )
        
        # Register/update device
        device = await device_service.register_device(
            business_id=business_id,
            device_id=device_id,
            device_name=device_name,
            user_id=str(current_user.id)
        )
        
        # Return device as dict
        return {
            'device_id': device.device_id,
            'device_name': device.device_name,
            'is_active': device.is_active,
            'last_sync_time': device.last_sync_time.isoformat() if device.last_sync_time else None,
            'is_superadmin': False
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Device registration failed: {str(e)}"
        )


async def require_superadmin(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    FastAPI dependency to require SuperAdmin access.
    
    Verifies that the current user has SuperAdmin privileges.
    Used to protect administrative endpoints.
    
    Usage:
        @router.post("/admin/subscriptions", dependencies=[Depends(require_superadmin)])
        async def create_subscription(
            current_user: User = Depends(require_superadmin),
            db=Depends(get_db)
        ):
            # Admin endpoint logic here - SuperAdmin access verified
    
    Args:
        current_user: Current authenticated user
    
    Returns:
        Current user if SuperAdmin
    
    Raises:
        HTTPException 403 if not SuperAdmin (Requirement 20.5)
    
    Validates: Requirements 20.3, 20.5
    """
    if not current_user.is_superadmin:
        # Requirement 20.5 - clear error message
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SuperAdmin access required"
        )
    return current_user
