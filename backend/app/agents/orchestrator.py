"""
backend/app/agents/orchestrator.py

Central engine for all agent operations.
Implements the full ReAct loop with tool execution and HITL gates.

Flow:
  1. run_task()       → executes ReAct loop: LLM → tool calls → LLM → ... → final answer
  2. HITL pause       → if a tool is HITL, saves state to Redis and returns to user
  3. hitl resume      → execute_tool_and_continue() runs approved tool and continues
"""

import json
import logging
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.user_settings import AIDataSharingLevel
from app.agents.agent_registry import registry as agent_registry
from app.agents.tool_registry import registry as tool_registry
from app.agents.lib.prompt_builder import PromptBuilder, ContextProvider
from app.agents.lib.runaway_guard import RunawayGuard
from app.agents.lib.hitl_manager import pause_for_approval
from app.agents.lib.cache_manager import get_cached_prompt, cache_prompt
from app.agents.lib.observability_logger import log_agent_step
from app.agents.lib.agent_logger import AgentLogger
from app.agents.constants import ActionType
from app.core.ai_models import execute_task, TaskType

logger = logging.getLogger("bizpilot.agents")


class Orchestrator:
    """Runs agent tasks end-to-end with a real ReAct loop."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.context_provider = ContextProvider(db)

    async def run_task(
        self,
        agent_name: str,
        user: User,
        user_message: str,
        session_id: str,
        chat_history: List[Dict[str, Any]],
        sharing_level: AIDataSharingLevel,
        business_id: str,
        extra_context: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        """
        Execute the ReAct loop for an agent task.
        Passes tool schemas to the LLM, executes HOTL tools automatically,
        pauses on HITL tools for user approval.
        """
        agent_def = agent_registry.get(agent_name)
        if not agent_def:
            return {"type": "error", "message": f"Agent '{agent_name}' not found"}

        guard = RunawayGuard(max_steps=agent_def.max_steps)
        system_prompt = await self._get_system_prompt(
            agent_def, user, sharing_level
        )

        # Inject extra context from chained agents
        if extra_context:
            context_str = "\n\nContext from previous steps:\n" + json.dumps(
                extra_context, default=str
            )
            system_prompt += context_str

        messages = self._build_messages(system_prompt, chat_history, user_message)

        # Get tool schemas for this agent
        tools_schema = tool_registry.list_for_agent(agent_def.tools)

        step = 0
        while True:
            step += 1

            try:
                response = await execute_task(
                    task_type=agent_def.model_tier,
                    messages=messages,
                    tools=tools_schema if tools_schema else None,
                    max_tokens=2048,
                )
            except Exception as exc:
                logger.error(
                    "LLM call failed for agent '%s': %s: %s",
                    agent_name, type(exc).__name__, exc,
                    exc_info=True,
                )
                return {
                    "type": "error",
                    "message": "I'm having trouble processing your request right now. Please try again in a moment.",
                }

            guard_result = guard.record_step(
                description=f"Step {step}: LLM call",
                tokens_used=response.usage.get("total_tokens", 0),
            )

            if guard_result.stopped:
                return {"type": "stopped", "message": guard_result.partial_summary}

            # If LLM returned tool calls, execute them
            if response.tool_calls:
                for tool_call in response.tool_calls:
                    tool_name = tool_call["name"]
                    # Guard against None arguments (LLM may return null JSON)
                    raw_args = tool_call["arguments"]
                    tool_args = raw_args if isinstance(raw_args, dict) else {}
                    tool_def = tool_registry.get(tool_name)

                    if not tool_def:
                        # Unknown tool — append error and let LLM retry
                        messages.append({
                            "role": "assistant",
                            "content": None,
                            "tool_calls": [{
                                "id": tool_call["id"],
                                "type": "function",
                                "function": {
                                    "name": tool_name,
                                    "arguments": json.dumps(tool_args),
                                },
                            }],
                        })
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call["id"],
                            "content": json.dumps({"error": f"Tool '{tool_name}' not found"}),
                        })
                        continue

                    # HITL gate — pause for user approval
                    if tool_def.action_type == ActionType.HITL:
                        log_agent_step(
                            db=self.db,
                            session_id=session_id,
                            user_id=str(user.id),
                            business_id=business_id,
                            agent_name=agent_name,
                            step_number=step,
                            action_type=ActionType.HITL,
                            tokens_used=response.usage.get("total_tokens", 0),
                            tool_name=tool_name,
                            reasoning=f"HITL pause: {tool_name}({tool_args})",
                        )
                        self.db.commit()

                        return await pause_for_approval(
                            session_id=session_id,
                            agent_name=agent_name,
                            tool_name=tool_name,
                            tool_args=tool_args,
                            messages_so_far=messages,
                            description=tool_def.hitl_description or f"Execute {tool_name}",
                        )

                    # HOTL — execute immediately
                    try:
                        result = await tool_def.handler(
                            db=self.db, user=user, **tool_args
                        )
                        AgentLogger.tool_result(agent_name, tool_name, result)
                    except Exception as exc:
                        AgentLogger.error(f"Tool '{tool_name}' failed", error=exc)
                        result = {"error": str(exc)}

                    # Append assistant tool call + tool result to messages
                    messages.append({
                        "role": "assistant",
                        "content": None,
                        "tool_calls": [{
                            "id": tool_call["id"],
                            "type": "function",
                            "function": {
                                "name": tool_name,
                                "arguments": json.dumps(tool_args),
                            },
                        }],
                    })
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call["id"],
                        "content": json.dumps(result, default=str),
                    })

                    log_agent_step(
                        db=self.db,
                        session_id=session_id,
                        user_id=str(user.id),
                        business_id=business_id,
                        agent_name=agent_name,
                        step_number=step,
                        action_type=ActionType.HOTL,
                        tokens_used=response.usage.get("total_tokens", 0),
                        tool_name=tool_name,
                        result_summary=str(result)[:500],
                        success=True,
                    )

                self.db.commit()
                # Continue the ReAct loop — LLM will see tool results
                continue

            # No tool calls = final answer
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
            self.db.commit()

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
        Resume after HITL approval: execute the approved tool,
        feed the result back to the LLM for a final summary.
        """
        tool_def = tool_registry.get(tool_name)
        if not tool_def:
            return {"type": "error", "message": f"Tool '{tool_name}' not found"}

        try:
            safe_args = tool_args if isinstance(tool_args, dict) else {}
            result = await tool_def.handler(db=self.db, user=user, **safe_args)
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
            self.db.commit()

            # Feed result back to LLM for a summary response
            messages_so_far.append({
                "role": "tool",
                "tool_call_id": f"hitl_{tool_name}",
                "content": json.dumps(result, default=str),
            })

            try:
                agent_def = agent_registry.get(agent_name)
                task_type = agent_def.model_tier if agent_def else TaskType.TOOL_CALLING
                summary_response = await execute_task(
                    task_type=task_type,
                    messages=messages_so_far,
                    max_tokens=1024,
                )
                return {
                    "type": "response",
                    "message": summary_response.content.strip(),
                    "tool_name": tool_name,
                }
            except Exception as summary_exc:
                logger.warning(
                    "HITL summary LLM call failed for tool '%s': %s",
                    tool_name,
                    summary_exc,
                    exc_info=True,
                )
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
            self.db.commit()
            return {"type": "error", "message": f"Tool execution failed: {str(exc)}"}

    async def _get_system_prompt(
        self, agent_def: Any, user: User, sharing_level: AIDataSharingLevel
    ) -> str:
        """Return cached system prompt or build and cache a new one.

        The cache key includes the user_id so each user's business context
        is isolated — no cross-user prompt leakage.
        """
        cache_key = f"{agent_def.name}:{user.id}"
        cached = await get_cached_prompt(cache_key)
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
        await cache_prompt(cache_key, prompt)
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
