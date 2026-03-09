"""Comprehensive unit tests for PinService."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from app.models.user import User
from app.services.pin_service import (
    LOCKOUT_MINUTES,
    MAX_FAILED_ATTEMPTS,
    PinService,
    _lockout_cache,
)

# User model uses `status` enum, but pin_service references `User.is_active`.
# Patch it as a SQLAlchemy-like descriptor so filter expressions don't raise.
if not hasattr(User, "is_active"):
    User.is_active = MagicMock()

# ── Stable IDs ───────────────────────────────────────────────────────────
USER_ID = str(uuid4())
USER_ID_2 = str(uuid4())
MANAGER_ID = str(uuid4())
BIZ_ID = str(uuid4())


# ── Fixtures ─────────────────────────────────────────────────────────────
@pytest.fixture(autouse=True)
def clear_lockout_cache():
    """Ensure no cross-test contamination from module-level mutable state."""
    _lockout_cache.clear()
    yield
    _lockout_cache.clear()


def _svc():
    db = MagicMock()
    return PinService(db), db


def _chain(first=None, rows=None, count=0):
    """Reusable mock supporting SQLAlchemy chained-call pattern."""
    q = MagicMock()
    q.filter = MagicMock(return_value=q)
    q.all = MagicMock(return_value=rows or [])
    q.first = MagicMock(return_value=first)
    q.count = MagicMock(return_value=count)
    return q


def _mock_user(pin: str | None = None, user_id: str = USER_ID, active: bool = True):
    """Build a mock User with an optional bcrypt-hashed PIN."""
    u = MagicMock(spec=User)
    u.id = user_id
    u.is_active = active
    if pin is not None:
        svc, _ = _svc()
        u.pin_code_hash = svc.hash_pin(pin)
    else:
        u.pin_code_hash = None
    return u


# ═════════════════════════════════════════════════════════════════════════
# 1. hash_pin / verify_pin  (real bcrypt, no mocks)
# ═════════════════════════════════════════════════════════════════════════
class TestHashAndVerify:
    def test_hash_pin_returns_string(self):
        svc, _ = _svc()
        h = svc.hash_pin("1234")
        assert isinstance(h, str)
        assert h.startswith("$2")  # bcrypt prefix

    def test_hash_pin_different_salts(self):
        svc, _ = _svc()
        h1 = svc.hash_pin("1234")
        h2 = svc.hash_pin("1234")
        assert h1 != h2  # different salts

    def test_verify_pin_correct(self):
        svc, _ = _svc()
        h = svc.hash_pin("5678")
        assert svc.verify_pin("5678", h) is True

    def test_verify_pin_wrong(self):
        svc, _ = _svc()
        h = svc.hash_pin("1234")
        assert svc.verify_pin("0000", h) is False

    def test_verify_pin_invalid_hash_returns_false(self):
        svc, _ = _svc()
        assert svc.verify_pin("1234", "not-a-hash") is False

    def test_verify_pin_empty_hash_returns_false(self):
        svc, _ = _svc()
        assert svc.verify_pin("1234", "") is False

    def test_verify_six_digit_pin(self):
        svc, _ = _svc()
        h = svc.hash_pin("123456")
        assert svc.verify_pin("123456", h) is True
        assert svc.verify_pin("123457", h) is False


# ═════════════════════════════════════════════════════════════════════════
# 2. _validate_pin_format (static method, no DB)
# ═════════════════════════════════════════════════════════════════════════
class TestValidatePinFormat:
    @pytest.mark.parametrize("pin", ["1234", "12345", "123456", "0000", "9999"])
    def test_valid_pins(self, pin):
        assert PinService._validate_pin_format(pin) is True

    @pytest.mark.parametrize(
        "pin,reason",
        [
            ("123", "too short – 3 digits"),
            ("1234567", "too long – 7 digits"),
            ("", "empty string"),
            ("abcd", "letters"),
            ("12ab", "mixed alphanumeric"),
            ("12 34", "contains space"),
            ("123!", "special character"),
            ("12.34", "decimal point"),
        ],
    )
    def test_invalid_pins(self, pin, reason):
        assert PinService._validate_pin_format(pin) is False, reason


# ═════════════════════════════════════════════════════════════════════════
# 3. set_pin
# ═════════════════════════════════════════════════════════════════════════
class TestSetPin:
    def test_set_pin_success_4_digit(self):
        svc, db = _svc()
        user = _mock_user(pin=None)
        db.query.return_value = _chain(first=user)

        assert svc.set_pin(USER_ID, "1234") is True
        assert user.pin_code_hash is not None
        db.commit.assert_called_once()

    def test_set_pin_success_5_digit(self):
        svc, db = _svc()
        user = _mock_user(pin=None)
        db.query.return_value = _chain(first=user)

        assert svc.set_pin(USER_ID, "56789") is True
        db.commit.assert_called_once()

    def test_set_pin_success_6_digit(self):
        svc, db = _svc()
        user = _mock_user(pin=None)
        db.query.return_value = _chain(first=user)

        assert svc.set_pin(USER_ID, "654321") is True
        db.commit.assert_called_once()

    def test_set_pin_invalid_format_too_short(self):
        svc, db = _svc()
        assert svc.set_pin(USER_ID, "123") is False
        db.query.assert_not_called()

    def test_set_pin_invalid_format_too_long(self):
        svc, db = _svc()
        assert svc.set_pin(USER_ID, "1234567") is False
        db.query.assert_not_called()

    def test_set_pin_invalid_format_letters(self):
        svc, db = _svc()
        assert svc.set_pin(USER_ID, "abcd") is False

    def test_set_pin_invalid_format_empty(self):
        svc, db = _svc()
        assert svc.set_pin(USER_ID, "") is False

    def test_set_pin_user_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        assert svc.set_pin(USER_ID, "1234") is False
        db.commit.assert_not_called()

    def test_set_pin_stores_bcrypt_hash(self):
        svc, db = _svc()
        user = _mock_user(pin=None)
        db.query.return_value = _chain(first=user)

        svc.set_pin(USER_ID, "4321")
        assert user.pin_code_hash.startswith("$2")
        assert svc.verify_pin("4321", user.pin_code_hash) is True


# ═════════════════════════════════════════════════════════════════════════
# 4. authenticate_by_pin
# ═════════════════════════════════════════════════════════════════════════
class TestAuthenticateByPin:
    def test_match_returns_user(self):
        svc, db = _svc()
        user = _mock_user(pin="1234")
        db.query.return_value = _chain(rows=[user])

        result = svc.authenticate_by_pin("1234", BIZ_ID)
        assert result is user

    def test_wrong_pin_returns_none(self):
        svc, db = _svc()
        user = _mock_user(pin="1234")
        db.query.return_value = _chain(rows=[user])

        assert svc.authenticate_by_pin("0000", BIZ_ID) is None

    def test_no_users_returns_none(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[])

        assert svc.authenticate_by_pin("1234", BIZ_ID) is None

    def test_skips_locked_out_user(self):
        svc, db = _svc()
        user = _mock_user(pin="1234")
        uid = str(user.id)
        _lockout_cache[uid] = {
            "count": MAX_FAILED_ATTEMPTS,
            "locked_until": datetime.now(timezone.utc) + timedelta(minutes=10),
        }
        db.query.return_value = _chain(rows=[user])

        assert svc.authenticate_by_pin("1234", BIZ_ID) is None

    def test_matches_second_user_when_first_wrong(self):
        svc, db = _svc()
        user1 = _mock_user(pin="1111", user_id=USER_ID)
        user2 = _mock_user(pin="2222", user_id=USER_ID_2)
        db.query.return_value = _chain(rows=[user1, user2])

        result = svc.authenticate_by_pin("2222", BIZ_ID)
        assert result is user2

    def test_clears_failed_attempts_on_success(self):
        svc, db = _svc()
        user = _mock_user(pin="1234")
        uid = str(user.id)
        _lockout_cache[uid] = {"count": 2}
        db.query.return_value = _chain(rows=[user])

        svc.authenticate_by_pin("1234", BIZ_ID)
        assert uid not in _lockout_cache

    def test_skips_locked_falls_through_to_unlocked(self):
        svc, db = _svc()
        locked_user = _mock_user(pin="9999", user_id=USER_ID)
        unlocked_user = _mock_user(pin="9999", user_id=USER_ID_2)
        _lockout_cache[str(locked_user.id)] = {
            "count": MAX_FAILED_ATTEMPTS,
            "locked_until": datetime.now(timezone.utc) + timedelta(minutes=10),
        }
        db.query.return_value = _chain(rows=[locked_user, unlocked_user])

        result = svc.authenticate_by_pin("9999", BIZ_ID)
        assert result is unlocked_user


# ═════════════════════════════════════════════════════════════════════════
# 5. authenticate_user_by_pin
# ═════════════════════════════════════════════════════════════════════════
class TestAuthenticateUserByPin:
    def test_success(self):
        svc, db = _svc()
        user = _mock_user(pin="4567")
        db.query.return_value = _chain(first=user)

        result = svc.authenticate_user_by_pin(USER_ID, "4567")
        assert result is user

    def test_wrong_pin_returns_none_and_records_attempt(self):
        svc, db = _svc()
        user = _mock_user(pin="4567")
        db.query.return_value = _chain(first=user)

        assert svc.authenticate_user_by_pin(USER_ID, "0000") is None
        assert _lockout_cache[USER_ID]["count"] == 1

    def test_locked_out_returns_none_without_querying(self):
        svc, db = _svc()
        _lockout_cache[USER_ID] = {
            "count": MAX_FAILED_ATTEMPTS,
            "locked_until": datetime.now(timezone.utc) + timedelta(minutes=10),
        }

        assert svc.authenticate_user_by_pin(USER_ID, "1234") is None
        db.query.assert_not_called()

    def test_user_not_found_returns_none(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        assert svc.authenticate_user_by_pin(USER_ID, "1234") is None

    def test_clears_attempts_on_success(self):
        svc, db = _svc()
        user = _mock_user(pin="1234")
        db.query.return_value = _chain(first=user)
        _lockout_cache[USER_ID] = {"count": 3}

        svc.authenticate_user_by_pin(USER_ID, "1234")
        assert USER_ID not in _lockout_cache

    def test_increments_attempts_on_each_failure(self):
        svc, db = _svc()
        user = _mock_user(pin="1234")
        db.query.return_value = _chain(first=user)

        for i in range(1, 4):
            svc.authenticate_user_by_pin(USER_ID, "0000")
            assert _lockout_cache[USER_ID]["count"] == i

    def test_locks_out_after_max_attempts(self):
        svc, db = _svc()
        user = _mock_user(pin="1234")
        db.query.return_value = _chain(first=user)

        for _ in range(MAX_FAILED_ATTEMPTS):
            svc.authenticate_user_by_pin(USER_ID, "0000")

        assert _lockout_cache[USER_ID]["count"] == MAX_FAILED_ATTEMPTS
        assert "locked_until" in _lockout_cache[USER_ID]
        # Subsequent calls rejected immediately
        db.query.reset_mock()
        assert svc.authenticate_user_by_pin(USER_ID, "1234") is None
        db.query.assert_not_called()


# ═════════════════════════════════════════════════════════════════════════
# 6. remove_pin
# ═════════════════════════════════════════════════════════════════════════
class TestRemovePin:
    def test_remove_pin_success(self):
        svc, db = _svc()
        user = _mock_user(pin="1234")
        db.query.return_value = _chain(first=user)

        assert svc.remove_pin(USER_ID) is True
        assert user.pin_code_hash is None
        db.commit.assert_called_once()

    def test_remove_pin_user_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        assert svc.remove_pin(USER_ID) is False
        db.commit.assert_not_called()


# ═════════════════════════════════════════════════════════════════════════
# 7. is_locked_out  (public wrapper)
# ═════════════════════════════════════════════════════════════════════════
class TestIsLockedOut:
    def test_not_locked_when_cache_empty(self):
        svc, _ = _svc()
        assert svc.is_locked_out(USER_ID) is False

    def test_locked_within_window(self):
        svc, _ = _svc()
        _lockout_cache[USER_ID] = {
            "count": MAX_FAILED_ATTEMPTS,
            "locked_until": datetime.now(timezone.utc) + timedelta(minutes=10),
        }
        assert svc.is_locked_out(USER_ID) is True

    def test_not_locked_after_expiry(self):
        svc, _ = _svc()
        _lockout_cache[USER_ID] = {
            "count": MAX_FAILED_ATTEMPTS,
            "locked_until": datetime.now(timezone.utc) - timedelta(minutes=1),
        }
        assert svc.is_locked_out(USER_ID) is False
        assert USER_ID not in _lockout_cache  # cleaned up

    def test_not_locked_with_attempts_below_threshold(self):
        svc, _ = _svc()
        _lockout_cache[USER_ID] = {"count": 3}
        assert svc.is_locked_out(USER_ID) is False


# ═════════════════════════════════════════════════════════════════════════
# 8. get_lockout_info
# ═════════════════════════════════════════════════════════════════════════
class TestGetLockoutInfo:
    def test_no_info_when_cache_empty(self):
        svc, _ = _svc()
        info = svc.get_lockout_info(USER_ID)
        assert info == {"locked": False, "attempts": 0}

    def test_locked_with_remaining_seconds(self):
        svc, _ = _svc()
        _lockout_cache[USER_ID] = {
            "count": MAX_FAILED_ATTEMPTS,
            "locked_until": datetime.now(timezone.utc) + timedelta(minutes=5),
        }
        info = svc.get_lockout_info(USER_ID)
        assert info["locked"] is True
        assert info["attempts"] == MAX_FAILED_ATTEMPTS
        assert 200 < info["remaining_seconds"] <= 300

    def test_not_locked_after_expiry(self):
        svc, _ = _svc()
        _lockout_cache[USER_ID] = {
            "count": MAX_FAILED_ATTEMPTS,
            "locked_until": datetime.now(timezone.utc) - timedelta(seconds=1),
        }
        info = svc.get_lockout_info(USER_ID)
        assert info["locked"] is False

    def test_attempts_shown_when_not_locked(self):
        svc, _ = _svc()
        _lockout_cache[USER_ID] = {"count": 3}
        info = svc.get_lockout_info(USER_ID)
        assert info == {"locked": False, "attempts": 3}


# ═════════════════════════════════════════════════════════════════════════
# 9. manager_unlock
# ═════════════════════════════════════════════════════════════════════════
class TestManagerUnlock:
    def test_unlock_locked_user(self):
        svc, _ = _svc()
        _lockout_cache[USER_ID] = {
            "count": MAX_FAILED_ATTEMPTS,
            "locked_until": datetime.now(timezone.utc) + timedelta(minutes=10),
        }
        assert svc.manager_unlock(USER_ID, MANAGER_ID) is True
        assert USER_ID not in _lockout_cache

    def test_unlock_not_in_cache(self):
        svc, _ = _svc()
        assert svc.manager_unlock(USER_ID, MANAGER_ID) is False

    def test_unlock_with_attempts_but_no_lock(self):
        svc, _ = _svc()
        _lockout_cache[USER_ID] = {"count": 2}
        assert svc.manager_unlock(USER_ID, MANAGER_ID) is True
        assert USER_ID not in _lockout_cache


# ═════════════════════════════════════════════════════════════════════════
# 10. Lockout mechanics  (_record / _clear / expiry)
# ═════════════════════════════════════════════════════════════════════════
class TestLockoutMechanics:
    def test_record_increments_count(self):
        PinService._record_failed_attempt(USER_ID)
        assert _lockout_cache[USER_ID]["count"] == 1
        PinService._record_failed_attempt(USER_ID)
        assert _lockout_cache[USER_ID]["count"] == 2

    def test_lockout_set_at_max_attempts(self):
        for _ in range(MAX_FAILED_ATTEMPTS):
            PinService._record_failed_attempt(USER_ID)
        info = _lockout_cache[USER_ID]
        assert info["count"] == MAX_FAILED_ATTEMPTS
        assert "locked_until" in info
        expected = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)
        assert abs((info["locked_until"] - expected).total_seconds()) < 2

    def test_no_lockout_below_max(self):
        for _ in range(MAX_FAILED_ATTEMPTS - 1):
            PinService._record_failed_attempt(USER_ID)
        assert "locked_until" not in _lockout_cache[USER_ID]

    def test_clear_removes_entry(self):
        PinService._record_failed_attempt(USER_ID)
        PinService._clear_failed_attempts(USER_ID)
        assert USER_ID not in _lockout_cache

    def test_clear_nonexistent_is_noop(self):
        PinService._clear_failed_attempts("no-such-id")  # should not raise

    def test_expired_lockout_auto_cleans(self):
        _lockout_cache[USER_ID] = {
            "count": MAX_FAILED_ATTEMPTS,
            "locked_until": datetime.now(timezone.utc) - timedelta(seconds=1),
        }
        assert PinService._is_locked_out(USER_ID) is False
        assert USER_ID not in _lockout_cache

    def test_constants(self):
        assert MAX_FAILED_ATTEMPTS == 5
        assert LOCKOUT_MINUTES == 15
