"""
backend/app/agents/react_orchestrator.py

ReAct agent utilities: output parser and tool prompt builder.

The ReAct pattern (Reason + Act):
  LLM writes: Thought → Action → Action Input
  Python parses the text, executes the tool directly, injects Observation
  Loop continues until LLM writes Final Answer

Groq is used ONLY for text generation — no tools= parameter.
Tool execution happens 100% in Python by calling handler functions directly.

Based on proven open-source implementations:
  - github.com/mattambrogi/agent-implementation
  - github.com/pguso/ai-agents-from-scratch
"""
import re
import json
import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("bizpilot.agents")


def parse_llm_output(
    text: str,
) -> Tuple[Optional[str], Optional[Dict[str, Any]], Optional[str]]:
    """
    Parse LLM ReAct output.

    Returns (action_name, action_args_dict, final_answer).
    - If action_name is set: execute that tool with action_args_dict
    - If final_answer is set: return it to the user
    - Both None: treat full response text as final answer

    Handles common LLM quirks: markdown fences, single-quoted JSON,
    fake Observations the LLM writes before stopping.
    """
    # Strip markdown code fences that LLMs sometimes wrap around JSON
    text = text.strip()
    text = re.sub(r"```json\s*", "", text)
    text = re.sub(r"```\s*", "", text)

    # Find the first occurrence of "Action:" and "Final Answer:"
    # We look for FIRST Action to handle cases where the LLM writes
    # Action → Observation → Final Answer all in one shot.
    action_match = re.search(
        r"Action:\s*([a-zA-Z_][a-zA-Z0-9_]*)",
        text,
        re.IGNORECASE,
    )
    final_match = re.search(
        r"Final Answer:\s*(.+)",
        text,
        re.DOTALL | re.IGNORECASE,
    )

    action_pos = action_match.start() if action_match else len(text)
    final_pos = final_match.start() if final_match else len(text)

    # Final Answer appears before any Action → return it directly
    if final_match and final_pos <= action_pos:
        answer = final_match.group(1).strip()
        # Trim trailing Thought: blocks the LLM appended after Final Answer
        stop_idx = re.search(r"\nThought:", answer)
        if stop_idx:
            answer = answer[: stop_idx.start()].strip()
        return None, None, answer

    # Action found → parse name and inputs
    if action_match:
        action_name = action_match.group(1).strip()

        # Action Input appears after the Action line
        text_after_action = text[action_match.start():]
        input_match = re.search(
            r"Action Input:\s*(\{.*?\}|\[[^\]]*\]|\"[^\"]*\"|[^\n]+)",
            text_after_action,
            re.DOTALL | re.IGNORECASE,
        )

        action_args: Dict[str, Any] = {}
        if input_match:
            raw = input_match.group(1).strip()
            # Trim at Observation: if LLM wrote a fake one before stopping
            obs_idx = raw.find("Observation:")
            if obs_idx != -1:
                raw = raw[:obs_idx].strip()
            # Try JSON parse, then single-quote fix, then fallback
            try:
                action_args = json.loads(raw)
            except json.JSONDecodeError:
                try:
                    action_args = json.loads(raw.replace("'", '"'))
                except json.JSONDecodeError:
                    action_args = {"input": raw}

        return action_name, action_args, None

    # No structured output at all → treat the whole text as the final answer
    if text and len(text) > 10:
        return None, None, text
    return None, None, None


def build_react_tool_prompt(tool_names: List[str], tool_registry: Any) -> str:
    """
    Build the tool-description block that is appended to the system prompt.

    This teaches the LLM:
    1. Which tools are available and what they do
    2. The exact Thought/Action/Action Input/Observation/Final Answer format
    3. HITL tools that require user approval before execution

    The LLM reads this and knows exactly what text to produce.
    No JSON schema needed — plain English descriptions are enough.
    """
    tool_lines: List[str] = []
    for name in tool_names:
        tool_def = tool_registry.get(name)
        if not tool_def:
            continue
        param_desc = _format_params(tool_def.parameters)
        hitl_note = " [REQUIRES YOUR APPROVAL before execution]" if tool_def.action_type == "HITL" else ""
        line = f"- {name}: {tool_def.description}{hitl_note}"
        if param_desc:
            line += f"\n  Inputs: {param_desc}"
        tool_lines.append(line)

    if not tool_lines:
        return ""

    tools_block = "\n".join(tool_lines)

    return f"""You have access to these tools:

{tools_block}

To use a tool, use EXACTLY this format — no deviations:

Thought: explain your reasoning about what to do next
Action: the_exact_tool_name
Action Input: {{"param": "value"}}

After seeing the Observation, continue:
Thought: what this observation means and what to do next
Action: next_tool_name  (if more data needed)
Action Input: {{"param": "value"}}

When you have enough information to answer the user:
Thought: I now have all the information I need
Final Answer: your complete, helpful answer to the user

RULES:
1. For greetings (hello, hi, thanks): skip tools, go straight to Final Answer
2. Action Input must be valid JSON with double-quoted keys
3. Only use tool names from the list above — never invent tool names
4. If a tool returns an error, acknowledge it and try another approach
5. Format ZAR monetary amounts as R X,XXX.XX"""


def _format_params(parameters: Dict[str, Any]) -> str:
    """Convert a JSON-schema parameters dict to a readable inline string."""
    if not parameters:
        return ""
    props = parameters.get("properties", {})
    if not props:
        return "none"
    required = set(parameters.get("required", []))
    parts: List[str] = []
    for k, v in props.items():
        typ = v.get("type", "string")
        desc = v.get("description", "")
        opt = "" if k in required else " (optional)"
        entry = f"{k}: {typ}{opt}"
        if desc:
            entry += f" — {desc}"
        parts.append(entry)
    return ", ".join(parts)
