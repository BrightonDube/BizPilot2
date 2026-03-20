import pyotp
import qrcode
import qrcode.image.svg
import io
import base64
import logging
import secrets
from datetime import datetime
from uuid import UUID
from cryptography.fernet import Fernet

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException

from app.models.user import User
from app.core.config import settings
from app.core.security import get_password_hash, verify_password

logger = logging.getLogger(__name__)

# Derive an encryption key from SECRET_KEY
# Fernet key must be 32 url-safe base64-encoded bytes
def _get_fernet() -> Fernet:
    # Use first 32 chars of SECRET_KEY and base64 encode
    key = base64.urlsafe_b64encode(settings.SECRET_KEY[:32].encode().ljust(32, b'0'))
    return Fernet(key)

def encrypt_secret(secret: str) -> str:
    f = _get_fernet()
    return f.encrypt(secret.encode()).decode()

def decrypt_secret(encrypted_secret: str) -> str:
    f = _get_fernet()
    return f.decrypt(encrypted_secret.encode()).decode()

async def generate_totp_setup(user_id: UUID, business_id: UUID, db: AsyncSession) -> dict:
    """
    Generate TOTP secret and QR code for authenticator app enrollment.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Generate a random secret
    secret = pyotp.random_base32()
    
    # Create provision URI for QR code
    totp = pyotp.TOTP(secret)
    provision_uri = totp.provisioning_uri(
        name=user.email,
        issuer_name="BizPilot Pro"
    )
    
    # Generate QR code data URL
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(provision_uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    qr_code_base64 = base64.b64encode(buffered.getvalue()).decode()
    qr_code_data_url = f"data:image/png;base64,{qr_code_base64}"
    
    # Generate backup codes
    backup_codes = [secrets.token_hex(4).upper() for _ in range(10)]
    hashed_backup_codes = [get_password_hash(code) for code in backup_codes]
    
    # Store encrypted secret and backup codes temporarily
    # but don't enable 2FA yet
    user.totp_secret = encrypt_secret(secret)
    user.totp_backup_codes = hashed_backup_codes
    await db.commit()
    
    return {
        "secret": secret,
        "qr_code_data_url": qr_code_data_url,
        "backup_codes": backup_codes
    }

async def verify_and_enable_totp(user_id: UUID, totp_code: str, business_id: UUID, db: AsyncSession) -> bool:
    """
    Verify a TOTP code and enable 2FA if valid.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user or not user.totp_secret:
        return False
    
    secret = decrypt_secret(user.totp_secret)
    totp = pyotp.TOTP(secret)
    
    if totp.verify(totp_code):
        user.totp_enabled = True
        user.totp_enrolled_at = datetime.now()
        await db.commit()
        return True
    
    return False

async def validate_totp_code(user_id: UUID, totp_code: str, db: AsyncSession) -> bool:
    """
    Validate a TOTP code during login.
    Also accepts backup codes.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user or not user.totp_enabled:
        return True # Not enabled, so it's "valid" in the sense of login flow
    
    # Try TOTP code
    if user.totp_secret:
        secret = decrypt_secret(user.totp_secret)
        totp = pyotp.TOTP(secret)
        if totp.verify(totp_code, valid_window=1): # 30s window with 1 period tolerance
            return True
            
    # Try backup codes
    if user.totp_backup_codes:
        new_backup_codes = []
        found = False
        for hashed_code in user.totp_backup_codes:
            if not found and verify_password(totp_code.upper(), hashed_code):
                found = True
                continue # Mark as used by not adding to new list
            new_backup_codes.append(hashed_code)
            
        if found:
            user.totp_backup_codes = new_backup_codes
            await db.commit()
            return True
            
    return False

async def disable_totp(user_id: UUID, totp_code: str, business_id: UUID, db: AsyncSession) -> bool:
    """
    Disable TOTP 2FA after verifying current code.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user or not user.totp_enabled:
        return False
        
    # Must verify code before disabling
    if await validate_totp_code(user_id, totp_code, db):
        user.totp_enabled = False
        user.totp_secret = None
        user.totp_backup_codes = None
        await db.commit()
        return True
        
    return False
