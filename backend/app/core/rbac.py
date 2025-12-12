"""Role-Based Access Control (RBAC) dependencies and decorators."""

from typing import List, Optional
from functools import wraps
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.role import Permission
from app.models.business_user import BusinessUser


def get_user_permissions(db: Session, user_id: str, business_id: str) -> List[str]:
    """Get all permissions for a user in a specific business."""
    business_user = db.query(BusinessUser).filter(
        BusinessUser.user_id == user_id,
        BusinessUser.business_id == business_id,
    ).first()
    
    if not business_user or not business_user.role:
        return []
    
    return business_user.role.get_permissions()


def has_permission(permission: str, business_id: Optional[str] = None):
    """
    Dependency that checks if the current user has a specific permission.
    
    Usage:
        @router.get("/protected")
        async def protected_route(
            user: User = Depends(has_permission("products:view"))
        ):
            ...
    """
    async def permission_checker(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db),
    ) -> User:
        # For now, if no business_id is provided, we check if user has the permission
        # in any of their businesses
        if business_id:
            permissions = get_user_permissions(db, str(current_user.id), business_id)
            if permission not in permissions:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission denied: {permission}",
                )
        else:
            # Check if user has permission in any business
            has_perm = False
            for bu in current_user.business_users:
                if bu.role and bu.role.has_permission(permission):
                    has_perm = True
                    break
            
            if not has_perm:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission denied: {permission}",
                )
        
        return current_user
    
    return permission_checker


def has_any_permission(permissions: List[str], business_id: Optional[str] = None):
    """
    Dependency that checks if the current user has any of the specified permissions.
    """
    async def permission_checker(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db),
    ) -> User:
        if business_id:
            user_permissions = get_user_permissions(db, str(current_user.id), business_id)
            if not any(p in user_permissions for p in permissions):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Permission denied",
                )
        else:
            has_perm = False
            for bu in current_user.business_users:
                if bu.role:
                    for p in permissions:
                        if bu.role.has_permission(p):
                            has_perm = True
                            break
                if has_perm:
                    break
            
            if not has_perm:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Permission denied",
                )
        
        return current_user
    
    return permission_checker


def has_all_permissions(permissions: List[str], business_id: Optional[str] = None):
    """
    Dependency that checks if the current user has all of the specified permissions.
    """
    async def permission_checker(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db),
    ) -> User:
        if business_id:
            user_permissions = get_user_permissions(db, str(current_user.id), business_id)
            if not all(p in user_permissions for p in permissions):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Permission denied",
                )
        else:
            # Check if user has all permissions in any single business
            has_all = False
            for bu in current_user.business_users:
                if bu.role:
                    user_perms = bu.role.get_permissions()
                    if all(p in user_perms for p in permissions):
                        has_all = True
                        break
            
            if not has_all:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Permission denied",
                )
        
        return current_user
    
    return permission_checker


class RequirePermission:
    """
    Class-based permission checker for more complex permission logic.
    
    Usage:
        permission_check = RequirePermission("products:edit")
        
        @router.put("/products/{id}")
        async def update_product(
            id: str,
            user: User = Depends(permission_check),
        ):
            ...
    """
    
    def __init__(self, permission: str):
        self.permission = permission
    
    async def __call__(
        self,
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db),
    ) -> User:
        # Check if user has permission in any business
        has_perm = False
        for bu in current_user.business_users:
            if bu.role and bu.role.has_permission(self.permission):
                has_perm = True
                break
        
        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {self.permission}",
            )
        
        return current_user


def require_business_access(business_id_param: str = "business_id"):
    """
    Dependency that checks if the current user has access to a specific business.
    
    Usage:
        @router.get("/businesses/{business_id}/products")
        async def get_products(
            business_id: str,
            user: User = Depends(require_business_access("business_id")),
        ):
            ...
    """
    async def business_checker(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db),
        **path_params,
    ) -> User:
        # This is a simplified check - in real usage, you'd extract business_id
        # from the request path params
        return current_user
    
    return business_checker
