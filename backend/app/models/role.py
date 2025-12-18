"""Role and Permission models for RBAC."""

from sqlalchemy import Column, String, ForeignKey, Table, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
import enum
from typing import List

from app.models.base import BaseModel
from app.core.database import Base


class Permission(str, enum.Enum):
    """Available permissions in the system."""

    # User management
    USERS_VIEW = "users:view"
    USERS_CREATE = "users:create"
    USERS_EDIT = "users:edit"
    USERS_DELETE = "users:delete"

    # Business management
    BUSINESS_VIEW = "business:view"
    BUSINESS_EDIT = "business:edit"
    BUSINESS_DELETE = "business:delete"

    # Product management
    PRODUCTS_VIEW = "products:view"
    PRODUCTS_CREATE = "products:create"
    PRODUCTS_EDIT = "products:edit"
    PRODUCTS_DELETE = "products:delete"

    # Inventory management
    INVENTORY_VIEW = "inventory:view"
    INVENTORY_CREATE = "inventory:create"
    INVENTORY_EDIT = "inventory:edit"
    INVENTORY_ADJUST = "inventory:adjust"
    INVENTORY_TRANSFER = "inventory:transfer"

    # Order management
    ORDERS_VIEW = "orders:view"
    ORDERS_CREATE = "orders:create"
    ORDERS_EDIT = "orders:edit"
    ORDERS_CANCEL = "orders:cancel"

    # Customer management
    CUSTOMERS_VIEW = "customers:view"
    CUSTOMERS_CREATE = "customers:create"
    CUSTOMERS_EDIT = "customers:edit"
    CUSTOMERS_DELETE = "customers:delete"

    # Invoice management
    INVOICES_VIEW = "invoices:view"
    INVOICES_CREATE = "invoices:create"
    INVOICES_EDIT = "invoices:edit"
    INVOICES_SEND = "invoices:send"
    INVOICES_VOID = "invoices:void"

    # Payment management
    PAYMENTS_VIEW = "payments:view"
    PAYMENTS_CREATE = "payments:create"
    PAYMENTS_REFUND = "payments:refund"

    # Reports
    REPORTS_VIEW = "reports:view"
    REPORTS_EXPORT = "reports:export"

    # Settings
    SETTINGS_VIEW = "settings:view"
    SETTINGS_EDIT = "settings:edit"

    # AI Assistant
    AI_ACCESS = "ai:access"


# Association table for Role-Permission many-to-many relationship
role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", UUID(as_uuid=True), ForeignKey("roles.id"), primary_key=True),
    Column("permission", String(50), primary_key=True),
)


class Role(BaseModel):
    """Role model for RBAC."""

    __tablename__ = "roles"

    name = Column(String(50), nullable=False)
    description = Column(String(255), nullable=True)
    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=True)
    is_system = Column(Boolean, default=False)  # System roles can't be deleted

    # Store permissions as JSONB array for better performance and querying
    permissions = Column(JSONB, nullable=True, default=[])

    # Relationships
    business_users = relationship("BusinessUser", back_populates="role")

    def __repr__(self) -> str:
        return f"<Role {self.name}>"

    def get_permissions(self) -> List[str]:
        """Get list of permissions."""
        return self.permissions or []

    def set_permissions(self, perms: List[str]) -> None:
        """Set list of permissions."""
        self.permissions = perms

    def has_permission(self, permission: str) -> bool:
        """Check if role has a specific permission.
        
        Admin roles automatically have all permissions.
        """
        # Admin role has all permissions (handles new permissions added after role creation)
        if self.name and self.name.lower() == "admin":
            return True
        return permission in self.get_permissions()


# Default role configurations
DEFAULT_ROLES = {
    "admin": {
        "name": "Admin",
        "description": "Full access to all features",
        "permissions": [p.value for p in Permission],
    },
    "manager": {
        "name": "Manager",
        "description": "Can manage products, orders, and view reports",
        "permissions": [
            Permission.PRODUCTS_VIEW.value,
            Permission.PRODUCTS_CREATE.value,
            Permission.PRODUCTS_EDIT.value,
            Permission.INVENTORY_VIEW.value,
            Permission.INVENTORY_CREATE.value,
            Permission.INVENTORY_EDIT.value,
            Permission.INVENTORY_ADJUST.value,
            Permission.ORDERS_VIEW.value,
            Permission.ORDERS_CREATE.value,
            Permission.ORDERS_EDIT.value,
            Permission.CUSTOMERS_VIEW.value,
            Permission.CUSTOMERS_CREATE.value,
            Permission.CUSTOMERS_EDIT.value,
            Permission.INVOICES_VIEW.value,
            Permission.INVOICES_CREATE.value,
            Permission.INVOICES_SEND.value,
            Permission.PAYMENTS_VIEW.value,
            Permission.PAYMENTS_CREATE.value,
            Permission.REPORTS_VIEW.value,
            Permission.AI_ACCESS.value,
        ],
    },
    "employee": {
        "name": "Employee",
        "description": "Basic access for daily operations",
        "permissions": [
            Permission.PRODUCTS_VIEW.value,
            Permission.INVENTORY_VIEW.value,
            Permission.ORDERS_VIEW.value,
            Permission.ORDERS_CREATE.value,
            Permission.CUSTOMERS_VIEW.value,
            Permission.INVOICES_VIEW.value,
            Permission.PAYMENTS_VIEW.value,
        ],
    },
}
