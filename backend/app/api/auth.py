"""Authentication API endpoints."""

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel as PydanticBaseModel

from app.core.database import get_db
from app.core.config import settings
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
from app.core.rate_limit import (
    limiter,
    AUTH_RATE_LIMIT,
    REGISTER_RATE_LIMIT,
    PASSWORD_RESET_RATE_LIMIT,
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
    # Access token cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE or settings.is_production,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
        domain=settings.COOKIE_DOMAIN or None,
    )
    
    # Refresh token cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE or settings.is_production,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/",
        domain=settings.COOKIE_DOMAIN or None,
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


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
# @limiter.limit(REGISTER_RATE_LIMIT)  # Temporarily disabled for debugging
async def register(request: Request, user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user."""
    auth_service = AuthService(db)
    
    # Check if user already exists
    existing_user = auth_service.get_user_by_email(user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    
    # Create user
    user = auth_service.create_user(user_data)
    
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
            email_service.send_email(
                to_email=user.email,
                subject="Verify Your BizPilot Email",
                body_text=email_body,
            )
            logger.info(f"Verification email sent to {user.email}")
        except Exception as e:
            logger.error(f"Failed to send verification email to {user.email}: {str(e)}")
    else:
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


@router.get("/test-auth-components")
async def test_auth_components():
    """Test individual authentication components to isolate the issue."""
    try:
        # Test 1: Basic imports
        from app.core.security import get_password_hash, verify_password
        from app.core.security import create_access_token
        
        # Test 2: Password hashing
        test_password = "test123"
        hashed = get_password_hash(test_password)
        verified = verify_password(test_password, hashed)
        
        # Test 3: JWT token creation
        test_token = create_access_token(data={"sub": "test-user"})
        
        return {
            "status": "success",
            "tests": {
                "imports": "ok",
                "password_hash": "ok" if verified else "failed",
                "jwt_creation": "ok" if test_token else "failed",
                "token_length": len(test_token) if test_token else 0
            }
        }
    except Exception as e:
        import traceback
        return {
            "status": "error",
            "error": str(e),
            "traceback": traceback.format_exc()
        }


@router.post("/login", response_model=Token)
# @limiter.limit(AUTH_RATE_LIMIT)  # Temporarily disabled for debugging
async def login(
    request: Request,
    credentials: UserLogin,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Login with email and password.
    
    For web clients: Sets HttpOnly cookies and returns tokens in body.
    For mobile clients: Only returns tokens in body.
    
    Mobile clients should send X-Client-Type: mobile header.
    """
    auth_service = AuthService(db)
    
    user = auth_service.authenticate_user(credentials.email, credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
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
    db: Session = Depends(get_db),
):
    """
    Refresh access token using refresh token.
    
    For web clients: Reads refresh token from cookie.
    For mobile clients: Reads refresh token from request body.
    """
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
    auth_service = AuthService(db)
    user = auth_service.get_user_by_id(user_id)
    
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
async def verify_email(data: EmailVerification, db: Session = Depends(get_db)):
    """Verify email address with token."""
    email = verify_email_token(data.token)
    
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token",
        )
    
    auth_service = AuthService(db)
    if not auth_service.verify_email(email):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    return {"message": "Email verified successfully"}


@router.post("/forgot-password")
# @limiter.limit(PASSWORD_RESET_RATE_LIMIT)  # Temporarily disabled for debugging
async def forgot_password(request: Request, data: PasswordReset, db: Session = Depends(get_db)):
    """Request password reset email."""
    auth_service = AuthService(db)
    user = auth_service.get_user_by_email(data.email)
    
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
                email_service.send_email(
                    to_email=data.email,
                    subject="Reset Your BizPilot Password",
                    body_text=email_body,
                )
                logger.info(f"Password reset email sent to {data.email}")
            except Exception as e:
                # Log error but don't expose to user (security)
                logger.error(f"Failed to send password reset email to {data.email}: {str(e)}")
        else:
            # In development, log the reset URL for testing
            logger.info(f"[DEV] Password reset URL for {data.email}: {reset_url}")
    
    # Always return success to prevent email enumeration
    return {"message": "If the email exists, a password reset link has been sent"}


@router.post("/reset-password")
# @limiter.limit(PASSWORD_RESET_RATE_LIMIT)  # Temporarily disabled for debugging
async def reset_password(request: Request, data: PasswordResetConfirm, db: Session = Depends(get_db)):
    """Reset password with token."""
    email = verify_password_reset_token(data.token)
    
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )
    
    auth_service = AuthService(db)
    if not auth_service.reset_password(email, data.new_password):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    return {"message": "Password reset successfully"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: User = Depends(get_current_active_user)):
    """Get current user profile."""
    # Get current tier name if available
    current_tier_name = None
    if current_user.current_tier:
        current_tier_name = current_user.current_tier.name
    
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
    db: Session = Depends(get_db),
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
    auth_service.update_password(current_user, data.new_password)
    
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
    db: Session = Depends(get_db),
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
        db.commit()
        
        return {"message": "PIN set up successfully"}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/pin/login", response_model=Token)
# @limiter.limit(AUTH_RATE_LIMIT)  # Temporarily disabled for debugging
async def pin_login(
    request: Request,
    credentials: PINLogin,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Login with email and PIN code (for POS terminals).
    
    This is a quick login method for users who have set up a PIN.
    For web clients: Sets HttpOnly cookies and returns tokens in body.
    For mobile/POS clients: Only returns tokens in body.
    """
    from app.core.security import verify_pin_code
    
    auth_service = AuthService(db)
    user = auth_service.get_user_by_email(credentials.email)
    
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
    db: Session = Depends(get_db),
):
    """Remove the PIN code from the current user's account."""
    current_user.pin_code = None
    current_user.pin_code_hash = None
    db.commit()
    
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


# Import Pydantic BaseModel for schemas
