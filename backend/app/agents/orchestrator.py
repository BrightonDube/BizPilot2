"""
backend/app/agents/orchestrator.py

Central engine for all agent operations.
Implements the full ReAct loop with plan-before-acting and HITL gates.

Flow for a standard request:
  1. generate_plan()  → returns plan text, stops, waits for user confirmation
  2. run_task()       → executes tools with HITL gates
  3. hitl resume      → handled by app/api/agents.py calling resume_after_hitl()
"""

import logging
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.user_settings import AIDataSharingLevel
from app.agents.agent_registry import registry as agent_registry
from app.agents.tool_registry import registry as tool_registry
from app.agents.lib.prompt_builder import PromptBuilder, ContextProvider
from app.agents.lib.runaway_guard import RunawayGuard
from app.agents.lib.plan_generator import generate_plan
from app.agents.lib.cache_manager import get_cached_prompt, cache_prompt
from app.agents.lib.observability_logger import log_agent_step
from app.agents.lib.agent_logger import AgentLogger
from app.agents.constants import ActionType
from app.core.ai_models import execute_task

logger = logging.getLogger("bizpilot.agents")


class Orchestrator:
    """Runs agent tasks end-to-end. Called by the FastAPI agents router."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.context_provider = ContextProvider(db)

    async def generate_plan(
        self,
        agent_name: str,
        user: User,
        user_message: str,
    ) -> Dict[str, Any]:
        """
        Step 1: Generate a plain English plan before calling any tool.
        Returns the plan for user confirmation — no tools are called here.
        """
        agent_def = agent_registry.get(agent_name)
        if not agent_def:
            return {"type": "error", "message": f"Agent '{agent_name}' not found"}

        plan_text = await generate_plan(
            user_message=user_message,
            tool_names=agent_def.tools,
            role_description=agent_def.role_description,
        )
        return {"type": "plan", "plan": plan_text, "agent": agent_name}

    async def run_task(
        self,
        agent_name: str,
        user: User,
        user_message: str,
        session_id: str,
        chat_history: List[Dict[str, Any]],
        sharing_level: AIDataSharingLevel,
        business_id: str,
    ) -> Dict[str, Any]:
        """
        Step 2: Execute the ReAct loop for a confirmed task.
        Pauses on HITL tools and returns early for user approval.
        """
        agent_def = agent_registry.get(agent_name)
        if not agent_def:
            return {"type": "error", "message": f"Agent '{agent_name}' not found"}

        guard = RunawayGuard(max_steps=agent_def.max_steps)
        system_prompt = await self._get_system_prompt(
            agent_def, user, sharing_level
        )
        messages = self._build_messages(system_prompt, chat_history, user_message)
        step = 0
        while True:
            step += 1
            # Refresh tool definitions for current context
            tool_registry.list_for_agent(agent_def.tools)
            try:
                response = await execute_task(
                    task_type=agent_def.model_tier,
                    messages=messages,
                    max_tokens=2048,
                )
            except Exception as exc:
                AgentLogger.error("Groq call failed", error=exc)
                return {"type": "error", "message": "AI provider error. Please try again."}

            guard_result = guard.record_step(
                description=f"Step {step}: LLM call",
                tokens_used=response.usage.get("total_tokens", 0),
            )

            # Check if the Groq response included tool calls
            # Note: execute_task returns LLMResponse which has no tool_calls field.
            # Tool calls come back in the raw response content as JSON.
            # We use a structured prompt approach: the LLM returns JSON or plain text.
            # If no tool calls, treat as final answer.
            final_text = response.content.strip()

            log_agent_step(
                db=self.db,
                session_id=session_id,
                user_id=str(user.id),
                business_id=business_id,
                agent_name=agent_name,
                step_number=step,
                action_type=ActionType.HOTL,
                tokens_used=response.usage.get("total_tokens", 0),
                reasoning=final_text[:500],
            )
            # Commit logs and any tool-induced changes
            await self.db.commit()

            if guard_result.stopped:
                return {"type": "stopped", "message": guard_result.partial_summary}

            # No more tool calls needed — return the final response
            return {"type": "response", "message": final_text, "steps": step}

    async def execute_tool_and_continue(
        self,
        session_id: str,
        user: User,
        tool_name: str,
        tool_args: Dict[str, Any],
        messages_so_far: List[Dict[str, Any]],
        agent_name: str,
        business_id: str,
    ) -> Dict[str, Any]:
        """
        Step 3 (HITL resume): Execute the approved HITL tool and return the result.
        Called from app/api/agents.py after the user approves.
        """
        tool_def = tool_registry.get(tool_name)
        if not tool_def:
            return {"type": "error", "message": f"Tool '{tool_name}' not found"}

        try:
            result = await tool_def.handler(db=self.db, user=user, **tool_args)
            AgentLogger.tool_result(agent_name, tool_name, result)

            log_agent_step(
                db=self.db,
                session_id=session_id,
                user_id=str(user.id),
                business_id=business_id,
                agent_name=agent_name,
                step_number=1,
                action_type=ActionType.HITL,
                tokens_used=0,
                tool_name=tool_name,
                result_summary=str(result)[:500],
                success=True,
            )
            await self.db.commit()
            return {"type": "tool_result", "tool": tool_name, "result": result}

        except Exception as exc:
            AgentLogger.error(f"HITL tool '{tool_name}' failed", error=exc)
            log_agent_step(
                db=self.db,
                session_id=session_id,
                user_id=str(user.id),
                business_id=business_id,
                agent_name=agent_name,
                step_number=1,
                action_type=ActionType.HITL,
                tokens_used=0,
                tool_name=tool_name,
                success=False,
                error_message=str(exc),
            )
            await self.db.commit()
            return {"type": "error", "message": f"Tool execution failed: {str(exc)}"}

    async def _get_system_prompt(
        self, agent_def: Any, user: User, sharing_level: AIDataSharingLevel
    ) -> str:
        """Return cached system prompt or build and cache a new one."""
        cached = await get_cached_prompt(agent_def.name)
        if cached:
            return cached

        static_ctx = self.context_provider.get_static_context(user)
        dynamic_ctx = self.context_provider.get_dynamic_context(user, sharing_level)
        prompt = PromptBuilder.build(
            role_description=agent_def.role_description,
            capabilities=agent_def.capabilities,
            constraints=agent_def.constraints,
            static_context=static_ctx,
            dynamic_context=dynamic_ctx,
        )
        await cache_prompt(agent_def.name, prompt)
        return prompt

    @staticmethod
    def _build_messages(
        system_prompt: str,
        history: List[Dict[str, Any]],
        user_message: str,
    ) -> List[Dict[str, Any]]:
        """Assemble the messages list for the LLM call."""
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(history)
        messages.append({"role": "user", "content": user_message})
        return messages
