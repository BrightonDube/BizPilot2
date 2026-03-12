"""
backend/app/agents/lib/plan_generator.py

Generates a plain English execution plan before the agent calls any tools.
The agent always shows this plan and waits for user confirmation first.
"""

import json
import logging
from typing import Any, Dict, List

from app.core.ai_models import execute_fast_task

logger = logging.getLogger("bizpilot.agents")

_PLAN_SYSTEM_PROMPT = """You are a planning assistant for BizPilot AI agents.
Given a user request and the available tools, produce a numbered plain English plan.

Rules:
- Number each step (1, 2, 3...)
- Mark steps that run automatically: ✓ (automatic)
- Mark steps that need user approval with: ⏸ REQUIRES YOUR APPROVAL
- Keep each step to one short sentence
- End with: "Shall I proceed? [Yes] [No]"
- Never call any tools — only produce the plan text
- Keep the full plan under 200 words
"""


def _build_plan_messages(
    user_message: str,
    tool_names: List[str],
    role_description: str,
) -> List[Dict[str, Any]]:
    """Build the messages array for the plan-generation LLM call."""
    tools_list = ", ".join(tool_names) if tool_names else "none"
    return [
        {"role": "system", "content": _PLAN_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"Agent role: {role_description}\n"
                f"Available tools: {tools_list}\n\n"
                f"User request: {user_message}\n\n"
                "Write the execution plan."
            ),
        },
    ]


async def generate_plan(
    user_message: str,
    tool_names: List[str],
    role_description: str,
) -> str:
    """
    Ask the fast model to generate a numbered plan for the given request.
    Returns the plan as a plain string.
    Falls back to a generic message if the LLM call fails.
    """
    messages = _build_plan_messages(user_message, tool_names, role_description)
    try:
        response = await execute_fast_task(messages=messages, max_tokens=300)
        plan_text = response.content.strip()
        logger.info("Plan generated (%d chars)", len(plan_text))
        return plan_text
    except Exception as e:
        logger.warning("Plan generation failed, using fallback: %s", str(e))
        return _fallback_plan(user_message, tool_names)


def _fallback_plan(user_message: str, tool_names: List[str]) -> str:
    """Return a simple fallback plan when the LLM is unavailable."""
    tools_desc = ", ".join(tool_names[:3]) if tool_names else "relevant data"
    return (
        f"Here is my plan to help with: \"{user_message}\"\n\n"
        f"1. ✓ Fetch {tools_desc}\n"
        f"2. ✓ Analyse the results\n"
        f"3. ✓ Provide a clear summary\n\n"
        "Shall I proceed? [Yes] [No]"
    )


def extract_hitl_steps(plan_text: str) -> List[str]:
    """
    Parse the plan text and return a list of lines that contain ⏸.
    Used by the orchestrator to warn the user about approval steps upfront.
    """
    return [
        line.strip()
        for line in plan_text.splitlines()
        if "⏸" in line or "REQUIRES YOUR APPROVAL" in line
    ]
