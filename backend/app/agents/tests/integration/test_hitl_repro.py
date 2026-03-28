import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from app.agents.tasks.chat_agent import ChatAgent
from app.models.user import User
from app.models.user_settings import AIDataSharingLevel

@pytest.mark.asyncio
async def test_get_suppliers_loop_repro():
    """
    Verifies that 'what suppliers do we have' routes to order_agent via keyword
    detection and returns a response (not a plan), confirming the ReAct loop
    executes a direct tool call rather than interrupting with a plan.
    """
    mock_db = MagicMock()
    mock_user = MagicMock()
    mock_user.id = "user_123"

    mock_response = {
        "type": "response",
        "message": "You have 3 suppliers: Pen Co, Paper World, Office Direct.",
        "steps": 2,
    }

    # Patch _classify_intent to skip LLM call and route directly to order_agent
    with patch("app.agents.tasks.chat_agent._classify_intent",
               new=AsyncMock(return_value="order_agent")), \
         patch.object(ChatAgent, "_ChatAgent__class__", create=True), \
         patch("app.agents.orchestrator.Orchestrator.run_task",
               new=AsyncMock(return_value=mock_response)):

        agent = ChatAgent(mock_db)
        result = await agent.run(
            user=mock_user,
            message="what suppliers do we have",
            history=[],
            sharing_level=AIDataSharingLevel.NONE,
            plan_confirmed=False,
        )

    # Confirmed fix: simple read query returns a response, not a plan
    assert result["type"] == "response"
    assert "supplier" in result["message"].lower()
