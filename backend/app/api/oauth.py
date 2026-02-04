"""Google OAuth API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status, Request, Response

from app.core.database import get_sync_db
from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token
from app.core.rate_limit import limiter, AUTH_RATE_LIMIT
from app.schemas.oauth import GoogleOAuthToken, GoogleAuthResponse
from app.services.google_oauth_service import GoogleOAuthService

router = APIRouter(prefix="/oauth", tags=["OAuth"])


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


@router.post("/google", response_model=GoogleAuthResponse)
@limiter.limit(AUTH_RATE_LIMIT)
async def google_oauth(
    request: Request,
    token_data: GoogleOAuthToken,
    response: Response,
    db=Depends(get_sync_db),
):
    """
    Authenticate with Google OAuth.
    
    Accepts a Google ID token (credential) from the frontend Google Sign-In.
    Returns JWT tokens for the authenticated user.
    
    For web clients: Sets HttpOnly cookies and returns tokens in body.
    For mobile clients: Only returns tokens in body.
    """
    oauth_service = GoogleOAuthService(db)
    
    user, is_new_user = await oauth_service.authenticate_with_google(token_data.credential)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google credentials",
        )
    
    # Create JWT tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    # For web clients, set HttpOnly cookies
    if not is_mobile_client(request):
        set_auth_cookies(response, access_token, refresh_token)
    
    return GoogleAuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        is_new_user=is_new_user,
        user_id=str(user.id),
    )


@router.get("/google/url")
async def get_google_oauth_url():
    """
    Get the Google OAuth URL for initiating the OAuth flow.
    
    This is mainly for documentation purposes as the frontend
    typically handles the Google Sign-In button directly.
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth not configured",
        )
    
    return {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "message": "Use Google Sign-In button on frontend with this client_id",
    }
