"""Google OAuth service for authentication."""

import httpx
from typing import Optional
from google.oauth2 import id_token
from google.auth.transport import requests

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User, UserStatus
from app.schemas.oauth import GoogleUserInfo


class GoogleOAuthService:
    """Service for Google OAuth operations."""
    
    GOOGLE_TOKEN_INFO_URL = "https://oauth2.googleapis.com/tokeninfo"
    GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
    GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

    def __init__(self, db: Session):
        self.db = db

    async def exchange_code_for_tokens(self, code: str) -> Optional[dict]:
        """Exchange an authorization code for tokens."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.GOOGLE_TOKEN_URL,
                    data={
                        "code": code,
                        "client_id": settings.GOOGLE_CLIENT_ID,
                        "client_secret": settings.GOOGLE_CLIENT_SECRET,
                        "redirect_uri": "postmessage",  # For popup flow
                        "grant_type": "authorization_code",
                    },
                )
                if response.status_code == 200:
                    return response.json()
                return None
        except Exception:
            return None

    async def get_user_info_from_access_token(self, access_token: str) -> Optional[GoogleUserInfo]:
        """Get user info using an access token."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    self.GOOGLE_USERINFO_URL,
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                if response.status_code == 200:
                    data = response.json()
                    return GoogleUserInfo(
                        id=data["id"],
                        email=data["email"],
                        verified_email=data.get("verified_email", False),
                        name=data.get("name", ""),
                        given_name=data.get("given_name"),
                        family_name=data.get("family_name"),
                        picture=data.get("picture"),
                    )
                return None
        except Exception:
            return None

    async def verify_google_token(self, token: str) -> Optional[GoogleUserInfo]:
        """Verify a Google ID token and return user info."""
        try:
            # Verify the token with Google
            idinfo = id_token.verify_oauth2_token(
                token,
                requests.Request(),
                settings.GOOGLE_CLIENT_ID,
            )
            
            if idinfo["iss"] not in ["accounts.google.com", "https://accounts.google.com"]:
                return None
            
            return GoogleUserInfo(
                id=idinfo["sub"],
                email=idinfo["email"],
                verified_email=idinfo.get("email_verified", False),
                name=idinfo.get("name", ""),
                given_name=idinfo.get("given_name"),
                family_name=idinfo.get("family_name"),
                picture=idinfo.get("picture"),
            )
        except ValueError:
            # Invalid token
            return None

    def get_user_by_google_id(self, google_id: str) -> Optional[User]:
        """Get a user by their Google ID."""
        return self.db.query(User).filter(User.google_id == google_id).first()

    def get_user_by_email(self, email: str) -> Optional[User]:
        """Get a user by email."""
        return self.db.query(User).filter(User.email == email).first()

    def create_user_from_google(self, google_info: GoogleUserInfo) -> User:
        """Create a new user from Google OAuth info."""
        user = User(
            email=google_info.email,
            google_id=google_info.id,
            first_name=google_info.given_name or google_info.name.split()[0] if google_info.name else "User",
            last_name=google_info.family_name or (google_info.name.split()[-1] if google_info.name and len(google_info.name.split()) > 1 else ""),
            avatar_url=google_info.picture,
            is_email_verified=google_info.verified_email,
            status=UserStatus.ACTIVE if google_info.verified_email else UserStatus.PENDING,
        )
        
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def link_google_account(self, user: User, google_info: GoogleUserInfo) -> User:
        """Link a Google account to an existing user."""
        user.google_id = google_info.id
        if google_info.picture and not user.avatar_url:
            user.avatar_url = google_info.picture
        if google_info.verified_email and not user.is_email_verified:
            user.is_email_verified = True
            user.status = UserStatus.ACTIVE
        
        self.db.commit()
        self.db.refresh(user)
        return user

    async def authenticate_with_google(self, credential: str) -> tuple[Optional[User], bool]:
        """
        Authenticate a user with Google OAuth.
        
        Supports both:
        - Authorization code (from OAuth2 code flow)
        - ID token (from Google Sign-In)
        
        Returns:
            Tuple of (user, is_new_user) or (None, False) if authentication fails.
        """
        google_info = None
        
        # Try to handle as authorization code first (starts with "4/" typically)
        if credential.startswith("4/") or len(credential) < 500:
            # This looks like an authorization code, exchange it for tokens
            tokens = await self.exchange_code_for_tokens(credential)
            if tokens and "access_token" in tokens:
                google_info = await self.get_user_info_from_access_token(tokens["access_token"])
        
        # If not a code or code exchange failed, try as ID token
        if not google_info:
            google_info = await self.verify_google_token(credential)
        
        if not google_info:
            return None, False
        
        # Check if user exists by Google ID
        user = self.get_user_by_google_id(google_info.id)
        if user:
            return user, False
        
        # Check if user exists by email
        user = self.get_user_by_email(google_info.email)
        if user:
            # Link Google account to existing user
            user = self.link_google_account(user, google_info)
            return user, False
        
        # Create new user
        user = self.create_user_from_google(google_info)
        return user, True
