"""Tests for business users API endpoints with department support."""

from uuid import uuid4


class TestBusinessUsersAPI:
    """Tests for business users API endpoints."""

    def test_business_user_response_schema_has_department_fields(self):
        """Test that BusinessUserResponse schema includes department fields."""
        from app.api.business import BusinessUserResponse
        
        # Create a response with department data
        response = BusinessUserResponse(
            id=str(uuid4()),
            user_id=str(uuid4()),
            email="test@example.com",
            first_name="John",
            last_name="Doe",
            role_id=str(uuid4()),
            role_name="Admin",
            department_id=str(uuid4()),
            department={
                "id": str(uuid4()),
                "name": "Sales",
                "description": "Sales team",
                "color": "#FF5733",
                "icon": "chart-line"
            },
            status="active",
            is_primary=True,
            created_at="2024-01-01T00:00:00"
        )
        
        assert response.department_id is not None
        assert response.department is not None
        assert response.department["name"] == "Sales"

    def test_invite_user_request_schema_has_department_id(self):
        """Test that InviteUserRequest schema includes department_id field."""
        from app.api.business import InviteUserRequest
        
        request = InviteUserRequest(
            email="newuser@example.com",
            role_id=str(uuid4()),
            department_id=str(uuid4()),
            first_name="Jane",
            last_name="Smith"
        )
        
        assert request.department_id is not None
        assert request.email == "newuser@example.com"

    def test_update_business_user_request_schema_has_department_id(self):
        """Test that UpdateBusinessUserRequest schema includes department_id field."""
        from app.api.business import UpdateBusinessUserRequest
        
        request = UpdateBusinessUserRequest(
            role_id=str(uuid4()),
            department_id=str(uuid4()),
            status="active"
        )
        
        assert request.department_id is not None
        assert request.status == "active"

    def test_business_user_list_endpoint_exists(self, client):
        """Test that GET /business/users endpoint exists (returns 401 without auth)."""
        response = client.get("/api/v1/business/users")
        # Should return 401 (unauthorized) not 404 (not found)
        assert response.status_code == 401

    def test_business_user_invite_endpoint_exists(self, client):
        """Test that POST /business/users/invite endpoint exists (returns 401 without auth)."""
        response = client.post("/api/v1/business/users/invite", json={
            "email": "test@example.com",
            "role_id": str(uuid4())
        })
        # Should return 401 (unauthorized) not 404 (not found)
        assert response.status_code == 401

    def test_business_user_update_endpoint_exists(self, client):
        """Test that PUT /business/users/{user_id} endpoint exists (returns 401 without auth)."""
        response = client.put(f"/api/v1/business/users/{uuid4()}", json={
            "role_id": str(uuid4())
        })
        # Should return 401 (unauthorized) not 404 (not found)
        assert response.status_code == 401

    def test_business_user_list_accepts_department_filter_param(self, client):
        """Test that GET /business/users accepts department_id query parameter."""
        dept_id = str(uuid4())
        response = client.get(f"/api/v1/business/users?department_id={dept_id}")
        # Should return 401 (unauthorized) not 400 (bad request)
        assert response.status_code == 401

    def test_business_user_list_accepts_search_param(self, client):
        """Test that GET /business/users accepts search query parameter."""
        response = client.get("/api/v1/business/users?search=sales")
        # Should return 401 (unauthorized) not 400 (bad request)
        assert response.status_code == 401

    def test_invite_user_request_allows_optional_department(self):
        """Test that InviteUserRequest allows department_id to be optional."""
        from app.api.business import InviteUserRequest
        
        # Should work without department_id
        request = InviteUserRequest(
            email="newuser@example.com",
            role_id=str(uuid4()),
            first_name="Jane",
            last_name="Smith"
        )
        
        assert request.department_id is None
        assert request.email == "newuser@example.com"

    def test_update_business_user_allows_clearing_department(self):
        """Test that UpdateBusinessUserRequest allows clearing department assignment."""
        from app.api.business import UpdateBusinessUserRequest
        
        # Should allow empty string to clear department
        request = UpdateBusinessUserRequest(
            department_id=""
        )
        
        assert request.department_id == ""
