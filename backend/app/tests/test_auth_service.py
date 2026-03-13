"""Unit tests for AuthService.

Tests cover:
- get_user_by_email (found, not found)
- get_user_by_id (UUID string, invalid string, UUID object)
- create_user (hashes password, sets PENDING status, calls add/commit/refresh)
- authenticate_user (valid, wrong password, not found, OAuth user)
- verify_email (success, user not found)
- update_password (hashes and commits)
- reset_password (success, user not found)
"""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.models.user import User, UserStatus
from app.services.auth_service import AuthService


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

def _make_service():
    """Create an AuthService with a regular MagicMock db (sync path)."""
    db = MagicMock()
    svc = AuthService(db)
    assert not svc._is_async
    return svc, db


def _mock_execute_result(user=None):
    """Return a mock result whose .scalars().first() returns *user*."""
    result = MagicMock()
    result.scalars.return_value.first.return_value = user
    return result


def _fake_user(**overrides):
    """Return a MagicMock pretending to be a User row."""
    defaults = dict(
        id=uuid.uuid4(),
        email="test@example.com",
        hashed_password="hashed_pw",
        first_name="Test",
        last_name="User",
        phone=None,
        is_email_verified=False,
        status=UserStatus.PENDING,
    )
    defaults.update(overrides)
    user = MagicMock(spec=User)
    for k, v in defaults.items():
        setattr(user, k, v)
    return user


# ══════════════════════════════════════════════════════════════════════════════
# get_user_by_email
# ══════════════════════════════════════════════════════════════════════════════

class TestGetUserByEmail:

    @pytest.mark.asyncio
    async def test_returns_user_when_found(self):
        svc, db = _make_service()
        user = _fake_user()
        db.execute.return_value = _mock_execute_result(user)

        result = await svc.get_user_by_email("test@example.com")

        assert result is user
        db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self):
        svc, db = _make_service()
        db.execute.return_value = _mock_execute_result(None)

        result = await svc.get_user_by_email("missing@example.com")

        assert result is None


# ══════════════════════════════════════════════════════════════════════════════
# get_user_by_id
# ══════════════════════════════════════════════════════════════════════════════

class TestGetUserById:

    @pytest.mark.asyncio
    async def test_with_uuid_string_finds_user(self):
        svc, db = _make_service()
        uid = uuid.uuid4()
        user = _fake_user(id=uid)
        db.execute.return_value = _mock_execute_result(user)

        result = await svc.get_user_by_id(str(uid))

        assert result is user
        db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_with_invalid_uuid_string_returns_none(self):
        svc, db = _make_service()

        result = await svc.get_user_by_id("not-a-uuid")

        assert result is None
        db.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_with_uuid_object_finds_user(self):
        svc, db = _make_service()
        uid = uuid.uuid4()
        user = _fake_user(id=uid)
        db.execute.return_value = _mock_execute_result(user)

        result = await svc.get_user_by_id(uid)

        assert result is user
        db.execute.assert_called_once()


# ══════════════════════════════════════════════════════════════════════════════
# create_user
# ══════════════════════════════════════════════════════════════════════════════

class TestCreateUser:

    @pytest.mark.asyncio
    @patch("app.services.auth_service.get_password_hash", return_value="hashed123")
    async def test_creates_user_with_pending_status(self, mock_hash):
        svc, db = _make_service()
        user_data = MagicMock()
        user_data.password = "secret123"
        user_data.email = "new@example.com"
        user_data.first_name = "New"
        user_data.last_name = "User"
        user_data.phone = None

        await svc.create_user(user_data)

        mock_hash.assert_called_once_with("secret123")
        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

        created_user = db.add.call_args[0][0]
        assert isinstance(created_user, User)
        assert created_user.email == "new@example.com"
        assert created_user.hashed_password == "hashed123"
        assert created_user.first_name == "New"
        assert created_user.last_name == "User"
        assert created_user.status == UserStatus.PENDING
        assert created_user.is_email_verified is False


# ══════════════════════════════════════════════════════════════════════════════
# authenticate_user
# ══════════════════════════════════════════════════════════════════════════════

class TestAuthenticateUser:

    @pytest.mark.asyncio
    @patch("app.services.auth_service.verify_password", return_value=True)
    async def test_valid_credentials_returns_user(self, mock_verify):
        svc, db = _make_service()
        user = _fake_user(hashed_password="hashed_pw")
        db.execute.return_value = _mock_execute_result(user)

        result = await svc.authenticate_user("test@example.com", "password")

        assert result is user
        mock_verify.assert_called_once_with("password", "hashed_pw")

    @pytest.mark.asyncio
    @patch("app.services.auth_service.verify_password", return_value=False)
    async def test_wrong_password_returns_none(self, mock_verify):
        svc, db = _make_service()
        user = _fake_user(hashed_password="hashed_pw")
        db.execute.return_value = _mock_execute_result(user)

        result = await svc.authenticate_user("test@example.com", "wrong")

        assert result is None
        mock_verify.assert_called_once_with("wrong", "hashed_pw")

    @pytest.mark.asyncio
    async def test_user_not_found_returns_none(self):
        svc, db = _make_service()
        db.execute.return_value = _mock_execute_result(None)

        result = await svc.authenticate_user("missing@example.com", "password")

        assert result is None

    @pytest.mark.asyncio
    async def test_oauth_user_no_password_returns_none(self):
        svc, db = _make_service()
        user = _fake_user(hashed_password=None)
        db.execute.return_value = _mock_execute_result(user)

        result = await svc.authenticate_user("test@example.com", "password")

        assert result is None


# ══════════════════════════════════════════════════════════════════════════════
# verify_email
# ══════════════════════════════════════════════════════════════════════════════

class TestVerifyEmail:

    @pytest.mark.asyncio
    async def test_marks_email_verified_and_active(self):
        svc, db = _make_service()
        user = _fake_user(is_email_verified=False, status=UserStatus.PENDING)
        db.execute.return_value = _mock_execute_result(user)

        result = await svc.verify_email("test@example.com")

        assert result is True
        assert user.is_email_verified is True
        assert user.status == UserStatus.ACTIVE
        db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_user_not_found_returns_false(self):
        svc, db = _make_service()
        db.execute.return_value = _mock_execute_result(None)

        result = await svc.verify_email("missing@example.com")

        assert result is False
        db.commit.assert_not_called()


# ══════════════════════════════════════════════════════════════════════════════
# update_password
# ══════════════════════════════════════════════════════════════════════════════

class TestUpdatePassword:

    @pytest.mark.asyncio
    @patch("app.services.auth_service.get_password_hash", return_value="new_hashed")
    async def test_hashes_and_commits(self, mock_hash):
        svc, db = _make_service()
        user = _fake_user()

        result = await svc.update_password(user, "new_password")

        assert result is True
        mock_hash.assert_called_once_with("new_password")
        assert user.hashed_password == "new_hashed"
        db.commit.assert_called_once()


# ══════════════════════════════════════════════════════════════════════════════
# reset_password
# ══════════════════════════════════════════════════════════════════════════════

class TestResetPassword:

    @pytest.mark.asyncio
    @patch("app.services.auth_service.get_password_hash", return_value="reset_hashed")
    async def test_finds_user_and_resets(self, mock_hash):
        svc, db = _make_service()
        user = _fake_user()
        db.execute.return_value = _mock_execute_result(user)

        result = await svc.reset_password("test@example.com", "reset_pw")

        assert result is True
        mock_hash.assert_called_once_with("reset_pw")
        assert user.hashed_password == "reset_hashed"
        db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_user_not_found_returns_false(self):
        svc, db = _make_service()
        db.execute.return_value = _mock_execute_result(None)

        result = await svc.reset_password("missing@example.com", "reset_pw")

        assert result is False
        db.commit.assert_not_called()
