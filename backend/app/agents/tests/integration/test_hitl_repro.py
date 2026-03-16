import pytest
from unittest.mock import MagicMock, patch
from app.agents.tasks.chat_agent import ChatAgent
from app.models.user import User
from app.models.user_settings import AIDataSharingLevel

@pytest.mark.asyncio
async def test_get_suppliers_loop_repro():
    """
    Reproduces the issue where 'what suppliers do we have' triggers a plan
    instead of just returning the suppliers.
    """
    # Mock dependencies
    mock_db = MagicMock()
    mock_user = User(id="user_123", email="test@example.com")
    
    # Mock Orchestrator.generate_plan to return a plan (simulating current behavior)
    with patch("app.agents.tasks.chat_agent.Orchestrator.generate_plan") as mock_gen_plan:
        mock_gen_plan.return_value = {
            "type": "plan",
            "plan": "1. Check suppliers\n2. Report back\nShall I proceed? [Yes] [No]",
            "agent": "supplier_agent"
        }
        
        agent = ChatAgent(mock_db)
        
        # Act
        result = await agent.run(
            user=mock_user,
            message="what suppliers do we have",
            history=[],
            sharing_level=AIDataSharingLevel.NONE,
            plan_confirmed=False
        )
        
        # Assert - Current BROKEN behavior: it returns a plan
        assert result["type"] == "plan"
        assert "Shall I proceed?" in result["plan"]
        
        # This confirms that for a simple read query, we are getting a plan.
