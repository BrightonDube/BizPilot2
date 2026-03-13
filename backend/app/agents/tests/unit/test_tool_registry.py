"""
Unit tests for ToolRegistry.

Tests that:
- All registered tools have required fields
- Every tool has a HITL/HOTL classification and risk level
- Fetching a non-existent tool returns None (no crash)
- list_for_agent returns correct OpenAI format
"""

from app.agents.tool_registry import registry
from app.agents.constants import ActionType, RiskLevel


def test_all_tools_have_name_and_description():
    for name in registry.all_names():
        tool = registry.get(name)
        assert tool.name, f"{name} has no name"
        assert tool.description, f"{name} has no description"


def test_all_tools_have_action_type():
    valid = {ActionType.HOTL, ActionType.HITL}
    for name in registry.all_names():
        tool = registry.get(name)
        assert tool.action_type in valid, f"{name} has invalid action_type: {tool.action_type}"


def test_all_tools_have_risk_level():
    valid = {RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL}
    for name in registry.all_names():
        tool = registry.get(name)
        assert tool.risk_level in valid, f"{name} has invalid risk_level: {tool.risk_level}"


def test_hitl_tools_have_hitl_description():
    for name in registry.all_names():
        tool = registry.get(name)
        if tool.action_type == ActionType.HITL:
            assert tool.hitl_description, f"HITL tool {name} missing hitl_description"


def test_get_nonexistent_tool_returns_none():
    result = registry.get("this_tool_does_not_exist")
    assert result is None


def test_list_for_agent_returns_openai_format():
    tools = registry.list_for_agent(["get_daily_sales"])
    assert len(tools) == 1
    assert tools[0]["type"] == "function"
    assert "name" in tools[0]["function"]
    assert tools[0]["function"]["name"] == "get_daily_sales"


def test_list_for_agent_skips_missing_tools():
    tools = registry.list_for_agent(["get_daily_sales", "nonexistent_tool"])
    assert len(tools) == 1
    assert tools[0]["function"]["name"] == "get_daily_sales"


def test_list_for_agent_empty_list_returns_empty():
    tools = registry.list_for_agent([])
    assert tools == []


def test_all_tools_have_callable_handler():
    for name in registry.all_names():
        tool = registry.get(name)
        assert callable(tool.handler), f"{name} handler is not callable"


def test_to_openai_format_has_parameters():
    tool = registry.get("get_daily_sales")
    fmt = tool.to_openai_format()
    assert "parameters" in fmt["function"]
    assert fmt["function"]["parameters"]["type"] == "object"
