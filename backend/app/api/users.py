"""Users API endpoints for user profile management."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.user_settings import AIDataSharingLevel
from app.services.ai_service import AIService

router = APIRouter(prefix="/users", tags=["Users"])


class UserUpdateMe(BaseModel):
    """Schema for updating current user's profile."""
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    avatar_url: Optional[str] = Field(None, max_length=500)


class UserResponseMe(BaseModel):
    """Schema for user profile response."""
    id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    status: str
    
    model_config = {"from_attributes": True}


class UserSettingsResponse(BaseModel):
    """Schema for user settings response."""

    ai_data_sharing_level: str


class UserSettingsUpdate(BaseModel):
    """Schema for updating user settings."""

    ai_data_sharing_level: AIDataSharingLevel


@router.get("/me", response_model=UserResponseMe)
async def get_current_user_profile(
    current_user: User = Depends(get_current_active_user),
):
    """Get the current user's profile."""
    return UserResponseMe(
        id=str(current_user.id),
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        phone=current_user.phone,
        avatar_url=current_user.avatar_url,
        status=current_user.status.value,
    )


@router.put("/me", response_model=UserResponseMe)
async def update_current_user_profile(
    user_data: UserUpdateMe,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Update the current user's profile."""
    try:
        # Update only provided fields
        update_data = user_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(current_user, field, value)
        
        db.commit()
        db.refresh(current_user)
        
        return UserResponseMe(
            id=str(current_user.id),
            email=current_user.email,
            first_name=current_user.first_name,
            last_name=current_user.last_name,
            phone=current_user.phone,
            avatar_url=current_user.avatar_url,
            status=current_user.status.value,
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update user profile: {str(e)}"
        )


@router.get("/me/settings", response_model=UserSettingsResponse)
async def get_current_user_settings(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get the current user's settings (including AI privacy controls)."""
    svc = AIService(db)
    settings_row = svc.get_or_create_user_settings(current_user.id)
    return UserSettingsResponse(ai_data_sharing_level=settings_row.ai_data_sharing_level.value)


@router.put("/me/settings", response_model=UserSettingsResponse)
async def update_current_user_settings(
    payload: UserSettingsUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Update the current user's settings (including AI privacy controls)."""
    svc = AIService(db)
    settings_row = svc.update_user_settings(current_user.id, payload.ai_data_sharing_level)
    return UserSettingsResponse(ai_data_sharing_level=settings_row.ai_data_sharing_level.value)
