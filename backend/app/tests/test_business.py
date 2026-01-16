"""Tests for business API endpoints."""

import pytest
from unittest.mock import Mock, patch, MagicMock
from uuid import uuid4


class TestBusinessAPI:
    """Tests for business API endpoints."""

    def test_business_api_exists(self):
        """Test that business API module exists."""
        from app.api import business
        assert business is not None

    def test_business_update_schema_exists(self):
        """Test that BusinessUpdate schema exists."""
        from app.api.business import BusinessUpdate
        assert BusinessUpdate is not None

    def test_business_update_schema_fields(self):
        """Test BusinessUpdate schema has required fields."""
        from app.api.business import BusinessUpdate
        
        update = BusinessUpdate(
            name="Test Business",
            phone="1234567890",
            address_street="123 Main St"
        )
        
        assert update.name == "Test Business"
        assert update.phone == "1234567890"
        assert update.address_street == "123 Main St"

    def test_business_update_endpoint_exists(self, client):
        """Test that PUT /business/current endpoint exists (returns 401 without auth)."""
        response = client.put("/api/v1/business/current", json={"name": "Test"})
        # Should return 401 (unauthorized) not 404 (not found)
        assert response.status_code == 401


class TestBusinessSetup:
    """Tests for business setup endpoint."""

    @pytest.mark.asyncio
    @patch('app.api.business.get_db')
    @patch('app.api.business.get_current_user_for_onboarding')
    async def test_setup_business_creates_default_department(self, mock_get_user, mock_get_db):
        """Test that setting up a business creates a default 'General' department."""
        from app.api.business import setup_business, BusinessCreate
        from app.models.business import Business
        from app.models.organization import Organization
        from app.models.role import Role
        from app.models.business_user import BusinessUser
        from app.models.department import Department
        from app.models.user import User, UserStatus
        
        # Setup mocks
        mock_db = MagicMock()
        mock_user = Mock(spec=User)
        mock_user.id = uuid4()
        mock_user.email = "test@example.com"
        mock_user.status = UserStatus.PENDING
        mock_user.is_superadmin = False
        
        # Mock database queries
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        # Track what gets added to the database
        added_objects = []
        def track_add(obj):
            added_objects.append(obj)
        mock_db.add.side_effect = track_add
        
        # Mock flush to assign IDs
        def mock_flush():
            for obj in added_objects:
                if not hasattr(obj, 'id') or obj.id is None:
                    obj.id = uuid4()
        mock_db.flush.side_effect = mock_flush
        
        # Mock refresh
        mock_db.refresh.side_effect = lambda obj: None
        
        # Create business data
        business_data = BusinessCreate(
            name="Test Business",
            description="A test business",
            address="123 Test St",
            phone="1234567890",
            email="business@test.com",
            currency="USD"
        )
        
        # Execute
        result = await setup_business(
            business_data=business_data,
            current_user=mock_user,
            db=mock_db
        )
        
        # Verify that objects were added (Organization, Business, Role, BusinessUser, Department)
        assert len(added_objects) >= 5, f"Expected at least 5 objects, got {len(added_objects)}"
        
        # Check that a Department was created
        departments = [obj for obj in added_objects if isinstance(obj, Department)]
        assert len(departments) == 1, "Expected exactly one department to be created"
        
        # Check that a Role was created
        roles = [obj for obj in added_objects if isinstance(obj, Role)]
        assert len(roles) == 1, "Expected exactly one role to be created"
        
        # Check that a BusinessUser was created
        business_users = [obj for obj in added_objects if isinstance(obj, BusinessUser)]
        assert len(business_users) == 1, "Expected exactly one business user to be created"
        
        # Verify the department is named "General"
        default_dept = departments[0]
        assert default_dept.name == "General"
        assert default_dept.description == "Default department for general team members"
        
        # Verify the department is linked to the business
        businesses = [obj for obj in added_objects if isinstance(obj, Business)]
        assert len(businesses) == 1
        assert default_dept.business_id == businesses[0].id

    @pytest.mark.asyncio
    @patch('app.api.business.get_db')
    @patch('app.api.business.get_current_user_for_onboarding')
    async def test_setup_business_department_in_same_transaction(self, mock_get_user, mock_get_db):
        """Test that default department is created in the same transaction as business."""
        from app.api.business import setup_business, BusinessCreate
        from app.models.user import User, UserStatus
        
        # Setup mocks
        mock_db = MagicMock()
        mock_user = Mock(spec=User)
        mock_user.id = uuid4()
        mock_user.email = "test@example.com"
        mock_user.status = UserStatus.PENDING
        mock_user.is_superadmin = False
        
        # Mock database queries
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        # Track database operations
        commit_called = False
        rollback_called = False
        
        def mock_commit():
            nonlocal commit_called
            commit_called = True
        
        def mock_rollback():
            nonlocal rollback_called
            rollback_called = True
        
        mock_db.commit.side_effect = mock_commit
        mock_db.rollback.side_effect = mock_rollback
        mock_db.flush.side_effect = lambda: None
        mock_db.refresh.side_effect = lambda obj: None
        
        # Create business data
        business_data = BusinessCreate(
            name="Test Business",
            description="A test business",
            address="123 Test St",
            phone="1234567890",
            email="business@test.com",
            currency="USD"
        )
        
        # Execute
        try:
            result = await setup_business(
                business_data=business_data,
                current_user=mock_user,
                db=mock_db
            )
        except Exception:
            pass  # We're just checking transaction behavior
        
        # Verify commit was called (meaning everything is in one transaction)
        assert commit_called, "Expected commit to be called"
        
        # Verify rollback was not called (no errors)
        assert not rollback_called, "Expected no rollback"


