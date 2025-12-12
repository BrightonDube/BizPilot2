"""Role management service."""

from typing import List, Optional
import json
from sqlalchemy.orm import Session

from app.models.role import Role, DEFAULT_ROLES, Permission
from app.models.business_user import BusinessUser


class RoleService:
    """Service for role management operations."""

    def __init__(self, db: Session):
        self.db = db

    def get_role_by_id(self, role_id: str) -> Optional[Role]:
        """Get a role by ID."""
        return self.db.query(Role).filter(Role.id == role_id).first()

    def get_roles_for_business(self, business_id: str) -> List[Role]:
        """Get all roles for a business (including system roles)."""
        return self.db.query(Role).filter(
            (Role.business_id == business_id) | (Role.is_system.is_(True))
        ).all()

    def get_system_roles(self) -> List[Role]:
        """Get all system roles."""
        return self.db.query(Role).filter(Role.is_system.is_(True)).all()

    def create_role(
        self,
        name: str,
        description: str,
        permissions: List[str],
        business_id: str,
    ) -> Role:
        """Create a custom role for a business."""
        role = Role(
            name=name,
            description=description,
            business_id=business_id,
            is_system=False,
            permissions=json.dumps(permissions),
        )
        
        self.db.add(role)
        self.db.commit()
        self.db.refresh(role)
        return role

    def update_role(
        self,
        role_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        permissions: Optional[List[str]] = None,
    ) -> Optional[Role]:
        """Update a custom role."""
        role = self.get_role_by_id(role_id)
        if not role or role.is_system:
            return None
        
        if name:
            role.name = name
        if description:
            role.description = description
        if permissions is not None:
            role.set_permissions(permissions)
        
        self.db.commit()
        self.db.refresh(role)
        return role

    def delete_role(self, role_id: str) -> bool:
        """Delete a custom role."""
        role = self.get_role_by_id(role_id)
        if not role or role.is_system:
            return False
        
        # Check if role is in use
        users_with_role = self.db.query(BusinessUser).filter(
            BusinessUser.role_id == role_id
        ).count()
        
        if users_with_role > 0:
            return False  # Can't delete role in use
        
        self.db.delete(role)
        self.db.commit()
        return True

    def assign_role_to_user(
        self,
        user_id: str,
        business_id: str,
        role_id: str,
    ) -> Optional[BusinessUser]:
        """Assign a role to a user in a business."""
        business_user = self.db.query(BusinessUser).filter(
            BusinessUser.user_id == user_id,
            BusinessUser.business_id == business_id,
        ).first()
        
        if not business_user:
            return None
        
        business_user.role_id = role_id
        self.db.commit()
        self.db.refresh(business_user)
        return business_user

    def create_system_roles(self) -> List[Role]:
        """Create default system roles if they don't exist."""
        created_roles = []
        
        for role_key, role_data in DEFAULT_ROLES.items():
            existing = self.db.query(Role).filter(
                Role.name == role_data["name"],
                Role.is_system.is_(True)
            ).first()
            
            if not existing:
                role = Role(
                    name=role_data["name"],
                    description=role_data["description"],
                    is_system=True,
                    permissions=json.dumps(role_data["permissions"]),
                )
                self.db.add(role)
                created_roles.append(role)
        
        if created_roles:
            self.db.commit()
            for role in created_roles:
                self.db.refresh(role)
        
        return created_roles

    @staticmethod
    def get_all_permissions() -> List[dict]:
        """Get all available permissions with descriptions."""
        return [
            {"value": p.value, "name": p.name}
            for p in Permission
        ]

    @staticmethod
    def get_permissions_by_category() -> dict:
        """Get permissions grouped by category."""
        categories = {}
        for p in Permission:
            category = p.value.split(":")[0]
            if category not in categories:
                categories[category] = []
            categories[category].append({
                "value": p.value,
                "name": p.name,
                "action": p.value.split(":")[1],
            })
        return categories
