"""
backend/app/agents/tests/conftest.py

Shared pytest fixtures for the agent test suite.
All fixtures mock external dependencies (Groq, Redis, DB) so tests are
deterministic and never hit live services.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from typing import Dict, Optional


# ---------------------------------------------------------------------------
# Mock LLM response
# ---------------------------------------------------------------------------

class MockLLMResponse:
    """Minimal stand-in for app.core.ai_models.LLMResponse."""

    def __init__(self, content: str = "Mock response", tokens: int = 100) -> None:
        self.content = content
        self.model_used = "mock-model"
        self.finish_reason = "stop"
        self.usage = {"total_tokens": tokens, "prompt_tokens": 50, "completion_tokens": 50}


@pytest.fixture
def mock_llm_response():
    """Returns a factory for creating mock LLM responses."""
    def _make(content: str = "Mock response", tokens: int = 100) -> MockLLMResponse:
        return MockLLMResponse(content=content, tokens=tokens)
    return _make


@pytest.fixture
def mock_execute_task(mock_llm_response):
    """Patch execute_task so no real Groq calls are made in unit tests."""
    with patch("app.core.ai_models.execute_task", new_callable=AsyncMock) as mock:
        mock.return_value = mock_llm_response()
        yield mock


@pytest.fixture
def mock_execute_fast_task(mock_llm_response):
    """Patch execute_fast_task for plan generator tests."""
    with patch("app.core.ai_models.execute_fast_task", new_callable=AsyncMock) as mock:
        mock.return_value = mock_llm_response(content="1. Fetch data\n2. Show summary\nShall I proceed? [Yes] [No]")
        yield mock


# ---------------------------------------------------------------------------
# Fake Redis (fakeredis)
# ---------------------------------------------------------------------------

@pytest.fixture
def fake_redis_store():
    """In-memory dict that behaves like our redis_manager for tests."""
    store: Dict[str, str] = {}

    class FakeRedisManager:
        async def get(self, key: str) -> Optional[str]:
            return store.get(key)

        async def set(self, key: str, value: str, ttl_seconds: Optional[int] = None) -> bool:
            store[key] = value
            return True

        async def delete(self, key: str) -> bool:
            store.pop(key, None)
            return True

        def is_available(self) -> bool:
            return True

    return FakeRedisManager(), store


@pytest.fixture(autouse=False)
def patch_redis_manager(fake_redis_store):
    """Replace the global redis_manager with a fake for cache tests."""
    fake_manager, _ = fake_redis_store
    with patch("app.agents.lib.cache_manager.redis_manager", fake_manager):
        yield fake_manager


# ---------------------------------------------------------------------------
# Mock DB session
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_db():
    """A MagicMock that mimics SQLAlchemy Session methods."""
    db = MagicMock()
    db.add = MagicMock()
    db.commit = MagicMock()
    db.rollback = MagicMock()
    db.refresh = MagicMock()
    db.query = MagicMock()
    return db


# ---------------------------------------------------------------------------
# Sample user and business
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_user():
    """Minimal User mock for testing."""
    user = MagicMock()
    user.id = "00000000-0000-0000-0000-000000000001"
    user.email = "test@bizpilot.co.za"
    user.is_superadmin = False
    return user


@pytest.fixture
def sample_business():
    """Minimal Business mock for testing."""
    biz = MagicMock()
    biz.id = "00000000-0000-0000-0000-000000000002"
    biz.name = "Test Restaurant"
    biz.currency = "ZAR"
    biz.industry = "Hospitality"
    return biz


@pytest.fixture
def mock_ai_service(sample_business):
    """Mock AIService._get_business_for_user to return a predictable business."""
    with patch("app.agents.tools.sales_tools.AIService") as mock_cls:
        instance = mock_cls.return_value
        instance._get_business_for_user.return_value = sample_business
        yield instance
