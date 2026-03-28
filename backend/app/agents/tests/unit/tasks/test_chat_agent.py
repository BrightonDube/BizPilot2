"""
Unit tests for ChatAgent.

Tests:
- Intent routing maps to correct specialist agent
- plan_confirmed=False always returns a plan first
- plan_confirmed=True calls run_task
- Unknown intent falls back to chat_agent
"""

import pytest
from unittest.mock import AsyncMock, patch

from app.agents.tasks.chat_agent import _detect_agent_keywords, ChatAgent
from app.models.user_settings import AIDataSharingLevel


# ---------------------------------------------------------------------------
# Intent detection tests (pure function, no mocking needed)
# ---------------------------------------------------------------------------

def test_detect_order_signals():
    assert _detect_agent_keywords("I need to place an order") == "order_agent"
    assert _detect_agent_keywords("Create a purchase order for supplier ABC") == "order_agent"


def test_detect_report_signals():
    assert _detect_agent_keywords("What were my sales today?") == "report_agent"
    assert _detect_agent_keywords("Generate a monthly report") == "report_agent"


def test_detect_decision_signals():
    assert _detect_agent_keywords("Should I restock Product X?") == "decision_agent"
    # "Analyse my revenue trends" triggers both decision_agent ("analyse") and
    # report_agent ("revenue") — multi-agent chaining is the expected behaviour.
    result = _detect_agent_keywords("Analyse my revenue trends")
    assert "decision_agent" in result


def test_detect_operations_signals():
    assert _detect_agent_keywords("Create a floor plan for today") == "operations_agent"
    assert _detect_agent_keywords("Show me the staff schedule") == "operations_agent"


def test_detect_fallback_to_chat_agent():
    assert _detect_agent_keywords("Hello, who are you?") == "chat_agent"
    assert _detect_agent_keywords("What can you help me with?") == "chat_agent"


# ---------------------------------------------------------------------------
# ChatAgent.run() tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_run_calls_run_task_with_classified_intent(mock_db, sample_user):
    """run() should classify intent then delegate to orchestrator.run_task."""
    with patch("app.agents.tasks.chat_agent._classify_intent", new=AsyncMock(return_value="report_agent")), \
         patch("app.agents.tasks.chat_agent.Orchestrator") as mock_orch_cls:

        mock_orch = mock_orch_cls.return_value
        mock_orch.run_task = AsyncMock(return_value={
            "type": "response",
            "message": "Today's sales: R5,000",
        })

        agent = ChatAgent(mock_db)
        result = await agent.run(
            user=sample_user,
            message="What were my sales today?",
            history=[],
            sharing_level=AIDataSharingLevel.FULL_BUSINESS,
            session_id="sess-1",
            business_id="biz-1",
        )

        assert result["type"] == "response"
        mock_orch.run_task.assert_called_once()
        call_kwargs = mock_orch.run_task.call_args
        assert call_kwargs.kwargs["agent_name"] == "report_agent"


@pytest.mark.asyncio
async def test_run_routes_to_correct_agent(mock_db, sample_user):
    """Intent classification result determines which agent_name is passed to run_task."""
    with patch("app.agents.tasks.chat_agent._classify_intent", new=AsyncMock(return_value="order_agent")), \
         patch("app.agents.tasks.chat_agent.Orchestrator") as mock_orch_cls:

        mock_orch = mock_orch_cls.return_value
        mock_orch.run_task = AsyncMock(return_value={"type": "response", "message": "Done"})

        agent = ChatAgent(mock_db)
        await agent.run(
            user=sample_user,
            message="Place an order for 50 units of Product X",
            history=[],
            sharing_level=AIDataSharingLevel.FULL_BUSINESS,
            session_id="sess-1",
            business_id="biz-1",
        )

        call_kwargs = mock_orch.run_task.call_args
        assert call_kwargs.kwargs["agent_name"] == "order_agent"


@pytest.mark.asyncio
async def test_run_chains_agents_when_intent_is_list(mock_db, sample_user):
    """When _classify_intent returns a list, run() chains multiple run_task calls."""
    with patch("app.agents.tasks.chat_agent._classify_intent",
               new=AsyncMock(return_value=["report_agent", "email_agent"])), \
         patch("app.agents.tasks.chat_agent.Orchestrator") as mock_orch_cls:

        mock_orch = mock_orch_cls.return_value
        mock_orch.run_task = AsyncMock(return_value={"type": "response", "message": "Done"})

        agent = ChatAgent(mock_db)
        await agent.run(
            user=sample_user,
            message="Email me the sales report",
            history=[],
            sharing_level=AIDataSharingLevel.FULL_BUSINESS,
            session_id="sess-1",
            business_id="biz-1",
        )

        assert mock_orch.run_task.call_count == 2
        agents_called = [c.kwargs["agent_name"] for c in mock_orch.run_task.call_args_list]
        assert agents_called == ["report_agent", "email_agent"]
