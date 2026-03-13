"""Unit tests for SessionService."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-that-is-long-enough-for-validation")

import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest

from app.models.session import Session
from app.services.session_service import (
    SessionService,
    hash_token,
    parse_device_info,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
USER_ID = str(uuid.uuid4())
SESSION_ID = str(uuid.uuid4())
REFRESH_TOKEN = "test-refresh-token-abc123"
DESKTOP_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
MOBILE_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _chain(first=None, rows=None, count=0, update_count=0, delete_count=0):
    """Reusable mock supporting common SQLAlchemy chained-call patterns."""
    c = MagicMock()
    c.filter.return_value = c
    c.join.return_value = c
    c.order_by.return_value = c
    c.offset.return_value = c
    c.limit.return_value = c
    c.all.return_value = rows if rows is not None else []
    c.first.return_value = first
    c.count.return_value = count
    c.scalar.return_value = count
    c.update.return_value = update_count
    c.delete.return_value = delete_count
    return c


def _make_session(**overrides):
    """Build a mock Session object with sensible defaults."""
    s = MagicMock(spec=Session)
    s.id = overrides.get("id", uuid.uuid4())
    s.user_id = overrides.get("user_id", USER_ID)
    s.is_active = overrides.get("is_active", True)
    s.is_current = overrides.get("is_current", True)
    s.revoked_at = overrides.get("revoked_at", None)
    s.expires_at = overrides.get(
        "expires_at", datetime.now(timezone.utc) + timedelta(days=7)
    )
    s.is_valid = overrides.get("is_valid", True)
    s.last_active_at = overrides.get("last_active_at", datetime.now(timezone.utc))
    return s


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
def db():
    return MagicMock()


@pytest.fixture
def svc(db):
    return SessionService(db)


# ===========================================================================
# hash_token
# ===========================================================================
class TestHashToken:
    def test_returns_sha256_hex(self):
        result = hash_token("my-token")
        expected = hashlib.sha256("my-token".encode()).hexdigest()
        assert result == expected

    def test_deterministic(self):
        assert hash_token("abc") == hash_token("abc")

    def test_different_tokens_differ(self):
        assert hash_token("token-a") != hash_token("token-b")


# ===========================================================================
# parse_device_info
# ===========================================================================
class TestParseDeviceInfo:
    def test_none_returns_defaults(self):
        name, dtype = parse_device_info(None)
        assert name == "Unknown Device"
        assert dtype == "unknown"

    def test_empty_string_returns_defaults(self):
        name, dtype = parse_device_info("")
        assert name == "Unknown Device"
        assert dtype == "unknown"

    def test_desktop_user_agent(self):
        name, dtype = parse_device_info(DESKTOP_UA)
        assert dtype == "desktop"
        assert "Chrome" in name
        assert "Windows" in name

    def test_mobile_user_agent(self):
        name, dtype = parse_device_info(MOBILE_UA)
        assert dtype == "mobile"
        assert "Safari" in name or "Mobile" in name or "iOS" in name


# ===========================================================================
# SessionService.create_session
# ===========================================================================
class TestCreateSession:
    def test_creates_and_persists(self, svc, db):
        db.query.return_value = _chain(update_count=1)

        svc.create_session(
            user_id=USER_ID,
            refresh_token=REFRESH_TOKEN,
            user_agent=DESKTOP_UA,
            ip_address="127.0.0.1",
            location="Cape Town, South Africa",
        )

        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

        added = db.add.call_args[0][0]
        assert isinstance(added, Session)
        assert added.user_id == USER_ID
        assert added.refresh_token_hash == hash_token(REFRESH_TOKEN)
        assert added.ip_address == "127.0.0.1"
        assert added.is_active is True
        assert added.is_current is True

    def test_marks_previous_sessions_not_current(self, svc, db):
        chain = _chain(update_count=2)
        db.query.return_value = chain

        svc.create_session(user_id=USER_ID, refresh_token=REFRESH_TOKEN)

        chain.filter.assert_called()
        chain.update.assert_called_once_with({"is_current": False})

    def test_device_info_parsed(self, svc, db):
        db.query.return_value = _chain(update_count=0)

        svc.create_session(
            user_id=USER_ID,
            refresh_token=REFRESH_TOKEN,
            user_agent=MOBILE_UA,
        )

        added = db.add.call_args[0][0]
        assert added.device_type == "mobile"
        assert added.device_name != "Unknown Device"


# ===========================================================================
# SessionService.get_session_by_token
# ===========================================================================
class TestGetSessionByToken:
    def test_returns_session_when_found(self, svc, db):
        session = _make_session()
        db.query.return_value = _chain(first=session)

        result = svc.get_session_by_token(REFRESH_TOKEN)
        assert result is session

    def test_returns_none_when_not_found(self, svc, db):
        db.query.return_value = _chain(first=None)

        result = svc.get_session_by_token("nonexistent-token")
        assert result is None


# ===========================================================================
# SessionService.get_user_sessions
# ===========================================================================
class TestGetUserSessions:
    def test_active_only_by_default(self, svc, db):
        sessions = [_make_session(), _make_session()]
        chain = _chain(rows=sessions)
        db.query.return_value = chain

        result = svc.get_user_sessions(USER_ID)

        assert result == sessions
        # filter called twice: once for user_id, once for active/revoked/expired
        assert chain.filter.call_count == 2
        chain.order_by.assert_called_once()

    def test_include_inactive(self, svc, db):
        sessions = [_make_session(), _make_session(is_active=False)]
        chain = _chain(rows=sessions)
        db.query.return_value = chain

        result = svc.get_user_sessions(USER_ID, include_inactive=True)

        assert result == sessions
        # Only one filter call (user_id), no active filter
        assert chain.filter.call_count == 1


# ===========================================================================
# SessionService.update_session_activity
# ===========================================================================
class TestUpdateSessionActivity:
    def test_updates_last_active_at(self, svc, db):
        session = _make_session()

        result = svc.update_session_activity(session)

        assert result is session
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(session)
        # last_active_at should be set to a recent datetime
        assert isinstance(session.last_active_at, datetime)


# ===========================================================================
# SessionService.revoke_session
# ===========================================================================
class TestRevokeSession:
    def test_revokes_existing_session(self, svc, db):
        session = _make_session(id=SESSION_ID)
        db.query.return_value = _chain(first=session)

        result = svc.revoke_session(SESSION_ID, USER_ID)

        assert result is True
        assert session.is_active is False
        assert session.revoked_at is not None
        db.commit.assert_called_once()

    def test_returns_false_when_not_found(self, svc, db):
        db.query.return_value = _chain(first=None)

        result = svc.revoke_session("missing-id", USER_ID)

        assert result is False
        db.commit.assert_not_called()


# ===========================================================================
# SessionService.revoke_all_sessions
# ===========================================================================
class TestRevokeAllSessions:
    def test_revokes_all(self, svc, db):
        chain = _chain(update_count=3)
        db.query.return_value = chain

        count = svc.revoke_all_sessions(USER_ID)

        assert count == 3
        chain.update.assert_called_once()
        db.commit.assert_called_once()

    def test_revokes_all_except_one(self, svc, db):
        chain = _chain(update_count=2)
        db.query.return_value = chain

        count = svc.revoke_all_sessions(USER_ID, except_session_id=SESSION_ID)

        assert count == 2
        # Extra filter call for excluding the session
        assert chain.filter.call_count >= 2
        db.commit.assert_called_once()


# ===========================================================================
# SessionService.cleanup_expired_sessions
# ===========================================================================
class TestCleanupExpiredSessions:
    def test_cleanup_all_expired(self, svc, db):
        chain = _chain(delete_count=5)
        db.query.return_value = chain

        count = svc.cleanup_expired_sessions()

        assert count == 5
        chain.delete.assert_called_once()
        db.commit.assert_called_once()
        # Only one filter (expires_at), no user_id filter
        assert chain.filter.call_count == 1

    def test_cleanup_for_specific_user(self, svc, db):
        chain = _chain(delete_count=2)
        db.query.return_value = chain

        count = svc.cleanup_expired_sessions(user_id=USER_ID)

        assert count == 2
        # Two filter calls: expires_at + user_id
        assert chain.filter.call_count == 2
        db.commit.assert_called_once()


# ===========================================================================
# SessionService.validate_session
# ===========================================================================
class TestValidateSession:
    def test_valid_session(self, svc, db):
        session = _make_session(is_valid=True)
        db.query.return_value = _chain(first=session)

        result = svc.validate_session(REFRESH_TOKEN)

        assert result is session
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(session)

    def test_returns_none_when_not_found(self, svc, db):
        db.query.return_value = _chain(first=None)

        result = svc.validate_session(REFRESH_TOKEN)
        assert result is None

    def test_returns_none_when_invalid(self, svc, db):
        session = _make_session(is_valid=False)
        db.query.return_value = _chain(first=session)

        result = svc.validate_session(REFRESH_TOKEN)
        assert result is None
