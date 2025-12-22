"""Tests for AI API endpoints."""


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
