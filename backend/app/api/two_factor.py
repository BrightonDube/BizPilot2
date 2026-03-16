from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import List

from app.core.database import get_db
from app.api.deps import get_current_active_user, get_current_business_id
from app.models.user import User
from app.services import two_factor_service

router = APIRouter(prefix="/2fa", tags=["Two-Factor Authentication"])

class TOTPSetupResponse(BaseModel):
    secret: str
    qr_code_data_url: str
    backup_codes: List[str]

class TOTPVerifyRequest(BaseModel):
    code: str

@router.post("/setup", response_model=TOTPSetupResponse)
async def setup_totp(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate TOTP secret and QR code for authenticator app enrollment.
    """
    return await two_factor_service.generate_totp_setup(current_user.id, business_id, db)

@router.post("/enable")
async def enable_totp(
    request: TOTPVerifyRequest,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Verify a TOTP code and enable 2FA if valid.
    """
    success = await two_factor_service.verify_and_enable_totp(
        current_user.id, request.code, business_id, db
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid TOTP code"
        )
    return {"message": "2FA enabled successfully"}

@router.post("/disable")
async def disable_totp(
    request: TOTPVerifyRequest,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Disable TOTP 2FA after verifying current code.
    """
    success = await two_factor_service.disable_totp(
        current_user.id, request.code, business_id, db
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid TOTP code"
        )
    return {"message": "2FA disabled successfully"}

@router.get("/status")
async def get_totp_status(
    current_user: User = Depends(get_current_active_user)
):
    """
    Check if TOTP 2FA is enabled for the current user.
    """
    return {
        "enabled": current_user.totp_enabled,
        "enrolled_at": current_user.totp_enrolled_at
    }
