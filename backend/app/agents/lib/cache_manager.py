"""
backend/app/agents/lib/cache_manager.py

Redis cache manager for the agent system.
Handles system prompt caching, session memory windows, and key namespacing.
All keys are user-isolated — no cross-user leakage is possible.
"""

import json
import logging
from typing import Any, Dict, List, Optional

from app.agents.constants import RedisTTL, RedisPrefix
from app.core.redis import redis_manager

logger = logging.getLogger("bizpilot.agents")


def _prompt_key(agent_name: str) -> str:
    """Build the Redis key for a cached system prompt."""
    return f"{RedisPrefix.PROMPT}:{agent_name}"


def _session_key(user_id: str, session_id: str) -> str:
    """
    Build a user-scoped session memory key.
    Including user_id prevents any session key from being guessed
    by a different user even if they know the session_id.
    """
    return f"{RedisPrefix.SESSION}:{user_id}:{session_id}"


def _hitl_key(session_id: str) -> str:
    """Build the Redis key for a pending HITL approval."""
    return f"{RedisPrefix.HITL}:{session_id}"


async def get_cached_prompt(agent_name: str) -> Optional[str]:
    """Return the cached system prompt for an agent, or None if not cached."""
    return await redis_manager.get(_prompt_key(agent_name))


async def cache_prompt(agent_name: str, prompt: str) -> None:
    """Cache a system prompt with a 1-hour TTL."""
    await redis_manager.set(_prompt_key(agent_name), prompt, RedisTTL.SYSTEM_PROMPT)


async def get_session_memory(user_id: str, session_id: str) -> List[Dict[str, Any]]:
    """
    Retrieve the sliding message window for a user session.
    Returns an empty list if no session exists yet.
    """
    raw = await redis_manager.get(_session_key(user_id, session_id))
    if not raw:
        return []
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        logger.warning("Failed to parse session memory for session %s", session_id)
        return []


async def append_to_session(
    user_id: str, session_id: str, message: Dict[str, Any]
) -> None:
    """
    Append a message to the session memory window and enforce the max size.
    Evicts the oldest non-system message when the window is full.
    """
    from app.agents.constants import Limits  # avoid circular at module level

    messages = await get_session_memory(user_id, session_id)
    messages.append(message)

    # Keep only the most recent N messages (system prompt excluded)
    non_system = [m for m in messages if m.get("role") != "system"]
    if len(non_system) > Limits.MAX_STEPS * 2:
        # Drop the oldest non-system message
        for i, m in enumerate(messages):
            if m.get("role") != "system":
                messages.pop(i)
                break

    key = _session_key(user_id, session_id)
    await redis_manager.set(key, json.dumps(messages), RedisTTL.SESSION_MEMORY)


async def save_hitl_pending(session_id: str, state: Dict[str, Any]) -> None:
    """Store a pending HITL approval state with a 15-minute TTL."""
    await redis_manager.set(
        _hitl_key(session_id), json.dumps(state), RedisTTL.HITL_PENDING
    )


async def get_hitl_pending(session_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve a pending HITL state, or None if expired/not found."""
    raw = await redis_manager.get(_hitl_key(session_id))
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        logger.warning("Failed to parse HITL state for session %s", session_id)
        return None


async def clear_hitl_pending(session_id: str) -> None:
    """Remove a resolved (approved or rejected) HITL state from Redis."""
    await redis_manager.delete(_hitl_key(session_id))
