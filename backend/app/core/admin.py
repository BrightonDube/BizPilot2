"""Admin-only access control dependencies and utilities."""

from fastapi import Depends, HTTPException, status

from app.api.deps import get_current_active_user
from app.models.user import User


async def require_admin(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """
    Dependency that ensures the current user is an admin.
    
    Usage:
        @router.get("/admin/users")
        async def list_all_users(
            admin: User = Depends(require_admin)
        ):
            ...
    """
    if not (getattr(current_user, "is_admin", False) or getattr(current_user, "is_superadmin", False)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
