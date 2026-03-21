"""
test_ai_routes.py

Unit tests for the unified AI chat endpoints.
Tests that /ai/context and /ai/conversations endpoints exist and work correctly.
Tests that the AI responds conversationally without generating approval plans.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.user import User
from app.services.ai_service import AIService


@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app)


@pytest.fixture
def authenticated_headers(db: Session):
    """Create a test user and return auth headers."""
    # This assumes you have a test user creation helper
    # Adjust based on your actual test setup
    from app.tests.conftest import create_test_user, get_test_token
    
    user = create_test_user(db)
    token = get_test_token(user)
    return {"Authorization": f"Bearer {token}"}


def test_get_ai_context_returns_200_for_authenticated_user(
    client: TestClient, authenticated_headers: dict
):
    """GET /api/v1/ai/context should return 200 for authenticated user."""
    response = client.get("/api/v1/ai/context", headers=authenticated_headers)
    assert response.status_code == 200
    data = response.json()
    assert "ai_data_sharing_level" in data
    assert "app_context" in data
    assert "business_context" in data


def test_get_ai_context_requires_authentication(client: TestClient):
    """GET /api/v1/ai/context should return 401 without auth."""
    response = client.get("/api/v1/ai/context")
    assert response.status_code == 401


def test_get_conversations_returns_200_for_authenticated_user(
    client: TestClient, authenticated_headers: dict
):
    """GET /api/v1/ai/conversations should return 200 for authenticated user."""
    response = client.get("/api/v1/ai/conversations", headers=authenticated_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_post_conversations_creates_new_conversation(
    client: TestClient, authenticated_headers: dict
):
    """POST /api/v1/ai/conversations should create a new conversation."""
    response = client.post("/api/v1/ai/conversations", headers=authenticated_headers)
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert "title" in data


def test_send_message_hello_returns_conversational_response(
    client: TestClient, authenticated_headers: dict, monkeypatch
):
    """
    POST /api/v1/ai/conversations/{id}/messages with 'hello' should return
    a conversational response, NOT a plan.
    """
    # Mock the agent to return a simple greeting
    async def mock_agent_run(*args, **kwargs):
        return {
            "type": "response",
            "message": "Hello! How can I help you today?",
        }
    
    from app.agents.tasks import chat_agent
    monkeypatch.setattr(chat_agent.ChatAgent, "run", mock_agent_run)
    
    # Create conversation first
    conv_response = client.post("/api/v1/ai/conversations", headers=authenticated_headers)
    conversation_id = conv_response.json()["id"]
    
    # Send hello message
    response = client.post(
        f"/api/v1/ai/conversations/{conversation_id}/messages",
        headers=authenticated_headers,
        json={"content": "hello"},
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["is_user"] is False
    assert "Hello" in data["content"] or "hello" in data["content"].lower()


def test_hello_response_does_not_contain_approval_keywords(
    client: TestClient, authenticated_headers: dict, monkeypatch
):
    """
    Response for 'hello' should NOT contain approval-related keywords.
    """
    async def mock_agent_run(*args, **kwargs):
        return {
            "type": "response",
            "message": "Hello! How can I help you today?",
        }
    
    from app.agents.tasks import chat_agent
    monkeypatch.setattr(chat_agent.ChatAgent, "run", mock_agent_run)
    
    conv_response = client.post("/api/v1/ai/conversations", headers=authenticated_headers)
    conversation_id = conv_response.json()["id"]
    
    response = client.post(
        f"/api/v1/ai/conversations/{conversation_id}/messages",
        headers=authenticated_headers,
        json={"content": "hello"},
    )
    
    assert response.status_code == 200
    content = response.json()["content"]
    
    # These strings should NOT appear in a greeting response
    forbidden_phrases = [
        "REQUIRES YOUR APPROVAL",
        "execution plan",
        "Shall I proceed",
        "Step 1:",
        "Step 2:",
        "[Yes] [No]",
    ]
    
    for phrase in forbidden_phrases:
        assert phrase not in content, f"Response should not contain '{phrase}'"


def test_ai_service_creates_user_settings_if_not_exist(db: Session):
    """AIService should create user settings if they don't exist."""
    from app.tests.conftest import create_test_user
    
    user = create_test_user(db)
    ai_service = AIService(db)
    
    settings = ai_service.get_or_create_user_settings(user.id)
    
    assert settings is not None
    assert settings.user_id == user.id
    assert settings.ai_data_sharing_level is not None
