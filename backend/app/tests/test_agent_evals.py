"""
test_agent_evals.py

Evaluation tests for the BizPilot agent system.
Tests intent routing, error propagation, quality scoring, and end-to-end flow.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4


# ---------------------------------------------------------------------------
# IntentClassifier tests
# ---------------------------------------------------------------------------

class TestIntentClassifier:
    """Tests that intent classification routes correctly."""

    def test_greeting_classified_correctly(self):
        from app.agents.intent_classifier import classify_intent, IntentComplexity
        result = classify_intent("hello", {})
        assert result.complexity == IntentComplexity.GREETING
        assert result.primary_agent == "chat_agent"
        assert result.required_tools == []

    def test_greeting_with_context(self):
        from app.agents.intent_classifier import classify_intent, IntentComplexity
        result = classify_intent("hi", {"business_name": "Table Bay General Store"})
        assert result.complexity == IntentComplexity.GREETING

    def test_supplier_query_routes_to_order_agent(self):
        from app.agents.intent_classifier import classify_intent
        result = classify_intent("what suppliers do you have?", {})
        # "supplier" keyword → order_agent
        assert result.primary_agent == "order_agent"

    def test_order_creation_routes_to_order_agent(self):
        from app.agents.intent_classifier import classify_intent
        result = classify_intent("create a purchase order for 10 pens", {})
        assert result.primary_agent == "order_agent"

    def test_order_creation_flagged_as_multi_step(self):
        from app.agents.intent_classifier import classify_intent, IntentComplexity
        result = classify_intent("create a purchase order for 10 pens", {})
        assert result.complexity in (
            IntentComplexity.MULTI_STEP,
            IntentComplexity.COMPLEX_ACTION,
        )

    def test_report_request_routes_to_report_agent(self):
        from app.agents.intent_classifier import classify_intent
        result = classify_intent("show me sales report for this week", {})
        assert result.primary_agent == "report_agent"

    def test_delete_action_requires_confirmation(self):
        from app.agents.intent_classifier import classify_intent
        result = classify_intent("delete all products", {})
        assert result.needs_confirmation is True

    def test_unknown_message_falls_back_to_chat_agent(self):
        from app.agents.intent_classifier import classify_intent
        result = classify_intent("xyzzy nonsense input", {})
        assert result.primary_agent == "chat_agent"


# ---------------------------------------------------------------------------
# Intent routing — keyword fallback (existing ChatAgent function)
# ---------------------------------------------------------------------------

class TestIntentKeywords:
    """Tests for _detect_agent_keywords — no LLM needed."""

    def test_greeting_falls_back_to_chat_agent(self):
        from app.agents.tasks.chat_agent import _detect_agent_keywords
        assert _detect_agent_keywords("hello") == "chat_agent"
        assert _detect_agent_keywords("hi there") == "chat_agent"
        assert _detect_agent_keywords("what can you help me with?") == "chat_agent"

    def test_order_keywords_route_to_order_agent(self):
        from app.agents.tasks.chat_agent import _detect_agent_keywords
        # "send an order" matches both "send" (email) and "order" → multi-agent chain
        result = _detect_agent_keywords("send an order to Brighton for 1 pen")
        assert "order_agent" in result
        # Pure purchase order with no email signal → single agent
        assert _detect_agent_keywords("create purchase order for supplier") == "order_agent"

    def test_report_keywords_route_to_report_agent(self):
        from app.agents.tasks.chat_agent import _detect_agent_keywords
        assert _detect_agent_keywords("show me sales for this week") == "report_agent"

    def test_email_and_report_chain_detected(self):
        from app.agents.tasks.chat_agent import _detect_agent_keywords
        result = _detect_agent_keywords("email me the sales report")
        assert result == ["report_agent", "email_agent"]

    def test_delete_style_message_falls_back_without_crash(self):
        from app.agents.tasks.chat_agent import _detect_agent_keywords
        result = _detect_agent_keywords("delete all products")
        assert isinstance(result, (str, list))

    def test_supplier_query_routes_to_order_agent(self):
        from app.agents.tasks.chat_agent import _detect_agent_keywords
        result = _detect_agent_keywords("what suppliers do you have?")
        assert result == "order_agent"


# ---------------------------------------------------------------------------
# Orchestrator error propagation
# ---------------------------------------------------------------------------

class TestOrchestratorErrorPropagation:
    """Verifies that LLM failures are logged and returned — not silently swallowed."""

    @pytest.mark.asyncio
    async def test_llm_failure_returns_error_type_not_generic(self):
        """
        When execute_task raises, the orchestrator must return {"type": "error"}
        with a user-friendly message. The real error details must NOT be exposed
        to the user — they go to the runtime log only (see test_llm_failure_is_logged).
        """
        from app.agents.orchestrator import Orchestrator

        db = MagicMock()
        db.commit.return_value = None

        orchestrator = Orchestrator(db)

        mock_user = MagicMock()
        mock_user.id = uuid4()

        with patch("app.agents.orchestrator.execute_task",
                   new=AsyncMock(side_effect=Exception("Groq API key invalid: 401"))), \
             patch("app.agents.orchestrator.get_cached_prompt",
                   new=AsyncMock(return_value="system prompt")), \
             patch("app.agents.orchestrator.cache_prompt", new=AsyncMock()), \
             patch("app.agents.orchestrator.log_agent_step"):

            from app.models.user_settings import AIDataSharingLevel
            result = await orchestrator.run_task(
                agent_name="chat_agent",
                user=mock_user,
                user_message="hello",
                session_id=str(uuid4()),
                chat_history=[],
                sharing_level=AIDataSharingLevel.FULL_BUSINESS,
                business_id=str(uuid4()),
            )

        assert result["type"] == "error"
        # User must see a friendly message — NOT the raw exception details.
        # Raw details go to DO runtime logs via logger.error(exc_info=True).
        assert isinstance(result["message"], str)
        assert len(result["message"]) > 0
        # Error details must NOT be exposed to users
        assert "401" not in result["message"]
        assert "Groq API key" not in result["message"]
        assert type(Exception()).__name__ not in result["message"]

    @pytest.mark.asyncio
    async def test_llm_failure_is_logged_with_traceback(self):
        """AgentLogger.error must pass exc_info so DO runtime logs show stack traces."""
        import logging
        from app.agents.lib.agent_logger import AgentLogger

        with patch.object(logging.getLogger("bizpilot.agents"), "error") as mock_log:
            exc = ValueError("test error")
            AgentLogger.error("test message", error=exc)

            mock_log.assert_called_once()
            call_kwargs = mock_log.call_args
            assert call_kwargs.kwargs.get("exc_info") == exc

    @pytest.mark.asyncio
    async def test_orchestrator_run_succeeds_with_no_tool_calls(self):
        """Baseline: clean LLM response returns type=response."""
        from app.agents.orchestrator import Orchestrator
        from app.models.user_settings import AIDataSharingLevel

        db = MagicMock()
        db.commit.return_value = None

        mock_response = MagicMock()
        mock_response.tool_calls = None
        mock_response.content = "Your total sales this week are R 4,250.00."
        mock_response.usage = {"total_tokens": 80}

        mock_user = MagicMock()
        mock_user.id = uuid4()

        with patch("app.agents.orchestrator.execute_task",
                   new=AsyncMock(return_value=mock_response)), \
             patch("app.agents.orchestrator.get_cached_prompt",
                   new=AsyncMock(return_value="system")), \
             patch("app.agents.orchestrator.cache_prompt", new=AsyncMock()), \
             patch("app.agents.orchestrator.log_agent_step"):

            orch = Orchestrator(db)
            result = await orch.run_task(
                agent_name="chat_agent",
                user=mock_user,
                user_message="show me sales",
                session_id=str(uuid4()),
                chat_history=[],
                sharing_level=AIDataSharingLevel.FULL_BUSINESS,
                business_id=str(uuid4()),
            )

        assert result["type"] == "response"
        assert "4,250" in result["message"]
        assert "AI provider error" not in result["message"]


# ---------------------------------------------------------------------------
# End-to-end: ReAct loop with mock tool call
# ---------------------------------------------------------------------------

class TestEndToEndFlow:
    """Tests the full ReAct loop with a mocked tool execution."""

    @pytest.mark.asyncio
    async def test_tool_call_loop_produces_final_answer(self):
        """
        LLM first returns a tool call, then after tool result returns a final answer.
        Verifies the ReAct loop continues after tool execution.
        """
        from app.agents.orchestrator import Orchestrator
        from app.models.user_settings import AIDataSharingLevel
        from app.agents.constants import ActionType

        db = MagicMock()
        db.commit.return_value = None

        mock_user = MagicMock()
        mock_user.id = uuid4()

        first_response = MagicMock()
        first_response.tool_calls = [{
            "id": "call_1",
            "name": "list_suppliers",
            "arguments": {"limit": 10},
        }]
        first_response.content = ""
        first_response.usage = {"total_tokens": 120}

        second_response = MagicMock()
        second_response.tool_calls = None
        second_response.content = "You have 3 suppliers: Pen Co, Paper World, Office Direct."
        second_response.usage = {"total_tokens": 60}

        mock_tool_def = MagicMock()
        mock_tool_def.action_type = ActionType.HOTL
        mock_tool_def.handler = AsyncMock(return_value={
            "suppliers": [
                {"name": "Pen Co"},
                {"name": "Paper World"},
                {"name": "Office Direct"},
            ]
        })

        with patch("app.agents.orchestrator.execute_task",
                   new=AsyncMock(side_effect=[first_response, second_response])), \
             patch("app.agents.orchestrator.get_cached_prompt",
                   new=AsyncMock(return_value="system")), \
             patch("app.agents.orchestrator.cache_prompt", new=AsyncMock()), \
             patch("app.agents.orchestrator.log_agent_step"), \
             patch("app.agents.orchestrator.tool_registry") as mock_tr:

            mock_tr.list_for_agent.return_value = [
                {"type": "function", "function": {"name": "list_suppliers"}}
            ]
            mock_tr.get.return_value = mock_tool_def

            orch = Orchestrator(db)
            result = await orch.run_task(
                agent_name="crm_agent",
                user=mock_user,
                user_message="what suppliers do you have?",
                session_id=str(uuid4()),
                chat_history=[],
                sharing_level=AIDataSharingLevel.FULL_BUSINESS,
                business_id=str(uuid4()),
            )

        assert result["type"] == "response"
        assert "supplier" in result["message"].lower()
        assert "AI provider error" not in result["message"]
        mock_tool_def.handler.assert_called_once()
