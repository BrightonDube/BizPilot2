"""Tests for the main application endpoints."""



class TestHealthEndpoint:
    """Tests for the health check endpoint."""

    def test_health_check_returns_200(self, client):
        """Test that health check returns 200 status."""
        response = client.get("/health")
        assert response.status_code == 200

    def test_health_check_returns_healthy_status(self, client):
        """Test that health check returns healthy status."""
        response = client.get("/health")
        data = response.json()
        assert data["status"] == "healthy"

    def test_health_check_returns_version(self, client):
        """Test that health check returns version."""
        response = client.get("/health")
        data = response.json()
        assert data["version"] == "2.0.0"


class TestRootEndpoint:
    """Tests for the root endpoint."""

    def test_root_returns_200(self, client):
        """Test that root endpoint returns 200 status."""
        response = client.get("/")
        assert response.status_code == 200

    def test_root_returns_welcome_message(self, client):
        """Test that root endpoint returns welcome message."""
        response = client.get("/")
        data = response.json()
        assert "Welcome to BizPilot" in data["message"]

    def test_root_includes_docs_link(self, client):
        """Test that root endpoint includes docs link."""
        response = client.get("/")
        data = response.json()
        assert data["docs"] == "/api/docs"


class TestAPIEndpoint:
    """Tests for the API root endpoint."""

    def test_api_root_returns_200(self, client, api_prefix):
        """Test that API root returns 200 status."""
        response = client.get(f"{api_prefix}/")
        assert response.status_code == 200

    def test_api_root_returns_operational_status(self, client, api_prefix):
        """Test that API root returns operational status."""
        response = client.get(f"{api_prefix}/")
        data = response.json()
        assert data["status"] == "operational"
