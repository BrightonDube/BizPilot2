"""Tests for users API endpoints."""


class TestUsersAPI:
    """Tests for users API endpoints."""

    def test_users_api_exists(self):
        """Test that users API module exists."""
        from app.api import users
        assert users is not None

    def test_user_update_schema_exists(self):
        """Test that UserUpdateMe schema exists."""
        from app.api.users import UserUpdateMe
        assert UserUpdateMe is not None

    def test_user_response_schema_exists(self):
        """Test that UserResponseMe schema exists."""
        from app.api.users import UserResponseMe
        assert UserResponseMe is not None

    def test_user_update_schema_fields(self):
        """Test UserUpdateMe schema has required fields."""
        from app.api.users import UserUpdateMe
        
        update = UserUpdateMe(
            first_name="John",
            last_name="Doe",
            phone="1234567890"
        )
        
        assert update.first_name == "John"
        assert update.last_name == "Doe"
        assert update.phone == "1234567890"

    def test_user_update_endpoint_exists(self, client):
        """Test that PUT /users/me endpoint exists (returns 401 without auth)."""
        response = client.put("/api/v1/users/me", json={"first_name": "Test"}, headers={"Authorization": "Bearer dummy"})
        # Should return 401 (unauthorized) not 404 (not found)
        assert response.status_code == 401

    def test_user_get_endpoint_exists(self, client):
        """Test that GET /users/me endpoint exists (returns 401 without auth)."""
        response = client.get("/api/v1/users/me")
        # Should return 401 (unauthorized) not 404 (not found)
        assert response.status_code == 401
