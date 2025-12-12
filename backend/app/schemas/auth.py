"""Authentication schemas for request/response validation."""

from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    """Schema for user registration."""
    
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)


class UserLogin(BaseModel):
    """Schema for user login."""
    
    email: EmailStr
    password: str


class Token(BaseModel):
    """Schema for JWT token response."""
    
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefresh(BaseModel):
    """Schema for token refresh request."""
    
    refresh_token: str


class PasswordReset(BaseModel):
    """Schema for password reset request."""
    
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """Schema for password reset confirmation."""
    
    token: str
    new_password: str = Field(..., min_length=8, max_length=100)


class EmailVerification(BaseModel):
    """Schema for email verification."""
    
    token: str


class UserResponse(BaseModel):
    """Schema for user response."""
    
    model_config = {"from_attributes": True}
    
    id: str
    email: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    is_email_verified: bool
    status: str


class PasswordChange(BaseModel):
    """Schema for password change."""
    
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=100)
