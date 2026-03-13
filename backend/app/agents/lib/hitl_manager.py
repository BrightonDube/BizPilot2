"""
backend/app/agents/lib/hitl_manager.py

Human-In-The-Loop pause/resume flow.
When an agent hits a HITL tool, it saves the pending action to Redis
and returns to the user. The user approves or rejects via the API.
"""

import logging
from typing import Any, Dict, List, Optional

from app.agents.lib.cache_manager import (
    save_hitl_pending,
    get_hitl_pending,
    clear_hitl_pending,
)
from app.agents.lib.agent_logger import AgentLogger

logger = logging.getLogger("bizpilot.agents")


def build_hitl_state(
    session_id: str,
    agent_name: str,
    tool_name: str,
    tool_args: Dict[str, Any],
    messages_so_far: List[Dict[str, Any]],
    description: str,
) -> Dict[str, Any]:
    """
    Build the state dict that will be stored in Redis for a pending HITL action.
    This contains everything needed to resume the agent after approval.
    """
    return {
        "session_id": session_id,
        "agent_name": agent_name,
        "tool_name": tool_name,
        "tool_args": tool_args,
        # Store the conversation context so resumption has full history
        "messages_so_far": messages_so_far,
        # Plain English description shown to the user in the approval prompt
        "description": description,
    }


async def pause_for_approval(
    session_id: str,
    agent_name: str,
    tool_name: str,
    tool_args: Dict[str, Any],
    messages_so_far: List[Dict[str, Any]],
    description: str,
) -> Dict[str, Any]:
    """
    Save the pending action to Redis and return a response dict for the user.
    The agent stops here. Execution resumes only after approve_hitl() is called.
    """
    state = build_hitl_state(
        session_id=session_id,
        agent_name=agent_name,
        tool_name=tool_name,
        tool_args=tool_args,
        messages_so_far=messages_so_far,
        description=description,
    )
    await save_hitl_pending(session_id, state)
    AgentLogger.hitl_event(session_id, "paused", tool_name)

    return {
        "type": "hitl_request",
        "session_id": session_id,
        "message": (
            f"⏸ **Approval Required**\n\n{description}\n\n"
            "Please confirm to proceed or reject to cancel."
        ),
        "tool_name": tool_name,
        "pending": True,
    }


async def get_pending_action(session_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve the pending HITL state for a session, or None if expired."""
    return await get_hitl_pending(session_id)


async def reject_hitl(session_id: str) -> Dict[str, Any]:
    """
    Cancel a pending HITL action.
    Clears the Redis key and returns a user-readable cancellation message.
    """
    state = await get_hitl_pending(session_id)
    if not state:
        return {
            "type": "error",
            "message": "No pending action found. It may have expired (15-minute timeout).",
        }

    tool_name = state.get("tool_name", "action")
    await clear_hitl_pending(session_id)
    AgentLogger.hitl_event(session_id, "rejected", tool_name)

    return {
        "type": "hitl_rejected",
        "message": f"✗ Action cancelled. The {tool_name} was not executed.",
        "pending": False,
    }
