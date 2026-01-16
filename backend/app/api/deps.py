"""Authentication dependencies for FastAPI."""

from typing import Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User, UserStatus
from app.models.business_user import BusinessUser, BusinessUserStatus
from app.services.auth_service import AuthService

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
    db: Session = Depends(get_db),
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
    user = auth_service.get_user_by_id(user_id)
    
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


def get_optional_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
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
    return auth_service.get_user_by_id(user_id)


async def get_current_business_id(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> str:
    """Get the current user's active business ID."""
    # Superadmins can access all businesses - return the first available business
    if current_user.is_superadmin:
        from app.models.business import Business
        first_business = db.query(Business).filter(
            Business.deleted_at.is_(None)
        ).first()
        
        if not first_business:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No businesses found in the system."
            )
        
        return str(first_business.id)
    
    # Regular users need an active BusinessUser record
    business_user = db.query(BusinessUser).filter(
        BusinessUser.user_id == current_user.id,
        BusinessUser.status == BusinessUserStatus.ACTIVE
    ).first()
    
    if not business_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No business found for user. Please create or join a business first."
        )
    
    return str(business_user.business_id)
