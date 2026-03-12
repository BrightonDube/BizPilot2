"""
Integration tests for the full HITL pause/resume flow.

Tests the complete lifecycle:
  pause → retrieve pending → approve → clear
  pause → retrieve pending → reject → clear

Uses real hitl_manager + real cache_manager with fake Redis.
"""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock

from app.agents.lib.hitl_manager import pause_for_approval, get_pending_action, reject_hitl
from app.agents.lib.cache_manager import clear_hitl_pending


@pytest.mark.asyncio
async def test_full_approval_flow(patch_redis_manager):
    """Full flow: pause → get_pending → approve (clear) → gone."""
    # 1. Agent pauses for HITL approval
    pause_result = await pause_for_approval(
        session_id="flow-test-1",
        agent_name="order_agent",
        tool_name="submit_order_draft",
        tool_args={"order_id": "order-abc"},
        messages_so_far=[{"role": "user", "content": "Place order"}],
        description="Submit PO-001 to Supplier X for R2,500",
    )

    assert pause_result["type"] == "hitl_request"
    assert pause_result["pending"] is True

    # 2. Frontend polls — pending state is retrievable
    pending = await get_pending_action("flow-test-1")
    assert pending is not None
    assert pending["tool_name"] == "submit_order_draft"
    assert pending["tool_args"]["order_id"] == "order-abc"

    # 3. User approves — caller clears the state
    await clear_hitl_pending("flow-test-1")
    gone = await get_pending_action("flow-test-1")
    assert gone is None


@pytest.mark.asyncio
async def test_full_rejection_flow(patch_redis_manager):
    """Full flow: pause → reject → gone."""
    await pause_for_approval(
        session_id="flow-reject-1",
        agent_name="report_agent",
        tool_name="generate_pdf_report",
        tool_args={"report_type": "daily_sales", "period_start": "2026-03-01", "period_end": "2026-03-12"},
        messages_so_far=[],
        description="Generate March sales PDF",
    )

    reject_result = await reject_hitl("flow-reject-1")
    assert reject_result["type"] == "hitl_rejected"
    assert reject_result["pending"] is False

    # State must be cleared after rejection
    gone = await get_pending_action("flow-reject-1")
    assert gone is None


@pytest.mark.asyncio
async def test_concurrent_sessions_isolated(patch_redis_manager):
    """Two users running HITL flows simultaneously must not interfere."""
    await pause_for_approval(
        session_id="user-A-session",
        agent_name="order_agent",
        tool_name="submit_order_draft",
        tool_args={"order_id": "A1"},
        messages_so_far=[],
        description="User A's order",
    )
    await pause_for_approval(
        session_id="user-B-session",
        agent_name="report_agent",
        tool_name="generate_pdf_report",
        tool_args={"report_type": "monthly_summary"},
        messages_so_far=[],
        description="User B's report",
    )

    # Reject user A — user B's state unaffected
    await reject_hitl("user-A-session")

    state_b = await get_pending_action("user-B-session")
    assert state_b is not None
    assert state_b["tool_name"] == "generate_pdf_report"


@pytest.mark.asyncio
async def test_approval_of_expired_session(patch_redis_manager):
    """Approving a session that was never created returns an error."""
    result = await reject_hitl("never-existed")
    assert result["type"] == "error"
