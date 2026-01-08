"""Admin-only access control dependencies and utilities."""

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
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
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


class RequireAdmin:
    """
    Class-based admin checker for more flexibility.
    
    Usage:
        admin_check = RequireAdmin()
        
        @router.get("/admin/settings")
        async def admin_settings(
            admin: User = Depends(admin_check),
        ):
            ...
    """
    
    async def __call__(
        self,
        current_user: User = Depends(get_current_active_user),
    ) -> User:
        if not current_user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required",
            )
        return current_user


def is_admin_user(user: User) -> bool:
    """Helper function to check if a user is an admin."""
    return user.is_admin if user else False
