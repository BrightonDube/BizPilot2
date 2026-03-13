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

from app.agents.tasks.chat_agent import _detect_agent, ChatAgent
from app.models.user_settings import AIDataSharingLevel


# ---------------------------------------------------------------------------
# Intent detection tests (pure function, no mocking needed)
# ---------------------------------------------------------------------------

def test_detect_order_signals():
    assert _detect_agent("I need to place an order") == "order_agent"
    assert _detect_agent("Create a purchase order for supplier ABC") == "order_agent"


def test_detect_report_signals():
    assert _detect_agent("What were my sales today?") == "report_agent"
    assert _detect_agent("Generate a monthly report") == "report_agent"


def test_detect_decision_signals():
    assert _detect_agent("Should I restock Product X?") == "decision_agent"
    assert _detect_agent("Analyse my revenue trends") == "decision_agent"


def test_detect_operations_signals():
    assert _detect_agent("Create a floor plan for today") == "operations_agent"
    assert _detect_agent("Show me the staff schedule") == "operations_agent"


def test_detect_fallback_to_chat_agent():
    assert _detect_agent("Hello, who are you?") == "chat_agent"
    assert _detect_agent("What can you help me with?") == "chat_agent"


# ---------------------------------------------------------------------------
# ChatAgent.run() tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_run_without_confirm_returns_plan(mock_db, sample_user):
    with patch("app.agents.tasks.chat_agent.Orchestrator") as mock_orch_cls:
        mock_orch = mock_orch_cls.return_value
        mock_orch.generate_plan = AsyncMock(return_value={
            "type": "plan",
            "plan": "1. Fetch data\n2. Show summary\nShall I proceed?",
            "agent": "report_agent",
        })

        agent = ChatAgent(mock_db)
        result = await agent.run(
            user=sample_user,
            message="What were my sales today?",
            history=[],
            sharing_level=AIDataSharingLevel.FULL_BUSINESS,
            session_id="sess-1",
            business_id="biz-1",
            plan_confirmed=False,
        )

        assert result["type"] == "plan"
        mock_orch.generate_plan.assert_called_once()
        mock_orch.run_task.assert_not_called()


@pytest.mark.asyncio
async def test_run_with_confirm_calls_run_task(mock_db, sample_user):
    with patch("app.agents.tasks.chat_agent.Orchestrator") as mock_orch_cls:
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
            plan_confirmed=True,
        )

        assert result["type"] == "response"
        mock_orch.run_task.assert_called_once()
        mock_orch.generate_plan.assert_not_called()


@pytest.mark.asyncio
async def test_run_routes_to_correct_agent(mock_db, sample_user):
    with patch("app.agents.tasks.chat_agent.Orchestrator") as mock_orch_cls:
        mock_orch = mock_orch_cls.return_value
        mock_orch.run_task = AsyncMock(return_value={"type": "response", "message": "Done"})

        agent = ChatAgent(mock_db)
        await agent.run(
            user=sample_user,
            message="Place an order for 50 units of Product X",
            history=[],
            sharing_level=AIDataSharingLevel.FULL_BUSINESS,
            plan_confirmed=True,
        )

        call_kwargs = mock_orch.run_task.call_args
        assert call_kwargs.kwargs["agent_name"] == "order_agent"
