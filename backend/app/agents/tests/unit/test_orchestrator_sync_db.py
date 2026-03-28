"""
test_orchestrator_sync_db.py

Regression tests for the orchestrator sync-session bug.

Root cause: orchestrator.py called `await self.db.commit()` on a synchronous
SQLAlchemy Session (injected via get_sync_db). Session.commit() is synchronous
and returns None. `await None` raises:
  TypeError: object NoneType can't be used in 'await' expression

Fix: removed all `await` from `self.db.commit()` calls in orchestrator.py.

These tests guard against the regression by confirming:
1. The orchestrator can complete a run_task call without raising TypeError.
2. log_agent_step fails silently when the DB has no agent_logs table.
"""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from uuid import uuid4

from app.agents.lib.observability_logger import log_agent_step


# ---------------------------------------------------------------------------
# Test: log_agent_step fails silently when agent_logs table does not exist
# ---------------------------------------------------------------------------

def test_log_agent_step_silent_on_missing_table():
    """
    When the agent_logs table does not exist, log_agent_step must NOT raise —
    it must log a warning and rollback, then return normally.
    This was broken before the migration chain fix: the table never existed
    in production because migrations were halted at 104_delivery_missing.
    """
    db = MagicMock()
    # Simulate the DB flush raising the "relation does not exist" error
    from sqlalchemy.exc import OperationalError
    db.flush.side_effect = OperationalError("agent_logs", {}, Exception("relation does not exist"))

    # Must not raise
    log_agent_step(
        db=db,
        session_id=str(uuid4()),
        user_id=str(uuid4()),
        business_id=str(uuid4()),
        agent_name="chat_agent",
        step_number=1,
        action_type="HOTL",
        tokens_used=100,
    )

    # The session was added to then rolled back
    db.add.assert_called_once()
    db.rollback.assert_called_once()


def test_log_agent_step_invalid_uuid_returns_early():
    """Bad UUIDs must be rejected silently without touching the DB."""
    db = MagicMock()
    log_agent_step(
        db=db,
        session_id="session-1",
        user_id="not-a-uuid",
        business_id=str(uuid4()),
        agent_name="chat_agent",
        step_number=1,
        action_type="HOTL",
        tokens_used=0,
    )
    db.add.assert_not_called()


# ---------------------------------------------------------------------------
# Test: orchestrator does NOT await db.commit() (sync session safety)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_orchestrator_does_not_await_sync_commit():
    """
    The orchestrator must call self.db.commit() synchronously, NOT await it.
    Before the fix, `await self.db.commit()` caused:
      TypeError: object NoneType can't be used in 'await' expression
    because sync Session.commit() returns None.
    This test uses a MagicMock (sync) db — if the code ever reverts to
    `await self.db.commit()`, the test will raise a TypeError.
    """
    from app.agents.orchestrator import Orchestrator

    # Use a sync MagicMock — commit() returns None, not a coroutine
    db = MagicMock()
    db.commit.return_value = None  # Explicitly sync None

    orchestrator = Orchestrator(db)

    # Mock the LLM call to return a final answer immediately (no tool calls)
    mock_response = MagicMock()
    mock_response.tool_calls = None
    mock_response.content = "Hello, how can I help?"
    mock_response.usage = {"total_tokens": 50}

    mock_user = MagicMock()
    mock_user.id = uuid4()

    with patch("app.agents.orchestrator.execute_task", new=AsyncMock(return_value=mock_response)), \
         patch("app.agents.orchestrator.get_cached_prompt", new=AsyncMock(return_value="system prompt")), \
         patch("app.agents.orchestrator.cache_prompt", new=AsyncMock()), \
         patch("app.agents.orchestrator.log_agent_step"):  # Skip DB write for this test

        from app.models.user_settings import AIDataSharingLevel
        result = await orchestrator.run_task(
            agent_name="chat_agent",
            user=mock_user,
            user_message="Hello",
            session_id=str(uuid4()),
            chat_history=[],
            sharing_level=AIDataSharingLevel.FULL_BUSINESS,
            business_id=str(uuid4()),
        )

    assert result["type"] == "response"
    assert "Hello" in result["message"]

    # Confirm sync commit was called (not awaited — if awaited, TypeError would have fired)
    db.commit.assert_called()
