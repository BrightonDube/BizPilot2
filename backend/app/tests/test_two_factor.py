import pytest
import pyotp
from unittest.mock import MagicMock, AsyncMock
from uuid import uuid4
from datetime import datetime

from app.services.two_factor_service import (
    generate_totp_setup,
    verify_and_enable_totp,
    validate_totp_code,
    disable_totp,
    encrypt_secret
)
from app.models.user import User

@pytest.mark.asyncio
async def test_generate_totp_setup_returns_secret_and_qr_code():
    mock_db = AsyncMock()
    user_id = uuid4()
    business_id = uuid4()
    
    user = MagicMock(spec=User)
    user.id = user_id
    user.email = "test@example.com"
    
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = user
    mock_db.execute.return_value = mock_result
    
    setup_data = await generate_totp_setup(user_id, business_id, mock_db)
    
    assert "secret" in setup_data
    assert "qr_code_data_url" in setup_data
    assert "backup_codes" in setup_data
    assert len(setup_data["backup_codes"]) == 10
    assert user.totp_secret is not None
    assert user.totp_backup_codes is not None

@pytest.mark.asyncio
async def test_verify_and_enable_totp_fails_with_invalid_code():
    mock_db = AsyncMock()
    user_id = uuid4()
    business_id = uuid4()
    
    user = MagicMock(spec=User)
    user.totp_secret = encrypt_secret(pyotp.random_base32())
    
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = user
    mock_db.execute.return_value = mock_result
    
    success = await verify_and_enable_totp(user_id, "000000", business_id, mock_db)
    assert success is False
    assert user.totp_enabled is not True

@pytest.mark.asyncio
async def test_verify_and_enable_totp_succeeds_with_valid_code():
    mock_db = AsyncMock()
    user_id = uuid4()
    business_id = uuid4()
    
    secret = pyotp.random_base32()
    user = MagicMock(spec=User)
    user.totp_secret = encrypt_secret(secret)
    user.totp_enabled = False
    
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = user
    mock_db.execute.return_value = mock_result
    
    totp = pyotp.TOTP(secret)
    valid_code = totp.now()
    
    success = await verify_and_enable_totp(user_id, valid_code, business_id, mock_db)
    assert success is True
    assert user.totp_enabled is True
    assert user.totp_enrolled_at is not None

@pytest.mark.asyncio
async def test_validate_totp_code_accepts_backup_code():
    mock_db = AsyncMock()
    user_id = uuid4()
    
    from app.core.security import get_password_hash
    backup_code = "ABCDEFGH"
    hashed_backup_code = get_password_hash(backup_code)
    
    user = MagicMock(spec=User)
    user.totp_enabled = True
    user.totp_secret = None
    user.totp_backup_codes = [hashed_backup_code]
    
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = user
    mock_db.execute.return_value = mock_result
    
    valid = await validate_totp_code(user_id, backup_code, mock_db)
    assert valid is True
    assert len(user.totp_backup_codes) == 0 # Used up

@pytest.mark.asyncio
async def test_backup_code_cannot_be_used_twice():
    mock_db = AsyncMock()
    user_id = uuid4()
    
    from app.core.security import get_password_hash
    backup_code = "ABCDEFGH"
    hashed_backup_code = get_password_hash(backup_code)
    
    user = MagicMock(spec=User)
    user.totp_enabled = True
    user.totp_secret = None
    user.totp_backup_codes = [hashed_backup_code]
    
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = user
    mock_db.execute.return_value = mock_result
    
    # First time
    valid = await validate_totp_code(user_id, backup_code, mock_db)
    assert valid is True
    
    # Second time (backup_codes is now empty in user object)
    valid = await validate_totp_code(user_id, backup_code, mock_db)
    assert valid is False

@pytest.mark.asyncio
async def test_disable_totp_requires_valid_current_code():
    mock_db = AsyncMock()
    user_id = uuid4()
    business_id = uuid4()
    
    secret = pyotp.random_base32()
    user = MagicMock(spec=User)
    user.id = user_id
    user.totp_secret = encrypt_secret(secret)
    user.totp_enabled = True
    
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = user
    mock_db.execute.return_value = mock_result
    
    # Try with invalid code
    success = await disable_totp(user_id, "000000", business_id, mock_db)
    assert success is False
    assert user.totp_enabled is True
    
    # Try with valid code
    totp = pyotp.TOTP(secret)
    valid_code = totp.now()
    
    # Need to reset mock side effect or just use a fresh mock
    mock_db.execute.return_value.scalars.return_value.first.return_value = user
    
    success = await disable_totp(user_id, valid_code, business_id, mock_db)
    assert success is True
    assert user.totp_enabled is False

@pytest.mark.asyncio
async def test_totp_secret_is_not_returned_after_setup_completion():
    from app.main import app
    from httpx import AsyncClient, ASGITransport
    from app.api.deps import get_current_active_user
    from app.core.database import get_db

    user_id = uuid4()
    user = MagicMock(spec=User)
    user.id = user_id
    user.totp_enabled = True
    user.totp_enrolled_at = datetime.now()
    # secret is present but should NOT be returned by status endpoint
    user.totp_secret = "encrypted_stuff"

    app.dependency_overrides[get_db] = lambda: AsyncMock()
    app.dependency_overrides[get_current_active_user] = lambda: user

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        response = await ac.get("/api/v1/2fa/status")

    assert response.status_code == 200
    data = response.json()
    assert "enabled" in data
    assert "enrolled_at" in data
    assert "secret" not in data

    app.dependency_overrides.clear()
