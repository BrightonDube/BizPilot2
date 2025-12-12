"""Google OAuth2 authentication."""

from typing import Optional
from pydantic import BaseModel


class GoogleUserInfo(BaseModel):
    """Schema for Google user info from OAuth."""
    
    id: str
    email: str
    verified_email: bool
    name: str
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    picture: Optional[str] = None


class GoogleOAuthToken(BaseModel):
    """Schema for Google OAuth token from frontend."""
    
    credential: str  # The ID token from Google Sign-In


class GoogleAuthResponse(BaseModel):
    """Response schema for Google OAuth."""
    
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    is_new_user: bool
    user_id: str
