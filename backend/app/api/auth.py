"""Authentication API endpoints."""

import logging
import asyncio # CHANGED: Added for non-blocking email operations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from pydantic import BaseModel as PydanticBaseModel

from app.core.database import get_db
from app.core.config import settings
from app.core.rate_limit import limiter, AUTH_RATE_LIMIT, REGISTER_RATE_LIMIT, PASSWORD_RESET_RATE_LIMIT
from app.core.security import (
    create_access_token,
    create_refresh_token,
    create_email_verification_token,
    create_password_reset_token,
    verify_email_token,
    verify_password_reset_token,
    decode_token,
    verify_password,
)
from app.schemas.auth import (
    UserCreate,
    UserLogin,
    Token,
    TokenRefresh,
    PasswordReset,
    PasswordResetConfirm,
    EmailVerification,
    UserResponse,
    PasswordChange,
)
from app.services.auth_service import AuthService
from app.services.email_service import EmailService
from app.api.deps import get_current_active_user
from app.middleware.rate_limiting import rate_limit_auth_endpoint
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def is_mobile_client(request: Request) -> bool:
    """
    Determine if the request is from a mobile client.
    Mobile clients send X-Client-Type: mobile header.
    """
    client_type = request.headers.get("X-Client-Type", "").lower()
    return client_type == "mobile"


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """
    Set HttpOnly cookies for web authentication.
    """
    # CHANGED: Consolidated cookie parameters for better maintainability and consistency.
    cookie_params = {
        "httponly": True,
        "secure": settings.COOKIE_SECURE or settings.is_production,
        "samesite": settings.COOKIE_SAMESITE,
        "path": "/",
        "domain": settings.COOKIE_DOMAIN or None,
    }
    
    # Access token cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        **cookie_params
    )
    
    # Refresh token cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        **cookie_params
    )


def clear_auth_cookies(response: Response) -> None:
    """
    Clear authentication cookies on logout.
    """
    response.delete_cookie(
        key="access_token",
        path="/",
        domain=settings.COOKIE_DOMAIN or None,
    )
    response.delete_cookie(
        key="refresh_token",
        path="/",
        domain=settings.COOKIE_DOMAIN or None,
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(rate_limit_auth_endpoint)])
@limiter.limit(REGISTER_RATE_LIMIT)
async def register(request: Request, user_data: UserCreate, db=Depends(get_db)):
    """Register a new user."""
    auth_service = AuthService(db)
    
    # Check if user already exists
    existing_user = await auth_service.get_user_by_email(user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    
    # Create user
    user = await auth_service.create_user(user_data)
    
    # Generate email verification token
    verification_token = create_email_verification_token(user.email)
    verification_url = f"{settings.FRONTEND_URL}/auth/verify-email?token={verification_token}"
    
    # Send verification email if SMTP is configured
    if settings.EMAILS_ENABLED and settings.SMTP_HOST:
        try:
            email_service = EmailService()
            email_body = f"""Welcome to BizPilot, {user.first_name or 'there'}!

Thank you for registering. Please verify your email address by clicking the link below:
{verification_url}

This link will expire in 24 hours.

If you did not create this account, please ignore this email.

Best regards,
The BizPilot Team
"""
            # CHANGED: Use asyncio.to_thread to prevent blocking the event loop with synchronous SMTP calls (Performance High).
            await asyncio.to_thread(
                email_service.send_email,
                to_email=user.email,
                subject="Verify Your BizPilot Email",
                body_text=email_body,
            )
            logger.info(f"Verification email sent to {user.email}")
        except Exception as e:
            logger.error(f"Failed to send verification email to {user.email}: {str(e)}")
    elif settings.DEBUG:
        # CHANGED: Only log verification URL in DEBUG mode to prevent sensitive data leakage in production logs (Security Medium).
        logger.info(f"[DEV] Email verification URL for {user.email}: {verification_url}")
    
    return UserResponse(
        id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        is_email_verified=user.is_email_verified,
        status=user.status.value,
    )

# CHANGED: Removed insecure debug endpoints 'test-auth-components', 'test-db-query', and 'test-login' which exposed internal state and tracebacks (Security Critical).


@router.post("/login", response_model=Token, dependencies=[Depends(rate_limit_auth_endpoint)])
@limiter.limit(AUTH_RATE_LIMIT)
async def login(
    request: Request,
    credentials: UserLogin,
    response: Response,
    db=Depends(get_db),
):
    """
    Login with email and password.
    
    For web clients: Sets HttpOnly cookies and returns tokens in body.
    For mobile clients: Only returns tokens in body.
    
    Mobile clients should send X-Client-Type: mobile header.
    """
    auth_service = AuthService(db)
    
    user = await auth_service.authenticate_user(credentials.email, credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check 2FA
    if user.totp_enabled:
        if not credentials.two_factor_code:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="2FA_REQUIRED",
            )
        
        from app.services.two_factor_service import validate_totp_code
        if not await validate_totp_code(user.id, credentials.two_factor_code, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid 2FA code",
            )

    # Create tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    # For web clients, set HttpOnly cookies
    if not is_mobile_client(request):
        set_auth_cookies(response, access_token, refresh_token)
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_active_user),
):
    """
    Logout the current user.
    
    For web clients: Clears HttpOnly cookies.
    For mobile clients: Client should discard tokens locally.
    
    Requires authentication to logout.
    """
    # Clear cookies for web clients
    if not is_mobile_client(request):
        clear_auth_cookies(response)
    
    return {"message": "Logged out successfully"}


@router.post("/refresh", response_model=Token)
async def refresh_token(
    request: Request,
    response: Response,
    token_data: Optional[TokenRefresh] = None,
    db=Depends(get_db),
):
    """
    Refresh access token using refresh token.
    
    For web clients: Reads refresh token from cookie.
    For mobile clients: Reads refresh token from request body.
    """
    auth_service = AuthService(db)
    # Get refresh token from cookie or body
    if is_mobile_client(request):
        if not token_data or not token_data.refresh_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token required",
            )
        refresh_token_value = token_data.refresh_token
    else:
        # Web clients use cookies exclusively
        refresh_token_value = request.cookies.get("refresh_token")
        if not refresh_token_value:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token required",
            )
    
    payload = decode_token(refresh_token_value)
    
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    
    user_id = payload.get("sub")
    user = await auth_service.get_user_by_id(user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    
    # Create new tokens (token rotation)
    new_access_token = create_access_token(data={"sub": str(user.id)})
    new_refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    # For web clients, set new cookies
    if not is_mobile_client(request):
        set_auth_cookies(response, new_access_token, new_refresh_token)
    
    return Token(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
    )


@router.post("/verify-email")
async def verify_email(data: EmailVerification, db=Depends(get_db)):
    """Verify email address with token."""
    email = verify_email_token(data.token)
    
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token",
        )
    
    auth_service = AuthService(db)
    if not await auth_service.verify_email(email):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    return {"message": "Email verified successfully"}


@router.post("/forgot-password", dependencies=[Depends(rate_limit_auth_endpoint)])
@limiter.limit(PASSWORD_RESET_RATE_LIMIT)
async def forgot_password(request: Request, data: PasswordReset, db=Depends(get_db)):
    """Request password reset email."""
    auth_service = AuthService(db)
    user = await auth_service.get_user_by_email(data.email)
    
    if user:
        # Generate reset token
        reset_token = create_password_reset_token(data.email)
        
        # Build the reset URL
        reset_url = f"{settings.FRONTEND_URL}/auth/reset-password?token={reset_token}"
        
        # Send password reset email if SMTP is configured
        if settings.EMAILS_ENABLED and settings.SMTP_HOST:
            try:
                email_service = EmailService()
                email_body = f"""Hello {user.first_name or 'there'},

You have requested to reset your password for your BizPilot account.

Click the link below to reset your password:
{reset_url}

This link will expire in 1 hour.

If you did not request this password reset, please ignore this email or contact support if you have concerns.

Best regards,
The BizPilot Team
"""
                # CHANGED: Use asyncio.to_thread to prevent blocking the event loop with synchronous SMTP calls (Performance High).
                await asyncio.to_thread(
                    email_service.send_email,
                    to_email=data.email,
                    subject="Reset Your BizPilot Password",
                    body_text=email_body,
                )
                logger.info(f"Password reset email sent to {data.email}")
            except Exception as e:
                # Log error but don't expose to user (security)
                logger.error(f"Failed to send password reset email to {data.email}: {str(e)}")
        elif settings.DEBUG:
            # CHANGED: Only log reset URL in DEBUG mode to prevent sensitive data leakage in production logs (Security Medium).
            logger.info(f"[DEV] Password reset URL for {data.email}: {reset_url}")
    
    # Always return success to prevent email enumeration
    return {"message": "If the email exists, a password reset link has been sent"}


@router.post("/reset-password", dependencies=[Depends(rate_limit_auth_endpoint)])
@limiter.limit(PASSWORD_RESET_RATE_LIMIT) # CHANGED: Re-enabled rate limiting (Security High).
async def reset_password(request: Request, data: PasswordResetConfirm, db=Depends(get_db)):
    """Reset password with token."""
    email = verify_password_reset_token(data.token)
    
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )
    
    auth_service = AuthService(db)
    if not await auth_service.reset_password(email, data.new_password):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    return {"message": "Password reset successfully"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_db),
    response: Response = None,
):
    """Get current user profile."""
    # Add cache control headers to prevent stale auth responses
    if response:
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    
    # WHY explicit query instead of current_user.current_tier:
    # The User object comes from an async session. Accessing .current_tier
    # triggers SQLAlchemy lazy loading which requires a sync greenlet context.
    # In async FastAPI endpoints this raises MissingGreenlet. We query the
    # tier name explicitly using the async db session instead.
    current_tier_name = None
    if current_user.current_tier_id:
        from app.models.subscription_tier import SubscriptionTier
        from sqlalchemy import select
        result = await db.execute(
            select(SubscriptionTier.name).filter(
                SubscriptionTier.id == current_user.current_tier_id
            )
        )
        current_tier_name = result.scalar_one_or_none()
    
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        phone=current_user.phone,
        avatar_url=current_user.avatar_url,
        is_email_verified=current_user.is_email_verified,
        status=current_user.status.value,
        is_admin=current_user.is_admin,
        is_superadmin=current_user.is_superadmin,
        subscription_status=current_user.subscription_status.value if current_user.subscription_status else None,
        current_tier_id=str(current_user.current_tier_id) if current_user.current_tier_id else None,
        current_tier_name=current_tier_name,
    )


@router.post("/change-password")
async def change_password(
    data: PasswordChange,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_db),
):
    """Change password for authenticated user."""
    if not current_user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change password for OAuth user",
        )
    
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    
    auth_service = AuthService(db)
    await auth_service.update_password(current_user, data.new_password)
    
    return {"message": "Password changed successfully"}


# --- PIN Code Login ---

class PINSetup(PydanticBaseModel):
    """Schema for setting up a PIN code."""
    pin: str


class PINLogin(PydanticBaseModel):
    """Schema for logging in with PIN code."""
    email: str
    pin: str
    device_id: Optional[str] = None


@router.post("/pin/setup")
async def setup_pin(
    data: PINSetup,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_db),
):
    """Set up a PIN code for quick login (requires authentication)."""
    from app.core.security import hash_pin_code
    
    # Validate PIN
    if not data.pin or len(data.pin) < 4 or len(data.pin) > 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PIN must be 4-6 digits"
        )
    
    if not data.pin.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PIN must contain only digits"
        )
    
    # Hash and store PIN
    try:
        hashed_pin = hash_pin_code(data.pin)
        current_user.pin_code_hash = hashed_pin
        # Don't store any part of the PIN in plain text for security
        await db.commit()
        
        return {"message": "PIN set up successfully"}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/pin/login", response_model=Token)
@limiter.limit(AUTH_RATE_LIMIT) # CHANGED: Re-enabled rate limiting (Security High).
async def pin_login(
    request: Request,
    credentials: PINLogin,
    response: Response,
    db=Depends(get_db),
):
    """
    Login with email and PIN code (for POS terminals).
    
    This is a quick login method for users who have set up a PIN.
    For web clients: Sets HttpOnly cookies and returns tokens in body.
    For mobile/POS clients: Only returns tokens in body.
    """
    from app.core.security import verify_pin_code
    from app.middleware.rate_limiting import rate_limit_pin_login
    from app.core.redis import get_redis
    
    # Rate limit PIN login (Requirement 065)
    redis = await get_redis()
    await rate_limit_pin_login(credentials.email, redis)
    
    auth_service = AuthService(db)
    user = await auth_service.get_user_by_email(credentials.email)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or PIN",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if user has a PIN set up
    if not user.pin_code_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PIN login not set up. Please use password login.",
        )
    
    # Verify PIN
    if not verify_pin_code(credentials.pin, user.pin_code_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or PIN",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    # For web clients, set HttpOnly cookies
    if not is_mobile_client(request):
        set_auth_cookies(response, access_token, refresh_token)
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.delete("/pin")
async def remove_pin(
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_db),
):
    """Remove the PIN code from the current user's account."""
    # CHANGED: Removed reference to non-existent 'pin_code' column; only 'pin_code_hash' is used (Code Quality).
    current_user.pin_code_hash = None
    await db.commit()
    
    return {"message": "PIN removed successfully"}


@router.get("/pin/status")
async def get_pin_status(
    current_user: User = Depends(get_current_active_user),
):
    """Check if the current user has a PIN set up."""
    return {
        "has_pin": current_user.pin_code_hash is not None,
        "biometric_enabled": current_user.biometric_enabled or False,
    }
