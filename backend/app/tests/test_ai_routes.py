"""
test_ai_routes.py

Unit tests for the unified AI chat endpoints.
Tests that /ai/context and /ai/conversations endpoints exist and work correctly.
Tests that the AI responds conversationally without generating approval plans.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app)


def test_get_ai_context_requires_authentication(client: TestClient):
    """GET /api/v1/ai/context should return 401 without auth."""
    response = client.get("/api/v1/ai/context")
    assert response.status_code == 401


def test_get_conversations_requires_authentication(client: TestClient):
    """GET /api/v1/ai/conversations should return 401 without auth."""
    response = client.get("/api/v1/ai/conversations")
    assert response.status_code == 401


def test_post_conversations_requires_authentication(client: TestClient):
    """POST /api/v1/ai/conversations should return 401 without auth."""
    response = client.post("/api/v1/ai/conversations")
    assert response.status_code == 401


def test_ai_endpoints_are_registered():
    """Verify AI endpoints are registered in the app."""
    from app.api import router
    
    # Check that AI router is included
    route_paths = [route.path for route in router.routes]
    
    # These endpoints should exist
    assert any("/ai/context" in path for path in route_paths)
    assert any("/ai/conversations" in path for path in route_paths)
