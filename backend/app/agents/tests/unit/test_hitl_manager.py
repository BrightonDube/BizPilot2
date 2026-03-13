"""
Unit tests for hitl_manager.

Tests that:
- pause_for_approval stores state and returns the correct response structure
- reject_hitl clears state and returns a user-readable cancellation
- Expired/missing HITL state is handled gracefully
"""

import pytest

from app.agents.lib.hitl_manager import (
    pause_for_approval,
    get_pending_action,
    reject_hitl,
)


@pytest.mark.asyncio
async def test_pause_for_approval_returns_hitl_request_type(patch_redis_manager):
    result = await pause_for_approval(
        session_id="sess-1",
        agent_name="order_agent",
        tool_name="submit_order_draft",
        tool_args={"order_id": "abc"},
        messages_so_far=[{"role": "user", "content": "Place order"}],
        description="Submit PO-001 to Supplier X",
    )
    assert result["type"] == "hitl_request"
    assert result["pending"] is True
    assert result["session_id"] == "sess-1"
    assert "Submit PO-001" in result["message"]


@pytest.mark.asyncio
async def test_pause_stores_state_in_redis(patch_redis_manager):
    await pause_for_approval(
        session_id="sess-store",
        agent_name="order_agent",
        tool_name="submit_order_draft",
        tool_args={"order_id": "xyz"},
        messages_so_far=[],
        description="Submit order",
    )
    state = await get_pending_action("sess-store")
    assert state is not None
    assert state["tool_name"] == "submit_order_draft"
    assert state["tool_args"]["order_id"] == "xyz"


@pytest.mark.asyncio
async def test_reject_hitl_clears_state(patch_redis_manager):
    await pause_for_approval(
        session_id="sess-reject",
        agent_name="order_agent",
        tool_name="submit_order_draft",
        tool_args={},
        messages_so_far=[],
        description="Test",
    )
    result = await reject_hitl("sess-reject")
    assert result["type"] == "hitl_rejected"
    assert result["pending"] is False
    # State should be gone from Redis
    state = await get_pending_action("sess-reject")
    assert state is None


@pytest.mark.asyncio
async def test_reject_missing_session_returns_error(patch_redis_manager):
    result = await reject_hitl("nonexistent-session")
    assert result["type"] == "error"
    assert "expired" in result["message"].lower() or "not found" in result["message"].lower()


@pytest.mark.asyncio
async def test_two_sessions_do_not_interfere(patch_redis_manager):
    await pause_for_approval(
        session_id="sess-A",
        agent_name="order_agent",
        tool_name="submit_order_draft",
        tool_args={"order_id": "A1"},
        messages_so_far=[],
        description="Order A",
    )
    await pause_for_approval(
        session_id="sess-B",
        agent_name="report_agent",
        tool_name="generate_pdf_report",
        tool_args={"report_type": "daily_sales"},
        messages_so_far=[],
        description="Report B",
    )
    state_a = await get_pending_action("sess-A")
    state_b = await get_pending_action("sess-B")

    assert state_a["tool_name"] == "submit_order_draft"
    assert state_b["tool_name"] == "generate_pdf_report"
    assert state_a != state_b
