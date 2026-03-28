"""
test_admin_endpoints.py
Tests for admin access control (require_superadmin dependency).

Context: intermittent 401 reports on admin endpoints.  The admin guard
``require_superadmin`` in ``app/api/deps.py`` correctly returns 403 for
non-superadmins.  A 401 upstream comes from the auth layer (missing/expired
session cookie or JWT).  These tests verify the guard raises 403 (not 401) for
authenticated non-admin users, and passes through for superadmins.
"""

import pytest
from unittest.mock import MagicMock


class TestRequireSuperadmin:
    """Verify the require_superadmin dependency behaviour."""

    def test_require_superadmin_raises_403_for_non_admin(self):
        """Non-superadmin users must receive HTTP 403, not 401."""
        import asyncio
        from fastapi import HTTPException
        from app.api.deps import require_superadmin

        non_admin_user = MagicMock()
        non_admin_user.is_superadmin = False

        async def _call():
            with pytest.raises(HTTPException) as exc_info:
                await require_superadmin(current_user=non_admin_user)
            assert exc_info.value.status_code == 403, (
                f"Expected 403 for non-admin, got {exc_info.value.status_code}. "
                "A 401 here means the auth layer rejected the request — not the admin guard."
            )

        asyncio.run(_call())

    def test_require_superadmin_returns_user_for_superadmin(self):
        """Superadmin users must pass through without exception."""
        import asyncio
        from app.api.deps import require_superadmin

        admin_user = MagicMock()
        admin_user.is_superadmin = True

        async def _call():
            result = await require_superadmin(current_user=admin_user)
            assert result is admin_user

        asyncio.run(_call())

    def test_require_superadmin_exists_in_deps(self):
        """require_superadmin must be importable from app.api.deps."""
        from app.api.deps import require_superadmin
        assert callable(require_superadmin)

    def test_error_message_mentions_superadmin(self):
        """The 403 error detail must mention superadmin to help diagnose access issues."""
        import asyncio
        from fastapi import HTTPException
        from app.api.deps import require_superadmin

        non_admin_user = MagicMock()
        non_admin_user.is_superadmin = False

        async def _call():
            with pytest.raises(HTTPException) as exc_info:
                await require_superadmin(current_user=non_admin_user)
            detail = str(exc_info.value.detail).lower()
            assert any(word in detail for word in ("admin", "superadmin", "permission", "access")), (
                f"Error detail {exc_info.value.detail!r} should mention admin/permission"
            )

        asyncio.run(_call())


class TestAdminRouteRegistration:
    """Verify admin-protected routes exist on the router."""

    def test_require_superadmin_is_async(self):
        """require_superadmin must be an async function (FastAPI Depends requirement)."""
        import asyncio
        from app.api.deps import require_superadmin
        assert asyncio.iscoroutinefunction(require_superadmin), (
            "require_superadmin must be async — sync Depends() on async routes causes issues"
        )

    def test_user_model_has_is_superadmin(self):
        """User model must have is_superadmin attribute used by the guard."""
        from app.models.user import User
        assert hasattr(User, "is_superadmin"), (
            "User model missing is_superadmin — require_superadmin will always raise AttributeError"
        )
