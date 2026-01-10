"""Authentication API endpoints."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session

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
from app.api.deps import get_current_active_user
from app.models.user import User

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
@limiter.limit(REGISTER_RATE_LIMIT)
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
    
    # Generate email verification token (would send email in production)
    # Token is created for future email sending - stored or sent in production
    _ = create_email_verification_token(user.email)
    # TODO: Send verification email
    
    return UserResponse(
        id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        is_email_verified=user.is_email_verified,
        status=user.status.value,
    )


@router.post("/login", response_model=Token)
@limiter.limit(AUTH_RATE_LIMIT)
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
@limiter.limit(PASSWORD_RESET_RATE_LIMIT)
async def forgot_password(request: Request, data: PasswordReset, db: Session = Depends(get_db)):
    """Request password reset email."""
    auth_service = AuthService(db)
    user = auth_service.get_user_by_email(data.email)
    
    if user:
        # Generate reset token (would send email in production)
        # Token is created for future email sending - stored or sent in production
        _ = create_password_reset_token(data.email)
        # TODO: Send password reset email
    
    # Always return success to prevent email enumeration
    return {"message": "If the email exists, a password reset link has been sent"}


@router.post("/reset-password")
@limiter.limit(PASSWORD_RESET_RATE_LIMIT)
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
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        phone=current_user.phone,
        avatar_url=current_user.avatar_url,
        is_email_verified=current_user.is_email_verified,
        status=current_user.status.value,
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
