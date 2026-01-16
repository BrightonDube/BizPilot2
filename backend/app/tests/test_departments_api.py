"""Unit tests for department API endpoints."""

import pytest
import asyncio
from uuid import uuid4
from unittest.mock import Mock, patch, MagicMock, AsyncMock
from fastapi import HTTPException, status

from app.schemas.department import DepartmentCreate, DepartmentUpdate


class TestDepartmentAPIEndpoints:
    """Tests for department API endpoint structure."""

    def test_department_router_exists(self):
        """Test that department router exists."""
        from app.api.departments import router
        assert router is not None

    def test_department_router_has_list_route(self):
        """Test that GET /departments route is defined."""
        from app.api.departments import router
        routes = [r.path for r in router.routes]
        assert "/departments" in routes

    def test_department_router_has_get_route(self):
        """Test that GET /departments/{id} route is defined."""
        from app.api.departments import router
        routes = [r.path for r in router.routes]
        assert any("{department_id}" in route for route in routes)

    def test_department_router_has_create_route(self):
        """Test that POST /departments route is defined."""
        from app.api.departments import router
        routes = [r.path for r in router.routes]
        methods = [m for r in router.routes for m in r.methods]
        assert "POST" in methods

    def test_department_router_has_update_route(self):
        """Test that PUT /departments/{id} route is defined."""
        from app.api.departments import router
        routes = [r.path for r in router.routes]
        methods = [m for r in router.routes for m in r.methods]
        assert "PUT" in methods

    def test_department_router_has_delete_route(self):
        """Test that DELETE /departments/{id} route is defined."""
        from app.api.departments import router
        routes = [r.path for r in router.routes]
        methods = [m for r in router.routes for m in r.methods]
        assert "DELETE" in methods


class TestListDepartmentsEndpoint:
    """Tests for GET /departments endpoint."""

    @pytest.mark.asyncio
    @patch('app.api.departments.DepartmentService')
    @patch('app.api.departments.get_current_active_user')
    @patch('app.api.departments.get_current_business_id')
    async def test_list_departments_with_valid_data(self, mock_business_id, mock_user, mock_service_class):
        """Test listing departments with valid authentication."""
        from app.api.departments import list_departments
        
        # Setup mocks
        mock_user_obj = Mock()
        mock_user_obj.id = uuid4()
        business_id = str(uuid4())
        
        mock_dept = Mock()
        mock_dept.id = uuid4()
        mock_dept.business_id = uuid4()
        mock_dept.name = "Sales"
        mock_dept.description = "Sales team"
        mock_dept.color = "#FF5733"
        mock_dept.icon = "chart-line"
        mock_dept.team_member_count = 5
        mock_dept.created_at = "2024-01-01T00:00:00"
        mock_dept.updated_at = "2024-01-01T00:00:00"
        
        mock_service = Mock()
        mock_service.get_departments.return_value = [mock_dept]
        mock_service_class.return_value = mock_service
        
        # Execute
        result = await list_departments(
            current_user=mock_user_obj,
            db=Mock(),
            business_id=business_id
        )
        
        # Verify
        assert result is not None
        assert len(result.departments) == 1
        assert result.departments[0].name == "Sales"
        mock_service.get_departments.assert_called_once()

    @pytest.mark.asyncio
    @patch('app.api.departments.DepartmentService')
    async def test_list_departments_calls_service_with_correct_params(self, mock_service_class):
        """Test that list_departments calls service with correct parameters."""
        from app.api.departments import list_departments
        
        # Setup
        user_id = uuid4()
        business_id = str(uuid4())
        mock_user = Mock()
        mock_user.id = user_id
        
        mock_service = Mock()
        mock_service.get_departments.return_value = []
        mock_service_class.return_value = mock_service
        
        # Execute
        await list_departments(
            current_user=mock_user,
            db=Mock(),
            business_id=business_id
        )
        
        # Verify service was called with correct UUID conversion
        call_args = mock_service.get_departments.call_args
        assert str(call_args[1]['business_id']) == business_id
        assert call_args[1]['requesting_user_id'] == user_id

    @pytest.mark.asyncio
    @patch('app.api.departments.DepartmentService')
    async def test_list_departments_returns_empty_list(self, mock_service_class):
        """Test listing departments returns empty list when no departments exist."""
        from app.api.departments import list_departments
        
        # Setup
        mock_service = Mock()
        mock_service.get_departments.return_value = []
        mock_service_class.return_value = mock_service
        
        # Execute
        result = await list_departments(
            current_user=Mock(id=uuid4()),
            db=Mock(),
            business_id=str(uuid4())
        )
        
        # Verify
        assert result.departments == []


class TestGetDepartmentEndpoint:
    """Tests for GET /departments/{id} endpoint."""

    @pytest.mark.asyncio
    @patch('app.api.departments.DepartmentService')
    async def test_get_department_with_valid_id(self, mock_service_class):
        """Test getting a department with valid ID."""
        from app.api.departments import get_department
        
        # Setup
        dept_id = str(uuid4())
        mock_dept = Mock()
        mock_dept.id = uuid4()
        mock_dept.business_id = uuid4()
        mock_dept.name = "Marketing"
        mock_dept.description = "Marketing team"
        mock_dept.color = "#00FF00"
        mock_dept.icon = "megaphone"
        mock_dept.team_member_count = 3
        mock_dept.created_at = "2024-01-01T00:00:00"
        mock_dept.updated_at = "2024-01-01T00:00:00"
        
        mock_service = Mock()
        mock_service.get_department.return_value = mock_dept
        mock_service_class.return_value = mock_service
        
        # Execute
        result = await get_department(
            department_id=dept_id,
            current_user=Mock(id=uuid4()),
            db=Mock(),
            business_id=str(uuid4())
        )
        
        # Verify
        assert result.name == "Marketing"
        assert result.description == "Marketing team"

    @pytest.mark.asyncio
    @patch('app.api.departments.DepartmentService')
    async def test_get_department_not_found_raises_404(self, mock_service_class):
        """Test getting non-existent department raises 404."""
        from app.api.departments import get_department
        
        # Setup
        mock_service = Mock()
        mock_service.get_department.return_value = None
        mock_service_class.return_value = mock_service
        
        # Execute & Verify
        with pytest.raises(HTTPException) as exc_info:
            await get_department(
                department_id=str(uuid4()),
                current_user=Mock(id=uuid4()),
                db=Mock(),
                business_id=str(uuid4())
            )
        
        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    @patch('app.api.departments.DepartmentService')
    async def test_get_department_unauthorized_raises_403(self, mock_service_class):
        """Test getting department from another business raises 403."""
        from app.api.departments import get_department
        
        # Setup - service raises 403 for unauthorized access
        mock_service = Mock()
        mock_service.get_department.side_effect = HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this business"
        )
        mock_service_class.return_value = mock_service
        
        # Execute & Verify
        with pytest.raises(HTTPException) as exc_info:
            await get_department(
                department_id=str(uuid4()),
                current_user=Mock(id=uuid4()),
                db=Mock(),
                business_id=str(uuid4())
            )
        
        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN


class TestCreateDepartmentEndpoint:
    """Tests for POST /departments endpoint."""

    @pytest.mark.asyncio
    @patch('app.api.departments.DepartmentService')
    async def test_create_department_with_valid_data(self, mock_service_class):
        """Test creating a department with valid data."""
        from app.api.departments import create_department
        
        # Setup
        dept_data = DepartmentCreate(
            name="Engineering",
            description="Engineering team",
            color="#0000FF",
            icon="code"
        )
        
        mock_dept = Mock()
        mock_dept.id = uuid4()
        mock_dept.business_id = uuid4()
        mock_dept.name = dept_data.name
        mock_dept.description = dept_data.description
        mock_dept.color = dept_data.color
        mock_dept.icon = dept_data.icon
        mock_dept.team_member_count = 0
        mock_dept.created_at = "2024-01-01T00:00:00"
        mock_dept.updated_at = "2024-01-01T00:00:00"
        
        mock_service = Mock()
        mock_service.create_department.return_value = mock_dept
        mock_service_class.return_value = mock_service
        
        # Execute
        result = await create_department(
            data=dept_data,
            current_user=Mock(id=uuid4()),
            db=Mock(),
            business_id=str(uuid4())
        )
        
        # Verify
        assert result.name == "Engineering"
        assert result.team_member_count == 0

    @pytest.mark.asyncio
    @patch('app.api.departments.DepartmentService')
    async def test_create_department_with_minimal_data(self, mock_service_class):
        """Test creating a department with only required fields."""
        from app.api.departments import create_department
        
        # Setup
        dept_data = DepartmentCreate(name="Operations")
        
        mock_dept = Mock()
        mock_dept.id = uuid4()
        mock_dept.business_id = uuid4()
        mock_dept.name = "Operations"
        mock_dept.description = None
        mock_dept.color = None
        mock_dept.icon = None
        mock_dept.team_member_count = 0
        mock_dept.created_at = "2024-01-01T00:00:00"
        mock_dept.updated_at = "2024-01-01T00:00:00"
        
        mock_service = Mock()
        mock_service.create_department.return_value = mock_dept
        mock_service_class.return_value = mock_service
        
        # Execute
        result = await create_department(
            data=dept_data,
            current_user=Mock(id=uuid4()),
            db=Mock(),
            business_id=str(uuid4())
        )
        
        # Verify
        assert result.name == "Operations"
        assert result.description is None

    @pytest.mark.asyncio
    @patch('app.api.departments.DepartmentService')
    async def test_create_department_duplicate_name_raises_400(self, mock_service_class):
        """Test creating department with duplicate name raises 400."""
        from app.api.departments import create_department
        
        # Setup
        dept_data = DepartmentCreate(name="Sales")
        
        mock_service = Mock()
        mock_service.create_department.side_effect = HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Department 'Sales' already exists in this business"
        )
        mock_service_class.return_value = mock_service
        
        # Execute & Verify
        with pytest.raises(HTTPException) as exc_info:
            await create_department(
                data=dept_data,
                current_user=Mock(id=uuid4()),
                db=Mock(),
                business_id=str(uuid4())
            )
        
        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
        assert "already exists" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    @patch('app.api.departments.DepartmentService')
    async def test_create_department_non_owner_raises_403(self, mock_service_class):
        """Test creating department as non-owner raises 403."""
        from app.api.departments import create_department
        
        # Setup
        dept_data = DepartmentCreate(name="HR")
        
        mock_service = Mock()
        mock_service.create_department.side_effect = HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only business owners can manage departments"
        )
        mock_service_class.return_value = mock_service
        
        # Execute & Verify
        with pytest.raises(HTTPException) as exc_info:
            await create_department(
                data=dept_data,
                current_user=Mock(id=uuid4()),
                db=Mock(),
                business_id=str(uuid4())
            )
        
        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN


class TestUpdateDepartmentEndpoint:
    """Tests for PUT /departments/{id} endpoint."""

    @pytest.mark.asyncio
    @patch('app.api.departments.DepartmentService')
    async def test_update_department_with_valid_data(self, mock_service_class):
        """Test updating a department with valid data."""
        from app.api.departments import update_department
        
        # Setup
        dept_id = str(uuid4())
        update_data = DepartmentUpdate(
            name="Sales & Marketing",
            description="Combined sales and marketing team"
        )
        
        mock_dept = Mock()
        mock_dept.id = uuid4()
        mock_dept.business_id = uuid4()
        mock_dept.name = update_data.name
        mock_dept.description = update_data.description
        mock_dept.color = "#FF5733"
        mock_dept.icon = "chart-line"
        mock_dept.team_member_count = 5
        mock_dept.created_at = "2024-01-01T00:00:00"
        mock_dept.updated_at = "2024-01-02T00:00:00"
        
        mock_service = Mock()
        mock_service.update_department.return_value = mock_dept
        mock_service_class.return_value = mock_service
        
        # Execute
        result = await update_department(
            department_id=dept_id,
            data=update_data,
            current_user=Mock(id=uuid4()),
            db=Mock(),
            business_id=str(uuid4())
        )
        
        # Verify
        assert result.name == "Sales & Marketing"
        assert result.description == "Combined sales and marketing team"

    @pytest.mark.asyncio
    @patch('app.api.departments.DepartmentService')
    async def test_update_department_partial_update(self, mock_service_class):
        """Test updating only some fields of a department."""
        from app.api.departments import update_department
        
        # Setup
        dept_id = str(uuid4())
        update_data = DepartmentUpdate(color="#00FF00")
        
        mock_dept = Mock()
        mock_dept.id = uuid4()
        mock_dept.business_id = uuid4()
        mock_dept.name = "Sales"
        mock_dept.description = "Sales team"
        mock_dept.color = "#00FF00"
        mock_dept.icon = "chart-line"
        mock_dept.team_member_count = 5
        mock_dept.created_at = "2024-01-01T00:00:00"
        mock_dept.updated_at = "2024-01-02T00:00:00"
        
        mock_service = Mock()
        mock_service.update_department.return_value = mock_dept
        mock_service_class.return_value = mock_service
        
        # Execute
        result = await update_department(
            department_id=dept_id,
            data=update_data,
            current_user=Mock(id=uuid4()),
            db=Mock(),
            business_id=str(uuid4())
        )
        
        # Verify
        assert result.color == "#00FF00"
        assert result.name == "Sales"  # Unchanged

    @pytest.mark.asyncio
    @patch('app.api.departments.DepartmentService')
    async def test_update_department_not_found_raises_404(self, mock_service_class):
        """Test updating non-existent department raises 404."""
        from app.api.departments import update_department
        
        # Setup
        update_data = DepartmentUpdate(name="New Name")
        
        mock_service = Mock()
        mock_service.update_department.side_effect = HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found"
        )
        mock_service_class.return_value = mock_service
        
        # Execute & Verify
        with pytest.raises(HTTPException) as exc_info:
            await update_department(
                department_id=str(uuid4()),
                data=update_data,
                current_user=Mock(id=uuid4()),
                db=Mock(),
                business_id=str(uuid4())
            )
        
        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.asyncio
    @patch('app.api.departments.DepartmentService')
    async def test_update_department_duplicate_name_raises_400(self, mock_service_class):
        """Test updating department to duplicate name raises 400."""
        from app.api.departments import update_department
        
        # Setup
        update_data = DepartmentUpdate(name="Marketing")
        
        mock_service = Mock()
        mock_service.update_department.side_effect = HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Department 'Marketing' already exists in this business"
        )
        mock_service_class.return_value = mock_service
        
        # Execute & Verify
        with pytest.raises(HTTPException) as exc_info:
            await update_department(
                department_id=str(uuid4()),
                data=update_data,
                current_user=Mock(id=uuid4()),
                db=Mock(),
                business_id=str(uuid4())
            )
        
        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
        assert "already exists" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    @patch('app.api.departments.DepartmentService')
    async def test_update_department_wrong_business_raises_403(self, mock_service_class):
        """Test updating department from another business raises 403."""
        from app.api.departments import update_department
        
        # Setup
        update_data = DepartmentUpdate(name="New Name")
        
        mock_service = Mock()
        mock_service.update_department.side_effect = HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this department"
        )
        mock_service_class.return_value = mock_service
        
        # Execute & Verify
        with pytest.raises(HTTPException) as exc_info:
            await update_department(
                department_id=str(uuid4()),
                data=update_data,
                current_user=Mock(id=uuid4()),
                db=Mock(),
                business_id=str(uuid4())
            )
        
        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.asyncio
    @patch('app.api.departments.DepartmentService')
    async def test_update_department_non_owner_raises_403(self, mock_service_class):
        """Test updating department as non-owner raises 403."""
        from app.api.departments import update_department
        
        # Setup
        update_data = DepartmentUpdate(name="New Name")
        
        mock_service = Mock()
        mock_service.update_department.side_effect = HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only business owners can manage departments"
        )
        mock_service_class.return_value = mock_service
        
        # Execute & Verify
        with pytest.raises(HTTPException) as exc_info:
            await update_department(
                department_id=str(uuid4()),
                data=update_data,
                current_user=Mock(id=uuid4()),
                db=Mock(),
                business_id=str(uuid4())
            )
        
        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN


class TestDeleteDepartmentEndpoint:
    """Tests for DELETE /departments/{id} endpoint."""

    @pytest.mark.asyncio
    @patch('app.api.departments.DepartmentService')
    async def test_delete_department_with_no_members(self, mock_service_class):
        """Test deleting a department with no team members."""
        from app.api.departments import delete_department
        
        # Setup
        dept_id = str(uuid4())
        
        mock_service = Mock()
        mock_service.delete_department.return_value = True
        mock_service_class.return_value = mock_service
        
        # Execute
        result = await delete_department(
            department_id=dept_id,
            current_user=Mock(id=uuid4()),
            db=Mock(),
            business_id=str(uuid4())
        )
        
        # Verify
        assert result is None  # 204 No Content returns None
        mock_service.delete_department.assert_called_once()

    @pytest.mark.asyncio
    @patch('app.api.departments.DepartmentService')
    async def test_delete_department_with_members_raises_409(self, mock_service_class):
        """Test deleting department with team members raises 409."""
        from app.api.departments import delete_department
        
        # Setup
        mock_service = Mock()
        mock_service.delete_department.side_effect = HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete department with 5 assigned team members"
        )
        mock_service_class.return_value = mock_service
        
        # Execute & Verify
        with pytest.raises(HTTPException) as exc_info:
            await delete_department(
                department_id=str(uuid4()),
                current_user=Mock(id=uuid4()),
                db=Mock(),
                business_id=str(uuid4())
            )
        
        assert exc_info.value.status_code == status.HTTP_409_CONFLICT
        assert "assigned team members" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    @patch('app.api.departments.DepartmentService')
    async def test_delete_department_not_found_raises_404(self, mock_service_class):
        """Test deleting non-existent department raises 404."""
        from app.api.departments import delete_department
        
        # Setup
        mock_service = Mock()
        mock_service.delete_department.side_effect = HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found"
        )
        mock_service_class.return_value = mock_service
        
        # Execute & Verify
        with pytest.raises(HTTPException) as exc_info:
            await delete_department(
                department_id=str(uuid4()),
                current_user=Mock(id=uuid4()),
                db=Mock(),
                business_id=str(uuid4())
            )
        
        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.asyncio
    @patch('app.api.departments.DepartmentService')
    async def test_delete_department_wrong_business_raises_403(self, mock_service_class):
        """Test deleting department from another business raises 403."""
        from app.api.departments import delete_department
        
        # Setup
        mock_service = Mock()
        mock_service.delete_department.side_effect = HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this department"
        )
        mock_service_class.return_value = mock_service
        
        # Execute & Verify
        with pytest.raises(HTTPException) as exc_info:
            await delete_department(
                department_id=str(uuid4()),
                current_user=Mock(id=uuid4()),
                db=Mock(),
                business_id=str(uuid4())
            )
        
        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.asyncio
    @patch('app.api.departments.DepartmentService')
    async def test_delete_department_non_owner_raises_403(self, mock_service_class):
        """Test deleting department as non-owner raises 403."""
        from app.api.departments import delete_department
        
        # Setup
        mock_service = Mock()
        mock_service.delete_department.side_effect = HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only business owners can manage departments"
        )
        mock_service_class.return_value = mock_service
        
        # Execute & Verify
        with pytest.raises(HTTPException) as exc_info:
            await delete_department(
                department_id=str(uuid4()),
                current_user=Mock(id=uuid4()),
                db=Mock(),
                business_id=str(uuid4())
            )
        
        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN


class TestDepartmentResponseConversion:
    """Tests for department response conversion."""

    def test_department_to_response_conversion(self):
        """Test converting department model to response schema."""
        from app.api.departments import _department_to_response
        
        # Setup
        mock_dept = Mock()
        mock_dept.id = uuid4()
        mock_dept.business_id = uuid4()
        mock_dept.name = "Finance"
        mock_dept.description = "Finance department"
        mock_dept.color = "#FFD700"
        mock_dept.icon = "dollar-sign"
        mock_dept.team_member_count = 10
        mock_dept.created_at = "2024-01-01T00:00:00"
        mock_dept.updated_at = "2024-01-01T00:00:00"
        
        # Execute
        response = _department_to_response(mock_dept)
        
        # Verify
        assert response.name == "Finance"
        assert response.team_member_count == 10
        assert response.color == "#FFD700"

    def test_department_to_response_without_team_count(self):
        """Test converting department without team_member_count attribute."""
        from app.api.departments import _department_to_response
        
        # Setup
        mock_dept = Mock()
        mock_dept.id = uuid4()
        mock_dept.business_id = uuid4()
        mock_dept.name = "IT"
        mock_dept.description = None
        mock_dept.color = None
        mock_dept.icon = None
        mock_dept.created_at = "2024-01-01T00:00:00"
        mock_dept.updated_at = "2024-01-01T00:00:00"
        # No team_member_count attribute
        del mock_dept.team_member_count
        
        # Execute
        response = _department_to_response(mock_dept)
        
        # Verify - should default to 0
        assert response.team_member_count == 0
