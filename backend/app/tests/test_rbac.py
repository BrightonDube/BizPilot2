"""Tests for Role-Based Access Control."""

import pytest


class TestRBACDependencies:
    """Tests for RBAC dependencies."""

    def test_rbac_module_exists(self):
        """Test that RBAC module can be imported."""
        from app.core.rbac import has_permission, has_any_permission, has_all_permissions
        assert has_permission is not None
        assert has_any_permission is not None
        assert has_all_permissions is not None

    def test_has_permission_returns_callable(self):
        """Test that has_permission returns a callable."""
        from app.core.rbac import has_permission
        result = has_permission("products:view")
        assert callable(result)

    def test_has_any_permission_returns_callable(self):
        """Test that has_any_permission returns a callable."""
        from app.core.rbac import has_any_permission
        result = has_any_permission(["products:view", "products:edit"])
        assert callable(result)

    def test_has_all_permissions_returns_callable(self):
        """Test that has_all_permissions returns a callable."""
        from app.core.rbac import has_all_permissions
        result = has_all_permissions(["products:view", "products:edit"])
        assert callable(result)

    def test_require_permission_class_exists(self):
        """Test that RequirePermission class exists."""
        from app.core.rbac import RequirePermission
        assert RequirePermission is not None

    def test_require_permission_is_callable(self):
        """Test that RequirePermission instance is callable."""
        from app.core.rbac import RequirePermission
        permission_check = RequirePermission("products:view")
        assert callable(permission_check)

    def test_get_user_permissions_exists(self):
        """Test that get_user_permissions function exists."""
        from app.core.rbac import get_user_permissions
        assert callable(get_user_permissions)


class TestRoleService:
    """Tests for RoleService."""

    def test_role_service_exists(self):
        """Test that RoleService can be imported."""
        from app.services.role_service import RoleService
        assert RoleService is not None

    def test_role_service_has_required_methods(self):
        """Test that RoleService has required methods."""
        from app.services.role_service import RoleService
        
        assert hasattr(RoleService, "get_role_by_id")
        assert hasattr(RoleService, "get_roles_for_business")
        assert hasattr(RoleService, "get_system_roles")
        assert hasattr(RoleService, "create_role")
        assert hasattr(RoleService, "update_role")
        assert hasattr(RoleService, "delete_role")
        assert hasattr(RoleService, "assign_role_to_user")
        assert hasattr(RoleService, "create_system_roles")

    def test_get_all_permissions_returns_list(self):
        """Test that get_all_permissions returns a list."""
        from app.services.role_service import RoleService
        
        permissions = RoleService.get_all_permissions()
        assert isinstance(permissions, list)
        assert len(permissions) > 0

    def test_get_permissions_by_category_returns_dict(self):
        """Test that get_permissions_by_category returns a dict."""
        from app.services.role_service import RoleService
        
        categories = RoleService.get_permissions_by_category()
        assert isinstance(categories, dict)
        assert len(categories) > 0

    def test_permissions_have_expected_categories(self):
        """Test that permissions have expected categories."""
        from app.services.role_service import RoleService
        
        categories = RoleService.get_permissions_by_category()
        expected_categories = ["users", "products", "orders", "customers", "invoices"]
        
        for category in expected_categories:
            assert category in categories


class TestPermissionEnum:
    """Tests for Permission enum."""

    def test_permission_enum_has_user_permissions(self):
        """Test that Permission enum has user permissions."""
        from app.models.role import Permission
        
        assert hasattr(Permission, "USERS_VIEW")
        assert hasattr(Permission, "USERS_CREATE")
        assert hasattr(Permission, "USERS_EDIT")
        assert hasattr(Permission, "USERS_DELETE")

    def test_permission_enum_has_product_permissions(self):
        """Test that Permission enum has product permissions."""
        from app.models.role import Permission
        
        assert hasattr(Permission, "PRODUCTS_VIEW")
        assert hasattr(Permission, "PRODUCTS_CREATE")
        assert hasattr(Permission, "PRODUCTS_EDIT")
        assert hasattr(Permission, "PRODUCTS_DELETE")

    def test_permission_enum_has_order_permissions(self):
        """Test that Permission enum has order permissions."""
        from app.models.role import Permission
        
        assert hasattr(Permission, "ORDERS_VIEW")
        assert hasattr(Permission, "ORDERS_CREATE")
        assert hasattr(Permission, "ORDERS_EDIT")
        assert hasattr(Permission, "ORDERS_CANCEL")

    def test_permission_enum_has_invoice_permissions(self):
        """Test that Permission enum has invoice permissions."""
        from app.models.role import Permission
        
        assert hasattr(Permission, "INVOICES_VIEW")
        assert hasattr(Permission, "INVOICES_CREATE")
        assert hasattr(Permission, "INVOICES_SEND")

    def test_permission_enum_has_ai_permission(self):
        """Test that Permission enum has AI access permission."""
        from app.models.role import Permission
        
        assert hasattr(Permission, "AI_ACCESS")


class TestDefaultRoles:
    """Tests for default roles."""

    def test_default_roles_exist(self):
        """Test that default roles are defined."""
        from app.models.role import DEFAULT_ROLES
        
        assert "admin" in DEFAULT_ROLES
        assert "manager" in DEFAULT_ROLES
        assert "employee" in DEFAULT_ROLES

    def test_admin_has_all_permissions(self):
        """Test that admin role has all permissions."""
        from app.models.role import DEFAULT_ROLES, Permission
        
        admin_perms = set(DEFAULT_ROLES["admin"]["permissions"])
        all_perms = set(p.value for p in Permission)
        
        assert admin_perms == all_perms

    def test_employee_has_limited_permissions(self):
        """Test that employee role has limited permissions."""
        from app.models.role import DEFAULT_ROLES
        
        admin_perms = set(DEFAULT_ROLES["admin"]["permissions"])
        employee_perms = set(DEFAULT_ROLES["employee"]["permissions"])
        
        assert len(employee_perms) < len(admin_perms)

    def test_manager_has_more_permissions_than_employee(self):
        """Test that manager has more permissions than employee."""
        from app.models.role import DEFAULT_ROLES
        
        manager_perms = set(DEFAULT_ROLES["manager"]["permissions"])
        employee_perms = set(DEFAULT_ROLES["employee"]["permissions"])
        
        assert len(manager_perms) > len(employee_perms)
