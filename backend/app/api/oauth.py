"""Google OAuth API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token, create_refresh_token
from app.schemas.oauth import GoogleOAuthToken, GoogleAuthResponse
from app.services.google_oauth_service import GoogleOAuthService

router = APIRouter(prefix="/oauth", tags=["OAuth"])


@router.post("/google", response_model=GoogleAuthResponse)
async def google_oauth(
    token_data: GoogleOAuthToken,
    db: Session = Depends(get_db),
):
    """
    Authenticate with Google OAuth.
    
    Accepts a Google ID token (credential) from the frontend Google Sign-In.
    Returns JWT tokens for the authenticated user.
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
    from app.core.config import settings
    
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth not configured",
        )
    
    return {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "message": "Use Google Sign-In button on frontend with this client_id",
    }
