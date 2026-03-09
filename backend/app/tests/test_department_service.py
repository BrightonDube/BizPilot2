"""Unit tests for DepartmentService.

Covers get_departments, get_department, create_department,
update_department, delete_department, and internal validation helpers.
"""

import os
os.environ.setdefault("SECRET_KEY", "test-secret-key-32-bytes-minimum")
os.environ.setdefault("DATABASE_URL", "sqlite:///test.db")

import uuid
from unittest.mock import MagicMock
import pytest

from app.models.department import Department
from app.models.business_user import BusinessUser
from app.models.user import User
from app.schemas.department import DepartmentCreate, DepartmentUpdate
from app.services.department_service import DepartmentService

BIZ_ID = uuid.uuid4()
DEPT_ID = uuid.uuid4()
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


def _make_user(is_superadmin=False):
    u = MagicMock(spec=User)
    u.id = USER_ID
    u.is_superadmin = is_superadmin
    return u


def _make_business_user(role_name="owner"):
    bu = MagicMock(spec=BusinessUser)
    bu.business_id = BIZ_ID
    bu.user_id = USER_ID
    bu.deleted_at = None
    bu.role = MagicMock()
    bu.role.name = role_name
    return bu


def _make_dept(business_id=None):
    d = MagicMock(spec=Department)
    d.id = DEPT_ID
    d.business_id = business_id or BIZ_ID
    d.name = "Engineering"
    d.description = "Eng team"
    d.color = "#FF5733"
    d.icon = "users"
    d.deleted_at = None
    return d


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
    return DepartmentService(db)


# ===========================================================================
# get_departments
# ===========================================================================

class TestGetDepartments:
    """Tests for DepartmentService.get_departments."""

    def test_returns_departments_for_member(self, svc, db):
        """Non-superadmin member sees departments with team_member_count."""
        user = _make_user(is_superadmin=False)
        bu = _make_business_user("admin")
        dept = _make_dept()

        db.query.side_effect = _side_effect([
            _chain(first=user),            # _validate_business_access → User
            _chain(first=bu),              # _validate_business_access → BusinessUser
            _chain(rows=[(dept, 3)]),       # main query
        ])

        result = svc.get_departments(BIZ_ID, USER_ID)
        assert len(result) == 1
        assert result[0] is dept
        assert result[0].team_member_count == 3

    def test_superadmin_bypasses_access_check(self, svc, db):
        """Superadmin skips BusinessUser lookup."""
        user = _make_user(is_superadmin=True)
        dept = _make_dept()

        db.query.side_effect = _side_effect([
            _chain(first=user),            # _validate_business_access → superadmin
            _chain(rows=[(dept, 0)]),       # main query
        ])

        result = svc.get_departments(BIZ_ID, USER_ID)
        assert len(result) == 1
        assert result[0].team_member_count == 0

    def test_returns_empty_list(self, svc, db):
        """Returns empty list when no departments exist."""
        user = _make_user(is_superadmin=True)

        db.query.side_effect = _side_effect([
            _chain(first=user),
            _chain(rows=[]),
        ])

        result = svc.get_departments(BIZ_ID, USER_ID)
        assert result == []

    def test_access_denied_for_non_member(self, svc, db):
        """Raises 403 when user has no access to business."""
        user = _make_user(is_superadmin=False)

        db.query.side_effect = _side_effect([
            _chain(first=user),
            _chain(first=None),   # no BusinessUser record
        ])

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            svc.get_departments(BIZ_ID, USER_ID)
        assert exc.value.status_code == 403


# ===========================================================================
# get_department
# ===========================================================================

class TestGetDepartment:
    """Tests for DepartmentService.get_department."""

    def test_returns_department_with_count(self, svc, db):
        dept = _make_dept()
        user = _make_user(is_superadmin=True)

        db.query.side_effect = _side_effect([
            _chain(first=user),
            _chain(first=(dept, 5)),
        ])

        result = svc.get_department(DEPT_ID, BIZ_ID, USER_ID)
        assert result is dept
        assert result.team_member_count == 5

    def test_returns_none_when_not_found(self, svc, db):
        user = _make_user(is_superadmin=True)

        db.query.side_effect = _side_effect([
            _chain(first=user),
            _chain(first=None),
        ])

        result = svc.get_department(DEPT_ID, BIZ_ID, USER_ID)
        assert result is None

    def test_access_denied(self, svc, db):
        user = _make_user(is_superadmin=False)

        db.query.side_effect = _side_effect([
            _chain(first=user),
            _chain(first=None),
        ])

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            svc.get_department(DEPT_ID, BIZ_ID, USER_ID)
        assert exc.value.status_code == 403


# ===========================================================================
# create_department
# ===========================================================================

class TestCreateDepartment:
    """Tests for DepartmentService.create_department."""

    def test_creates_department_success(self, svc, db):
        """Owner creates a new department."""
        user = _make_user(is_superadmin=False)
        bu = _make_business_user("owner")
        data = DepartmentCreate(name="Sales", description="Sales team", color="#00FF00", icon="chart-bar")

        db.query.side_effect = _side_effect([
            _chain(first=user),        # _validate_business_owner → User
            _chain(first=bu),          # _validate_business_owner → BusinessUser
            _chain(first=None),        # _exists_by_name → no duplicate
        ])

        result = svc.create_department(BIZ_ID, data, USER_ID)

        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        added = db.add.call_args[0][0]
        assert isinstance(added, Department)
        assert added.name == "Sales"
        assert added.business_id == BIZ_ID
        assert added.team_member_count == 0

    def test_superadmin_creates_department(self, svc, db):
        """Superadmin bypasses owner check."""
        user = _make_user(is_superadmin=True)
        data = DepartmentCreate(name="HR")

        db.query.side_effect = _side_effect([
            _chain(first=user),        # superadmin
            _chain(first=None),        # _exists_by_name
        ])

        result = svc.create_department(BIZ_ID, data, USER_ID)
        db.add.assert_called_once()

    def test_duplicate_name_raises_400(self, svc, db):
        """Raises 400 when department name already exists."""
        user = _make_user(is_superadmin=True)
        existing = _make_dept()
        data = DepartmentCreate(name="Engineering")

        db.query.side_effect = _side_effect([
            _chain(first=user),
            _chain(first=existing),    # _exists_by_name → found
        ])

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            svc.create_department(BIZ_ID, data, USER_ID)
        assert exc.value.status_code == 400
        assert "already exists" in exc.value.detail

    def test_non_owner_forbidden(self, svc, db):
        """Regular member (not owner/admin) cannot create departments."""
        user = _make_user(is_superadmin=False)
        bu = _make_business_user("member")

        db.query.side_effect = _side_effect([
            _chain(first=user),
            _chain(first=bu),
        ])

        data = DepartmentCreate(name="Test")
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            svc.create_department(BIZ_ID, data, USER_ID)
        assert exc.value.status_code == 403

    def test_no_business_user_forbidden(self, svc, db):
        """User with no business_user record cannot create departments."""
        user = _make_user(is_superadmin=False)

        db.query.side_effect = _side_effect([
            _chain(first=user),
            _chain(first=None),        # no BusinessUser
        ])

        data = DepartmentCreate(name="Test")
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            svc.create_department(BIZ_ID, data, USER_ID)
        assert exc.value.status_code == 403


# ===========================================================================
# update_department
# ===========================================================================

class TestUpdateDepartment:
    """Tests for DepartmentService.update_department."""

    def test_update_name_success(self, svc, db):
        """Owner renames a department."""
        user = _make_user(is_superadmin=False)
        bu = _make_business_user("owner")
        dept = _make_dept()
        dept.name = "Old Name"

        data = DepartmentUpdate(name="New Name")

        db.query.side_effect = _side_effect([
            _chain(first=user),        # _validate_business_owner → User
            _chain(first=bu),          # _validate_business_owner → BusinessUser
            _chain(first=dept),        # fetch department
            _chain(first=None),        # _exists_by_name → no duplicate
            _chain(count=2),           # _get_team_member_count
        ])

        result = svc.update_department(DEPT_ID, BIZ_ID, data, USER_ID)
        db.commit.assert_called_once()
        assert result.team_member_count == 2

    def test_update_without_name_change(self, svc, db):
        """Updating fields other than name skips duplicate check."""
        user = _make_user(is_superadmin=True)
        dept = _make_dept()
        dept.name = "Engineering"

        data = DepartmentUpdate(description="Updated desc")

        db.query.side_effect = _side_effect([
            _chain(first=user),        # superadmin
            _chain(first=dept),        # fetch department
            # no _exists_by_name call because name unchanged
            _chain(count=1),           # _get_team_member_count
        ])

        result = svc.update_department(DEPT_ID, BIZ_ID, data, USER_ID)
        assert result.team_member_count == 1

    def test_update_same_name_skips_dup_check(self, svc, db):
        """Setting name to current value skips duplicate check."""
        user = _make_user(is_superadmin=True)
        dept = _make_dept()
        dept.name = "Engineering"

        data = DepartmentUpdate(name="Engineering")

        db.query.side_effect = _side_effect([
            _chain(first=user),
            _chain(first=dept),
            # same name → no _exists_by_name
            _chain(count=0),           # _get_team_member_count
        ])

        result = svc.update_department(DEPT_ID, BIZ_ID, data, USER_ID)
        assert result is dept

    def test_update_not_found(self, svc, db):
        """Raises 404 when department doesn't exist."""
        user = _make_user(is_superadmin=True)
        data = DepartmentUpdate(name="X")

        db.query.side_effect = _side_effect([
            _chain(first=user),
            _chain(first=None),        # department not found
        ])

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            svc.update_department(DEPT_ID, BIZ_ID, data, USER_ID)
        assert exc.value.status_code == 404

    def test_update_wrong_business(self, svc, db):
        """Raises 403 when department belongs to different business."""
        user = _make_user(is_superadmin=True)
        dept = _make_dept(business_id=uuid.uuid4())  # different biz
        data = DepartmentUpdate(name="X")

        db.query.side_effect = _side_effect([
            _chain(first=user),
            _chain(first=dept),
        ])

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            svc.update_department(DEPT_ID, BIZ_ID, data, USER_ID)
        assert exc.value.status_code == 403

    def test_update_duplicate_name_raises_400(self, svc, db):
        """Raises 400 when renaming to an existing name."""
        user = _make_user(is_superadmin=True)
        dept = _make_dept()
        dept.name = "Old"
        existing = _make_dept()
        data = DepartmentUpdate(name="Taken")

        db.query.side_effect = _side_effect([
            _chain(first=user),
            _chain(first=dept),
            _chain(first=existing),    # _exists_by_name → duplicate
        ])

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            svc.update_department(DEPT_ID, BIZ_ID, data, USER_ID)
        assert exc.value.status_code == 400


# ===========================================================================
# delete_department
# ===========================================================================

class TestDeleteDepartment:
    """Tests for DepartmentService.delete_department."""

    def test_delete_success(self, svc, db):
        """Deletes a department with no members."""
        user = _make_user(is_superadmin=True)
        dept = _make_dept()

        db.query.side_effect = _side_effect([
            _chain(first=user),
            _chain(first=dept),        # fetch department
            _chain(count=0),           # _get_team_member_count → 0
        ])

        result = svc.delete_department(DEPT_ID, BIZ_ID, USER_ID)
        assert result is True
        dept.soft_delete.assert_called_once()
        db.commit.assert_called_once()

    def test_delete_with_members_raises_409(self, svc, db):
        """Raises 409 when department has assigned team members."""
        user = _make_user(is_superadmin=True)
        dept = _make_dept()

        db.query.side_effect = _side_effect([
            _chain(first=user),
            _chain(first=dept),
            _chain(count=3),           # 3 members
        ])

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            svc.delete_department(DEPT_ID, BIZ_ID, USER_ID)
        assert exc.value.status_code == 409
        assert "3 assigned team members" in exc.value.detail

    def test_delete_not_found(self, svc, db):
        """Raises 404 when department doesn't exist."""
        user = _make_user(is_superadmin=True)

        db.query.side_effect = _side_effect([
            _chain(first=user),
            _chain(first=None),
        ])

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            svc.delete_department(DEPT_ID, BIZ_ID, USER_ID)
        assert exc.value.status_code == 404

    def test_delete_wrong_business(self, svc, db):
        """Raises 403 when department belongs to different business."""
        user = _make_user(is_superadmin=True)
        dept = _make_dept(business_id=uuid.uuid4())

        db.query.side_effect = _side_effect([
            _chain(first=user),
            _chain(first=dept),
        ])

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            svc.delete_department(DEPT_ID, BIZ_ID, USER_ID)
        assert exc.value.status_code == 403

    def test_delete_owner_required(self, svc, db):
        """Non-owner cannot delete departments."""
        user = _make_user(is_superadmin=False)
        bu = _make_business_user("member")

        db.query.side_effect = _side_effect([
            _chain(first=user),
            _chain(first=bu),
        ])

        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            svc.delete_department(DEPT_ID, BIZ_ID, USER_ID)
        assert exc.value.status_code == 403


# ===========================================================================
# _validate_business_owner (indirectly tested via public methods above,
# but we add focused tests for edge cases)
# ===========================================================================

class TestValidateBusinessOwner:
    """Focused tests for _validate_business_owner edge cases."""

    def test_admin_role_allowed(self, svc, db):
        """Admin role is allowed to manage departments."""
        user = _make_user(is_superadmin=False)
        bu = _make_business_user("Admin")  # mixed case

        db.query.side_effect = _side_effect([
            _chain(first=user),
            _chain(first=bu),
        ])

        # Should NOT raise
        svc._validate_business_owner(BIZ_ID, USER_ID)

    def test_owner_role_allowed(self, svc, db):
        """Owner role is allowed."""
        user = _make_user(is_superadmin=False)
        bu = _make_business_user("Owner")

        db.query.side_effect = _side_effect([
            _chain(first=user),
            _chain(first=bu),
        ])

        svc._validate_business_owner(BIZ_ID, USER_ID)

    def test_user_not_found_still_checks_business_user(self, svc, db):
        """When User record is None, falls through to BusinessUser check."""
        bu = _make_business_user("owner")

        db.query.side_effect = _side_effect([
            _chain(first=None),    # no User record
            _chain(first=bu),      # but BusinessUser exists
        ])

        svc._validate_business_owner(BIZ_ID, USER_ID)
