"""
Unit tests for cache_manager.

Tests that:
- System prompts are written and read from Redis with correct keys
- Session memory appends correctly and is user-scoped
- HITL state is saved and retrieved correctly
- Cross-user session isolation is enforced
"""

import json
import pytest
from unittest.mock import patch

from app.agents.lib.cache_manager import (
    get_cached_prompt,
    cache_prompt,
    get_session_memory,
    append_to_session,
    save_hitl_pending,
    get_hitl_pending,
    clear_hitl_pending,
    _prompt_key,
    _session_key,
    _hitl_key,
)
from app.agents.constants import RedisPrefix


# ---------------------------------------------------------------------------
# Key namespacing tests
# ---------------------------------------------------------------------------

def test_prompt_key_includes_agent_name():
    key = _prompt_key("order_agent")
    assert "order_agent" in key
    assert RedisPrefix.PROMPT in key


def test_session_key_includes_user_and_session():
    key = _session_key("user-abc", "session-xyz")
    assert "user-abc" in key
    assert "session-xyz" in key
    assert RedisPrefix.SESSION in key


def test_session_keys_differ_for_different_users():
    key_a = _session_key("user-A", "session-1")
    key_b = _session_key("user-B", "session-1")
    assert key_a != key_b


def test_hitl_key_includes_session_id():
    key = _hitl_key("session-123")
    assert "session-123" in key
    assert RedisPrefix.HITL in key


# ---------------------------------------------------------------------------
# Prompt caching tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cache_prompt_stores_and_retrieves(patch_redis_manager):
    await cache_prompt("chat_agent", "You are BizPilot AI...")
    result = await get_cached_prompt("chat_agent")
    assert result == "You are BizPilot AI..."


@pytest.mark.asyncio
async def test_cache_miss_returns_none(patch_redis_manager):
    result = await get_cached_prompt("nonexistent_agent")
    assert result is None


# ---------------------------------------------------------------------------
# Session memory tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_session_memory_starts_empty(patch_redis_manager):
    memory = await get_session_memory("user-1", "session-1")
    assert memory == []


@pytest.mark.asyncio
async def test_append_message_is_retrievable(patch_redis_manager):
    msg = {"role": "user", "content": "hello"}
    await append_to_session("user-1", "session-1", msg)
    memory = await get_session_memory("user-1", "session-1")
    assert len(memory) == 1
    assert memory[0]["content"] == "hello"


@pytest.mark.asyncio
async def test_user_a_cannot_read_user_b_session(patch_redis_manager):
    await append_to_session("user-A", "shared-session", {"role": "user", "content": "secret"})
    memory_b = await get_session_memory("user-B", "shared-session")
    assert memory_b == []


# ---------------------------------------------------------------------------
# HITL state tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_hitl_state_saved_and_retrieved(patch_redis_manager):
    state = {"tool_name": "submit_order_draft", "tool_args": {"order_id": "123"}}
    await save_hitl_pending("session-abc", state)
    retrieved = await get_hitl_pending("session-abc")
    assert retrieved["tool_name"] == "submit_order_draft"


@pytest.mark.asyncio
async def test_clear_hitl_removes_state(patch_redis_manager):
    await save_hitl_pending("session-del", {"tool_name": "test"})
    await clear_hitl_pending("session-del")
    result = await get_hitl_pending("session-del")
    assert result is None


@pytest.mark.asyncio
async def test_hitl_missing_session_returns_none(patch_redis_manager):
    result = await get_hitl_pending("nonexistent-session")
    assert result is None
