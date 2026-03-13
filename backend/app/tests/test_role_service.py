"""Unit tests for RoleService.

Covers get_role_by_id, get_roles_for_business, get_system_roles,
create_role, update_role, delete_role, assign_role_to_user,
create_system_roles, get_all_permissions, and get_permissions_by_category.
"""

import os
os.environ.setdefault("SECRET_KEY", "test-secret-key-32-bytes-minimum")
os.environ.setdefault("DATABASE_URL", "sqlite:///test.db")

import json
import uuid
from unittest.mock import MagicMock, patch
import pytest

from app.models.role import Role, Permission
from app.models.business_user import BusinessUser
from app.services.role_service import RoleService

ROLE_ID = uuid.uuid4()
BIZ_ID = uuid.uuid4()
USER_ID = uuid.uuid4()


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _chain(first=None, rows=None, count=0):
    """Reusable mock that supports the common SQLAlchemy chained-call pattern."""
    c = MagicMock()
    c.filter.return_value = c
    c.join.return_value = c
    c.outerjoin.return_value = c
    c.group_by.return_value = c
    c.order_by.return_value = c
    c.offset.return_value = c
    c.limit.return_value = c
    c.all.return_value = rows if rows is not None else []
    c.first.return_value = first
    c.count.return_value = count
    c.scalar.return_value = count
    return c


def _make_role(name="Custom Role", is_system=False, business_id=None, permissions=None):
    r = MagicMock(spec=Role)
    r.id = ROLE_ID
    r.name = name
    r.description = "A test role"
    r.business_id = business_id or BIZ_ID
    r.is_system = is_system
    r.permissions = permissions or []
    return r


def _make_business_user():
    bu = MagicMock(spec=BusinessUser)
    bu.user_id = USER_ID
    bu.business_id = BIZ_ID
    bu.role_id = None
    return bu


def _side_effect(chains):
    """Return a query side_effect closure that walks through *chains* in order."""
    counter = {"n": 0}

    def _pick(*_args, **_kwargs):
        idx = counter["n"]
        counter["n"] += 1
        return chains[idx]

    return _pick


# ---------------------------------------------------------------------------
# fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def db():
    return MagicMock()


@pytest.fixture
def svc(db):
    return RoleService(db)


# ===========================================================================
# get_role_by_id
# ===========================================================================

class TestGetRoleById:
    """Tests for RoleService.get_role_by_id."""

    def test_returns_role_when_found(self, svc, db):
        role = _make_role()
        db.query.return_value = _chain(first=role)

        result = svc.get_role_by_id(str(ROLE_ID))
        assert result is role

    def test_returns_none_when_not_found(self, svc, db):
        db.query.return_value = _chain(first=None)

        result = svc.get_role_by_id(str(uuid.uuid4()))
        assert result is None


# ===========================================================================
# get_roles_for_business
# ===========================================================================

class TestGetRolesForBusiness:
    """Tests for RoleService.get_roles_for_business."""

    def test_returns_business_and_system_roles(self, svc, db):
        custom = _make_role(name="Custom")
        system = _make_role(name="Admin", is_system=True)
        db.query.return_value = _chain(rows=[custom, system])

        result = svc.get_roles_for_business(str(BIZ_ID))
        assert len(result) == 2
        assert custom in result
        assert system in result

    def test_returns_empty_list(self, svc, db):
        db.query.return_value = _chain(rows=[])

        result = svc.get_roles_for_business(str(BIZ_ID))
        assert result == []


# ===========================================================================
# get_system_roles
# ===========================================================================

class TestGetSystemRoles:
    """Tests for RoleService.get_system_roles."""

    def test_returns_system_roles(self, svc, db):
        admin = _make_role(name="Admin", is_system=True)
        manager = _make_role(name="Manager", is_system=True)
        db.query.return_value = _chain(rows=[admin, manager])

        result = svc.get_system_roles()
        assert len(result) == 2

    def test_returns_empty_when_none(self, svc, db):
        db.query.return_value = _chain(rows=[])

        result = svc.get_system_roles()
        assert result == []


# ===========================================================================
# create_role
# ===========================================================================

class TestCreateRole:
    """Tests for RoleService.create_role."""

    def test_creates_role_with_correct_fields(self, svc, db):
        perms = ["products:view", "orders:create"]

        svc.create_role(
            name="Sales Rep",
            description="Sales team role",
            permissions=perms,
            business_id=str(BIZ_ID),
        )

        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

        added = db.add.call_args[0][0]
        assert isinstance(added, Role)
        assert added.name == "Sales Rep"
        assert added.description == "Sales team role"
        assert added.business_id == str(BIZ_ID)
        assert added.is_system is False
        assert json.loads(added.permissions) == perms

    def test_creates_role_with_empty_permissions(self, svc, db):
        svc.create_role(
            name="Empty",
            description="No perms",
            permissions=[],
            business_id=str(BIZ_ID),
        )

        added = db.add.call_args[0][0]
        assert json.loads(added.permissions) == []


# ===========================================================================
# update_role
# ===========================================================================

class TestUpdateRole:
    """Tests for RoleService.update_role."""

    def test_updates_name_only(self, svc, db):
        role = _make_role()
        db.query.return_value = _chain(first=role)

        result = svc.update_role(str(ROLE_ID), name="New Name")

        assert result is role
        assert role.name == "New Name"
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(role)

    def test_updates_description_only(self, svc, db):
        role = _make_role()
        db.query.return_value = _chain(first=role)

        result = svc.update_role(str(ROLE_ID), description="Updated desc")

        assert result is role
        assert role.description == "Updated desc"
        db.commit.assert_called_once()

    def test_updates_permissions(self, svc, db):
        role = _make_role()
        db.query.return_value = _chain(first=role)
        new_perms = ["products:view", "orders:view"]

        result = svc.update_role(str(ROLE_ID), permissions=new_perms)

        assert result is role
        role.set_permissions.assert_called_once_with(new_perms)
        db.commit.assert_called_once()

    def test_updates_all_fields(self, svc, db):
        role = _make_role()
        db.query.return_value = _chain(first=role)
        new_perms = ["inventory:view"]

        result = svc.update_role(
            str(ROLE_ID),
            name="Full Update",
            description="All fields",
            permissions=new_perms,
        )

        assert result is role
        assert role.name == "Full Update"
        assert role.description == "All fields"
        role.set_permissions.assert_called_once_with(new_perms)

    def test_returns_none_when_not_found(self, svc, db):
        db.query.return_value = _chain(first=None)

        result = svc.update_role(str(uuid.uuid4()), name="X")
        assert result is None
        db.commit.assert_not_called()

    def test_returns_none_for_system_role(self, svc, db):
        role = _make_role(is_system=True)
        db.query.return_value = _chain(first=role)

        result = svc.update_role(str(ROLE_ID), name="Hacked")
        assert result is None
        db.commit.assert_not_called()

    def test_no_changes_when_all_none(self, svc, db):
        """When no fields are provided, role is still committed (no-op update)."""
        role = _make_role()
        role.name = "Original"
        role.description = "Original desc"
        db.query.return_value = _chain(first=role)

        result = svc.update_role(str(ROLE_ID))

        assert result is role
        # name/description should remain unchanged (falsy None doesn't trigger)
        assert role.name == "Original"
        assert role.description == "Original desc"
        role.set_permissions.assert_not_called()
        db.commit.assert_called_once()

    def test_permissions_empty_list_still_calls_set(self, svc, db):
        """Empty list is not None, so set_permissions should still be called."""
        role = _make_role()
        db.query.return_value = _chain(first=role)

        svc.update_role(str(ROLE_ID), permissions=[])

        role.set_permissions.assert_called_once_with([])


# ===========================================================================
# delete_role
# ===========================================================================

class TestDeleteRole:
    """Tests for RoleService.delete_role."""

    def test_deletes_unused_custom_role(self, svc, db):
        role = _make_role(is_system=False)

        db.query.side_effect = _side_effect([
            _chain(first=role),       # get_role_by_id
            _chain(count=0),          # BusinessUser count
        ])

        result = svc.delete_role(str(ROLE_ID))

        assert result is True
        db.delete.assert_called_once_with(role)
        db.commit.assert_called_once()

    def test_returns_false_when_not_found(self, svc, db):
        db.query.side_effect = _side_effect([
            _chain(first=None),
        ])

        result = svc.delete_role(str(uuid.uuid4()))
        assert result is False
        db.delete.assert_not_called()

    def test_returns_false_for_system_role(self, svc, db):
        role = _make_role(is_system=True)

        db.query.side_effect = _side_effect([
            _chain(first=role),
        ])

        result = svc.delete_role(str(ROLE_ID))
        assert result is False
        db.delete.assert_not_called()

    def test_returns_false_when_role_in_use(self, svc, db):
        role = _make_role(is_system=False)

        db.query.side_effect = _side_effect([
            _chain(first=role),       # get_role_by_id
            _chain(count=3),          # 3 users have this role
        ])

        result = svc.delete_role(str(ROLE_ID))
        assert result is False
        db.delete.assert_not_called()
        db.commit.assert_not_called()


# ===========================================================================
# assign_role_to_user
# ===========================================================================

class TestAssignRoleToUser:
    """Tests for RoleService.assign_role_to_user."""

    def test_assigns_role_successfully(self, svc, db):
        bu = _make_business_user()
        new_role_id = uuid.uuid4()
        db.query.return_value = _chain(first=bu)

        result = svc.assign_role_to_user(
            user_id=str(USER_ID),
            business_id=str(BIZ_ID),
            role_id=str(new_role_id),
        )

        assert result is bu
        assert bu.role_id == str(new_role_id)
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(bu)

    def test_returns_none_when_business_user_not_found(self, svc, db):
        db.query.return_value = _chain(first=None)

        result = svc.assign_role_to_user(
            user_id=str(uuid.uuid4()),
            business_id=str(BIZ_ID),
            role_id=str(uuid.uuid4()),
        )

        assert result is None
        db.commit.assert_not_called()


# ===========================================================================
# create_system_roles
# ===========================================================================

class TestCreateSystemRoles:
    """Tests for RoleService.create_system_roles."""

    @patch("app.services.role_service.DEFAULT_ROLES", {
        "admin": {
            "name": "Admin",
            "description": "Full access",
            "permissions": ["products:view", "orders:view"],
        },
        "employee": {
            "name": "Employee",
            "description": "Basic access",
            "permissions": ["products:view"],
        },
    })
    def test_creates_all_roles_when_none_exist(self, svc, db):
        # Both queries return None (no existing role)
        db.query.return_value = _chain(first=None)

        result = svc.create_system_roles()

        assert len(result) == 2
        assert db.add.call_count == 2
        db.commit.assert_called_once()
        assert db.refresh.call_count == 2

        added_roles = [c[0][0] for c in db.add.call_args_list]
        names = {r.name for r in added_roles}
        assert names == {"Admin", "Employee"}

        for r in added_roles:
            assert r.is_system is True

    @patch("app.services.role_service.DEFAULT_ROLES", {
        "admin": {
            "name": "Admin",
            "description": "Full access",
            "permissions": ["products:view"],
        },
    })
    def test_skips_existing_roles(self, svc, db):
        existing = _make_role(name="Admin", is_system=True)
        db.query.return_value = _chain(first=existing)

        result = svc.create_system_roles()

        assert len(result) == 0
        db.add.assert_not_called()
        db.commit.assert_not_called()

    @patch("app.services.role_service.DEFAULT_ROLES", {
        "admin": {
            "name": "Admin",
            "description": "Full access",
            "permissions": ["products:view"],
        },
        "employee": {
            "name": "Employee",
            "description": "Basic",
            "permissions": ["products:view"],
        },
    })
    def test_creates_only_missing_roles(self, svc, db):
        existing_admin = _make_role(name="Admin", is_system=True)

        # First query (Admin) → found; second query (Employee) → not found
        db.query.side_effect = _side_effect([
            _chain(first=existing_admin),
            _chain(first=None),
        ])

        result = svc.create_system_roles()

        assert len(result) == 1
        db.add.assert_called_once()
        added = db.add.call_args[0][0]
        assert added.name == "Employee"
        db.commit.assert_called_once()

    @patch("app.services.role_service.DEFAULT_ROLES", {})
    def test_empty_default_roles(self, svc, db):
        result = svc.create_system_roles()
        assert result == []
        db.add.assert_not_called()
        db.commit.assert_not_called()

    @patch("app.services.role_service.DEFAULT_ROLES", {
        "admin": {
            "name": "Admin",
            "description": "Full access",
            "permissions": ["products:view", "orders:create"],
        },
    })
    def test_stores_permissions_as_json(self, svc, db):
        db.query.return_value = _chain(first=None)

        svc.create_system_roles()

        added = db.add.call_args[0][0]
        assert json.loads(added.permissions) == ["products:view", "orders:create"]


# ===========================================================================
# get_all_permissions (static)
# ===========================================================================

class TestGetAllPermissions:
    """Tests for RoleService.get_all_permissions (static method)."""

    def test_returns_all_permissions(self):
        result = RoleService.get_all_permissions()

        assert isinstance(result, list)
        assert len(result) == len(Permission)

    def test_each_entry_has_value_and_name(self):
        result = RoleService.get_all_permissions()

        for entry in result:
            assert "value" in entry
            assert "name" in entry
            assert isinstance(entry["value"], str)
            assert isinstance(entry["name"], str)

    def test_contains_known_permission(self):
        result = RoleService.get_all_permissions()
        values = [e["value"] for e in result]
        names = [e["name"] for e in result]

        assert "products:view" in values
        assert "PRODUCTS_VIEW" in names

    def test_format_matches_enum(self):
        result = RoleService.get_all_permissions()
        result_map = {e["name"]: e["value"] for e in result}

        for p in Permission:
            assert p.name in result_map
            assert result_map[p.name] == p.value


# ===========================================================================
# get_permissions_by_category (static)
# ===========================================================================

class TestGetPermissionsByCategory:
    """Tests for RoleService.get_permissions_by_category (static method)."""

    def test_returns_dict_of_categories(self):
        result = RoleService.get_permissions_by_category()

        assert isinstance(result, dict)
        assert len(result) > 0

    def test_known_categories_present(self):
        result = RoleService.get_permissions_by_category()

        expected_categories = {"users", "business", "products", "inventory",
                               "orders", "customers", "suppliers", "invoices",
                               "payments", "reports", "settings", "ai"}
        assert expected_categories.issubset(set(result.keys()))

    def test_each_entry_has_required_fields(self):
        result = RoleService.get_permissions_by_category()

        for category, perms in result.items():
            assert isinstance(perms, list)
            assert len(perms) > 0
            for entry in perms:
                assert "value" in entry
                assert "name" in entry
                assert "action" in entry

    def test_action_extracted_correctly(self):
        result = RoleService.get_permissions_by_category()

        # products category should have view, create, edit, delete
        products = result["products"]
        actions = {e["action"] for e in products}
        assert {"view", "create", "edit", "delete"}.issubset(actions)

    def test_all_permissions_accounted_for(self):
        result = RoleService.get_permissions_by_category()

        total = sum(len(perms) for perms in result.values())
        assert total == len(Permission)

    def test_category_matches_value_prefix(self):
        result = RoleService.get_permissions_by_category()

        for category, perms in result.items():
            for entry in perms:
                assert entry["value"].startswith(category + ":")
