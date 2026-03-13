"""
Unit tests for AgentRegistry.

Tests that:
- All agents have required fields
- Every tool in each agent's list exists in the tool registry
- Fetching unknown agent returns None (no crash)
- Model tier is a valid TaskType
"""

from app.agents.agent_registry import registry as agent_registry
from app.agents.tool_registry import registry as tool_registry
from app.core.ai_models import TaskType


def test_all_agents_have_required_fields():
    for name in agent_registry.all_names():
        agent = agent_registry.get(name)
        assert agent.name, f"{name} has no name"
        assert agent.role_description, f"{name} has no role_description"
        assert isinstance(agent.capabilities, list), f"{name} capabilities not a list"
        assert isinstance(agent.constraints, list), f"{name} constraints not a list"
        assert isinstance(agent.tools, list), f"{name} tools not a list"


def test_all_agents_have_valid_model_tier():
    valid_tiers = {TaskType.FAST, TaskType.REASONING, TaskType.SUMMARIZATION, TaskType.FALLBACK}
    for name in agent_registry.all_names():
        agent = agent_registry.get(name)
        assert agent.model_tier in valid_tiers, (
            f"{name} has invalid model_tier: {agent.model_tier}"
        )


def test_all_agent_tools_exist_in_tool_registry():
    for agent_name in agent_registry.all_names():
        agent = agent_registry.get(agent_name)
        for tool_name in agent.tools:
            tool = tool_registry.get(tool_name)
            assert tool is not None, (
                f"Agent '{agent_name}' references tool '{tool_name}' "
                f"which is not registered in tool_registry"
            )


def test_get_nonexistent_agent_returns_none():
    result = agent_registry.get("this_agent_does_not_exist")
    assert result is None


def test_expected_agents_are_registered():
    expected = {"chat_agent", "order_agent", "report_agent", "decision_agent", "operations_agent"}
    registered = set(agent_registry.all_names())
    missing = expected - registered
    assert not missing, f"Expected agents not registered: {missing}"


def test_agent_max_steps_is_positive():
    for name in agent_registry.all_names():
        agent = agent_registry.get(name)
        assert agent.max_steps > 0, f"{name} has max_steps <= 0"


def test_chat_agent_has_at_least_one_tool():
    agent = agent_registry.get("chat_agent")
    assert len(agent.tools) >= 1


def test_order_agent_has_hitl_tools():
    """Order agent must have at least one HITL tool (submit_order_draft)."""
    from app.agents.constants import ActionType
    agent = agent_registry.get("order_agent")
    hitl_tools = [
        t for t in agent.tools
        if tool_registry.get(t) and tool_registry.get(t).action_type == ActionType.HITL
    ]
    assert len(hitl_tools) >= 1, "order_agent should have at least one HITL tool"
