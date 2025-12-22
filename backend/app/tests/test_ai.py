"""Tests for AI API endpoints."""

from types import SimpleNamespace


class TestAIAPI:
    def test_ai_chat_endpoint_exists(self, client):
        response = client.post("/api/v1/ai/chat", json={"message": "hi"})
        assert response.status_code == 401

    def test_ai_conversations_list_exists(self, client):
        response = client.get("/api/v1/ai/conversations")
        assert response.status_code == 401

    def test_ai_conversations_create_exists(self, client):
        response = client.post("/api/v1/ai/conversations", json={"title": "Test"})
        assert response.status_code == 401

    def test_ai_messages_list_exists(self, client):
        response = client.get("/api/v1/ai/conversations/00000000-0000-0000-0000-000000000000/messages")
        assert response.status_code == 401

    def test_ai_context_exists(self, client):
        response = client.get("/api/v1/ai/context")
        assert response.status_code == 401

    def test_ai_chat_returns_clear_4xx_when_unconfigured(self, client, monkeypatch):
        from app.api.deps import get_current_active_user
        from app.main import app
        from app.core import config as config_mod

        # Override auth so we can reach the handler
        app.dependency_overrides[get_current_active_user] = lambda: SimpleNamespace(id="u1")

        # Force unconfigured state
        monkeypatch.setattr(config_mod.settings, "GROQ_API_KEY", None, raising=False)
        monkeypatch.setattr(config_mod.settings, "OPENAI_API_KEY", None, raising=False)

        try:
            resp = client.post("/api/v1/ai/chat", json={"message": "hi"})
            assert resp.status_code == 400
            body = resp.json()
            assert "detail" in body
            assert "GROQ_API_KEY" in body["detail"]
        finally:
            app.dependency_overrides.pop(get_current_active_user, None)


class TestUserSettingsAPI:
    def test_user_settings_get_exists(self, client):
        response = client.get("/api/v1/users/me/settings")
        assert response.status_code == 401

    def test_user_settings_update_exists(self, client):
        response = client.put(
            "/api/v1/users/me/settings",
            json={"ai_data_sharing_level": "none"},
        )
        assert response.status_code == 401
