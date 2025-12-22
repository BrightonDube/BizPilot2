"""Tests for business API endpoints."""


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
