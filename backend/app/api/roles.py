"""Roles API endpoints for managing user roles and permissions."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict

from app.core.database import get_db
from app.api.deps import get_current_active_user, get_current_business_id
from app.core.rbac import has_permission
from app.models.user import User
from app.models.role import Role, Permission
from app.services.role_service import RoleService

router = APIRouter(prefix="/roles", tags=["Roles & Permissions"])


# --- Schemas ---

class RoleCreate(BaseModel):
    """Schema for creating a role."""
    name: str
    description: str
    permissions: List[str]


class RoleUpdate(BaseModel):
    """Schema for updating a role."""
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None


class RoleResponse(BaseModel):
    """Response schema for a role."""
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    name: str
    description: Optional[str] = None
    permissions: List[str]
    is_system: bool
    business_id: Optional[str] = None
    created_at: Optional[str] = None


class RoleListResponse(BaseModel):
    """Response schema for a list of roles."""
    items: List[RoleResponse]
    total: int


class PermissionInfo(BaseModel):
    """Information about a permission."""
    value: str
    name: str
    action: Optional[str] = None


class PermissionCategory(BaseModel):
    """Permissions grouped by category."""
    category: str
    permissions: List[PermissionInfo]


class AssignRoleRequest(BaseModel):
    """Request to assign a role to a user."""
    user_id: str
    role_id: str


def _role_to_response(role: Role) -> RoleResponse:
    """Convert role to response."""
    permissions = role.get_permissions()
    return RoleResponse(
        id=str(role.id),
        name=role.name,
        description=role.description,
        permissions=permissions,
        is_system=role.is_system,
        business_id=str(role.business_id) if role.business_id else None,
        created_at=role.created_at.isoformat() if role.created_at else None,
    )


# --- Endpoints ---

@router.get("/permissions", response_model=List[PermissionCategory])
async def get_all_permissions():
    """Get all available permissions grouped by category."""
    permissions_by_category = RoleService.get_permissions_by_category()
    
    result = []
    for category, perms in permissions_by_category.items():
        result.append(PermissionCategory(
            category=category,
            permissions=[
                PermissionInfo(
                    value=p["value"],
                    name=p["name"],
                    action=p.get("action"),
                )
                for p in perms
            ]
        ))
    
    return result


@router.get("/permissions/flat", response_model=List[PermissionInfo])
async def get_permissions_flat():
    """Get all available permissions as a flat list."""
    permissions = RoleService.get_all_permissions()
    return [PermissionInfo(value=p["value"], name=p["name"]) for p in permissions]


@router.get("", response_model=RoleListResponse)
async def list_roles(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """List all roles available for the business (system + custom)."""
    service = RoleService(db)
    roles = service.get_roles_for_business(business_id)
    
    return RoleListResponse(
        items=[_role_to_response(r) for r in roles],
        total=len(roles),
    )


@router.get("/system", response_model=RoleListResponse)
async def list_system_roles(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """List system-defined roles."""
    service = RoleService(db)
    roles = service.get_system_roles()
    
    return RoleListResponse(
        items=[_role_to_response(r) for r in roles],
        total=len(roles),
    )


@router.get("/{role_id}", response_model=RoleResponse)
async def get_role(
    role_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get a specific role by ID."""
    service = RoleService(db)
    role = service.get_role_by_id(role_id)
    
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    
    return _role_to_response(role)


@router.post("", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    data: RoleCreate,
    current_user: User = Depends(has_permission("users:manage")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Create a new custom role for the business."""
    service = RoleService(db)
    
    # Validate permissions
    valid_permissions = [p.value for p in Permission]
    invalid_perms = [p for p in data.permissions if p not in valid_permissions]
    if invalid_perms:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid permissions: {invalid_perms}"
        )
    
    role = service.create_role(
        name=data.name,
        description=data.description,
        permissions=data.permissions,
        business_id=business_id,
    )
    
    return _role_to_response(role)


@router.put("/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: str,
    data: RoleUpdate,
    current_user: User = Depends(has_permission("users:manage")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Update a custom role."""
    service = RoleService(db)
    
    # Get the role first
    role = service.get_role_by_id(role_id)
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    
    if role.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify system roles"
        )
    
    # Ensure the role belongs to this business
    if str(role.business_id) != business_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot modify roles from other businesses")
    
    # Validate permissions if provided
    if data.permissions:
        valid_permissions = [p.value for p in Permission]
        invalid_perms = [p for p in data.permissions if p not in valid_permissions]
        if invalid_perms:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid permissions: {invalid_perms}"
            )
    
    role = service.update_role(
        role_id=role_id,
        name=data.name,
        description=data.description,
        permissions=data.permissions,
    )
    
    if not role:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to update role")
    
    return _role_to_response(role)


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: str,
    current_user: User = Depends(has_permission("users:manage")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Delete a custom role."""
    service = RoleService(db)
    
    # Get the role first
    role = service.get_role_by_id(role_id)
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    
    if role.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete system roles"
        )
    
    # Ensure the role belongs to this business
    if str(role.business_id) != business_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete roles from other businesses")
    
    success = service.delete_role(role_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete role that is currently assigned to users"
        )


@router.post("/assign", status_code=status.HTTP_200_OK)
async def assign_role_to_user(
    data: AssignRoleRequest,
    current_user: User = Depends(has_permission("users:manage")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Assign a role to a user in the business."""
    service = RoleService(db)
    
    # Verify role exists
    role = service.get_role_by_id(data.role_id)
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    
    # Check if role can be used by this business
    if not role.is_system and str(role.business_id) != business_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot assign roles from other businesses"
        )
    
    result = service.assign_role_to_user(
        user_id=data.user_id,
        business_id=business_id,
        role_id=data.role_id,
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found in this business"
        )
    
    return {"message": "Role assigned successfully"}
