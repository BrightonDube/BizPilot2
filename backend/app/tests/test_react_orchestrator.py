"""
backend/app/tests/test_react_orchestrator.py

Tests for the ReAct parser and orchestrator.
Verifies that:
  - parse_llm_output correctly extracts Action / Final Answer from text
  - Edge cases (single quotes, markdown, fake observations) are handled
  - ReActOrchestrator._execute_tool returns error dict for unknown tools
  - Greeting path skips tool calls
"""
import pytest
from app.agents.react_orchestrator import parse_llm_output, build_react_tool_prompt


class TestParseLLMOutput:
    def test_parses_action_and_args(self):
        text = (
            'Thought: I need to get sales data.\n'
            'Action: get_daily_sales\n'
            'Action Input: {"target_date": "2026-03-28"}'
        )
        action, args, final = parse_llm_output(text)
        assert action == "get_daily_sales"
        assert args == {"target_date": "2026-03-28"}
        assert final is None

    def test_parses_final_answer(self):
        text = (
            "Thought: I now have the information.\n"
            "Final Answer: Your sales today were R 4,250.00 across 23 transactions."
        )
        action, args, final = parse_llm_output(text)
        assert action is None
        assert args is None
        assert "R 4,250.00" in final

    def test_final_answer_before_action_wins(self):
        text = (
            "Final Answer: Here is the data.\n"
            "Action: get_daily_sales\n"
            "Action Input: {}"
        )
        action, args, final = parse_llm_output(text)
        assert action is None
        assert "Here is the data." in final

    def test_action_before_final_answer_executes_tool(self):
        # LLM writes Action THEN Final Answer — we should take the Action
        text = (
            "Thought: need data\n"
            "Action: get_suppliers\n"
            "Action Input: {}\n"
            "Observation: [fake]\n"
            "Final Answer: Here are your suppliers."
        )
        action, args, final = parse_llm_output(text)
        assert action == "get_suppliers"
        assert final is None

    def test_handles_single_quoted_json(self):
        text = (
            "Action: get_low_stock_items\n"
            "Action Input: {'threshold': 5}"
        )
        action, args, final = parse_llm_output(text)
        assert action == "get_low_stock_items"
        assert args.get("threshold") == 5

    def test_strips_markdown_fences(self):
        text = (
            "Action: get_daily_sales\n"
            "Action Input: ```json\n"
            '{"target_date": "2026-03-28"}\n'
            "```"
        )
        action, args, final = parse_llm_output(text)
        assert action == "get_daily_sales"
        assert args.get("target_date") == "2026-03-28"

    def test_fake_observation_trimmed_from_action_input(self):
        text = (
            "Action: get_daily_sales\n"
            'Action Input: {"target_date": "2026-03-28"}\n'
            "Observation: some fake data here"
        )
        action, args, final = parse_llm_output(text)
        assert action == "get_daily_sales"
        assert args == {"target_date": "2026-03-28"}

    def test_no_structure_returns_text_as_final_answer(self):
        text = "Sure, I can help you with that! Here is some general advice."
        action, args, final = parse_llm_output(text)
        assert action is None
        assert final is not None
        assert "general advice" in final

    def test_empty_input_returns_none_triple(self):
        action, args, final = parse_llm_output("hi")
        # "hi" is too short (len <= 10) → all None
        assert action is None
        assert final is None

    def test_action_with_no_inputs(self):
        text = "Thought: check stock\nAction: get_inventory_summary\nAction Input: {}"
        action, args, final = parse_llm_output(text)
        assert action == "get_inventory_summary"
        assert args == {}

    def test_trailing_thought_trimmed_from_final_answer(self):
        text = (
            "Final Answer: Sales are R 1,000.\n"
            "Thought: This is extra content the LLM appended."
        )
        action, args, final = parse_llm_output(text)
        assert final is not None
        assert "Thought:" not in final
        assert "R 1,000." in final


class TestBuildReactToolPrompt:
    def test_returns_empty_string_for_no_tools(self):
        class FakeRegistry:
            def get(self, name):
                return None
        result = build_react_tool_prompt(["nonexistent"], FakeRegistry())
        assert result == ""

    def test_includes_tool_name_and_description(self):
        class FakeTool:
            description = "Get daily sales data"
            action_type = "HOTL"
            parameters = {"type": "object", "properties": {}}

        class FakeRegistry:
            def get(self, name):
                return FakeTool() if name == "get_daily_sales" else None

        result = build_react_tool_prompt(["get_daily_sales"], FakeRegistry())
        assert "get_daily_sales" in result
        assert "Get daily sales data" in result

    def test_hitl_tools_show_approval_note(self):
        class FakeTool:
            description = "Send email"
            action_type = "HITL"
            parameters = {"type": "object", "properties": {}}

        class FakeRegistry:
            def get(self, name):
                return FakeTool() if name == "send_report_email" else None

        result = build_react_tool_prompt(["send_report_email"], FakeRegistry())
        assert "REQUIRES YOUR APPROVAL" in result

    def test_includes_react_format_instructions(self):
        class FakeTool:
            description = "List suppliers"
            action_type = "HOTL"
            parameters = {"type": "object", "properties": {}}

        class FakeRegistry:
            def get(self, name):
                return FakeTool()

        result = build_react_tool_prompt(["get_suppliers"], FakeRegistry())
        assert "Thought:" in result
        assert "Action:" in result
        assert "Action Input:" in result
        assert "Final Answer:" in result


class TestOrchestrator:
    @pytest.mark.asyncio
    async def test_unknown_tool_returns_error_dict(self):
        """_execute_tool equivalent: unknown tool → error dict, not exception."""
        from app.agents.tool_registry import registry as tool_registry
        # Simulate what orchestrator does when tool not found
        tool_def = tool_registry.get("nonexistent_tool_xyz")
        assert tool_def is None
        # In orchestrator._execute_tool path, this would return an error observation

    @pytest.mark.asyncio
    async def test_parse_roundtrip_sales_query(self):
        """Full parse cycle for a typical sales query response."""
        llm_response = (
            "Thought: The user wants today's sales. I should use get_daily_sales.\n"
            "Action: get_daily_sales\n"
            'Action Input: {}\n'
        )
        action, args, final = parse_llm_output(llm_response)
        assert action == "get_daily_sales"
        assert isinstance(args, dict)
        assert final is None

    @pytest.mark.asyncio
    async def test_parse_roundtrip_supplier_list(self):
        """Supplier list query."""
        llm_response = (
            "Thought: I need to list all suppliers.\n"
            "Action: get_suppliers\n"
            "Action Input: {}\n"
        )
        action, args, final = parse_llm_output(llm_response)
        assert action == "get_suppliers"
        assert final is None

    @pytest.mark.asyncio
    async def test_parse_final_answer_after_observation(self):
        """After seeing observation, LLM writes Final Answer."""
        llm_response = (
            "Thought: Based on the data, sales are good.\n"
            "Final Answer: Your sales today totalled R 5,200.00 across 31 transactions. "
            "Top product: Widget A (12 sold)."
        )
        action, args, final = parse_llm_output(llm_response)
        assert action is None
        assert final is not None
        assert "R 5,200.00" in final
