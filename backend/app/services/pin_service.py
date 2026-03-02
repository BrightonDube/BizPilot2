"""PIN authentication service for shift management."""

from datetime import datetime, timezone
from typing import Optional

import bcrypt
from sqlalchemy.orm import Session

from app.models.user import User


# Failed attempt tracking: {user_id: {"count": int, "locked_until": datetime}}
_lockout_cache: dict[str, dict] = {}

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


class PinService:
    """Service for PIN-based staff authentication at POS terminals."""

    def __init__(self, db: Session):
        self.db = db

    def hash_pin(self, pin: str) -> str:
        """Hash a PIN using bcrypt."""
        pin_bytes = pin.encode("utf-8")
        salt = bcrypt.gensalt(rounds=10)
        return bcrypt.hashpw(pin_bytes, salt).decode("utf-8")

    def verify_pin(self, pin: str, hashed_pin: str) -> bool:
        """Verify a PIN against its hash."""
        try:
            return bcrypt.checkpw(pin.encode("utf-8"), hashed_pin.encode("utf-8"))
        except Exception:
            return False

    def set_pin(self, user_id: str, pin: str) -> bool:
        """Set or update a user's PIN code."""
        if not self._validate_pin_format(pin):
            return False
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return False
        user.pin_code_hash = self.hash_pin(pin)
        self.db.commit()
        return True

    def authenticate_by_pin(
        self,
        pin: str,
        business_id: str,
    ) -> Optional[User]:
        """Authenticate a staff member by PIN within a business.

        Returns the User if PIN matches and account is not locked out.
        Returns None if PIN is invalid or account is locked.
        """
        users = (
            self.db.query(User)
            .filter(
                User.pin_code_hash.isnot(None),
                User.is_active.is_(True),
            )
            .all()
        )

        for user in users:
            uid = str(user.id)
            if self._is_locked_out(uid):
                continue
            if self.verify_pin(pin, user.pin_code_hash):
                self._clear_failed_attempts(uid)
                return user

        # If no match, we can't know which user failed, so just return None
        return None

    def authenticate_user_by_pin(
        self,
        user_id: str,
        pin: str,
    ) -> Optional[User]:
        """Authenticate a specific user by their PIN."""
        if self._is_locked_out(user_id):
            return None

        user = (
            self.db.query(User)
            .filter(
                User.id == user_id,
                User.pin_code_hash.isnot(None),
                User.is_active.is_(True),
            )
            .first()
        )
        if not user:
            return None

        if self.verify_pin(pin, user.pin_code_hash):
            self._clear_failed_attempts(user_id)
            return user

        self._record_failed_attempt(user_id)
        return None

    def remove_pin(self, user_id: str) -> bool:
        """Remove a user's PIN code."""
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return False
        user.pin_code_hash = None
        self.db.commit()
        return True

    def is_locked_out(self, user_id: str) -> bool:
        """Check if a user is locked out due to failed PIN attempts."""
        return self._is_locked_out(user_id)

    def get_lockout_info(self, user_id: str) -> dict:
        """Get lockout status and remaining time."""
        info = _lockout_cache.get(user_id)
        if not info:
            return {"locked": False, "attempts": 0}
        now = datetime.now(timezone.utc)
        locked_until = info.get("locked_until")
        if locked_until and now < locked_until:
            remaining = (locked_until - now).total_seconds()
            return {
                "locked": True,
                "attempts": info["count"],
                "remaining_seconds": int(remaining),
            }
        return {"locked": False, "attempts": info.get("count", 0)}

    def manager_unlock(self, user_id: str, manager_id: str) -> bool:
        """Allow a manager to unlock a locked-out user account."""
        if user_id in _lockout_cache:
            del _lockout_cache[user_id]
            return True
        return False

    # ── Private helpers ──────────────────────────────────────────────────

    @staticmethod
    def _validate_pin_format(pin: str) -> bool:
        """Validate PIN is 4-6 digits."""
        return pin.isdigit() and 4 <= len(pin) <= 6

    @staticmethod
    def _is_locked_out(user_id: str) -> bool:
        info = _lockout_cache.get(user_id)
        if not info:
            return False
        locked_until = info.get("locked_until")
        if locked_until and datetime.now(timezone.utc) < locked_until:
            return True
        if locked_until and datetime.now(timezone.utc) >= locked_until:
            del _lockout_cache[user_id]
        return False

    @staticmethod
    def _record_failed_attempt(user_id: str) -> None:
        info = _lockout_cache.get(user_id, {"count": 0})
        info["count"] = info.get("count", 0) + 1
        if info["count"] >= MAX_FAILED_ATTEMPTS:
            from datetime import timedelta
            info["locked_until"] = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)
        _lockout_cache[user_id] = info

    @staticmethod
    def _clear_failed_attempts(user_id: str) -> None:
        _lockout_cache.pop(user_id, None)
