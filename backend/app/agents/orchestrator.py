"""
backend/app/agents/orchestrator.py

Central engine for all agent operations.
Implements the ReAct loop with text-based tool execution and HITL gates.

Architecture:
  1. run_task()     → ReAct loop: LLM (text only) → parse output → execute tool → loop
  2. HITL pause     → tool flagged HITL: saves state to Redis, returns to user for approval
  3. HITL resume    → execute_tool_and_continue() runs approved tool, returns summary

Groq is called WITHOUT the tools= parameter — pure text generation.
Tool calling is done in Python by parsing LLM output with regex and calling
handler functions directly. This is the proven ReAct pattern.
"""

import json
import logging
import re
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
from app.agents.react_orchestrator import parse_llm_output, build_react_tool_prompt
from app.core.ai_models import execute_task, TaskType

logger = logging.getLogger("bizpilot.agents")


class Orchestrator:
    """Runs agent tasks end-to-end using the ReAct loop."""

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

        LLM produces text with Thought/Action/Action Input/Final Answer format.
        Python parses the text, calls tool handlers directly, feeds Observation
        back into context, and loops until Final Answer or max steps reached.

        No tools= parameter is passed to Groq — pure text generation only.
        """
        agent_def = agent_registry.get(agent_name)
        if not agent_def:
            return {"type": "error", "message": f"Agent '{agent_name}' not found"}

        guard = RunawayGuard(max_steps=agent_def.max_steps)

        # Build system prompt with ReAct tool descriptions embedded
        system_prompt = await self._get_system_prompt(agent_def, user, sharing_level)
        react_tool_block = build_react_tool_prompt(agent_def.tools, tool_registry)
        if react_tool_block:
            system_prompt = system_prompt + "\n\n" + react_tool_block

        if extra_context:
            system_prompt += "\n\nContext from previous steps:\n" + json.dumps(
                extra_context, default=str
            )

        # Accumulated Thought/Action/Observation history for this task
        scratchpad = ""
        step = 0

        while True:
            step += 1

            # Build messages: system + recent history + user message + scratchpad
            messages = [{"role": "system", "content": system_prompt}]
            messages.extend(chat_history[-4:] if chat_history else [])

            # Append scratchpad to user message so LLM sees full reasoning so far
            user_content = user_message
            if scratchpad:
                user_content = f"{user_message}\n\n{scratchpad}"
            messages.append({"role": "user", "content": user_content})

            # Call LLM — text generation only, NO tools= parameter
            try:
                response = await execute_task(
                    task_type=agent_def.model_tier,
                    messages=messages,
                    max_tokens=2048,
                    temperature=0.1,
                    stop=["Observation:"],  # Stop before LLM writes fake observations
                )
            except Exception as exc:
                logger.error(
                    "LLM call failed for agent '%s' step %d: %s: %s",
                    agent_name, step, type(exc).__name__, exc,
                    exc_info=True,
                )
                return {
                    "type": "error",
                    "message": "I'm having trouble processing your request right now. Please try again in a moment.",
                }

            guard_result = guard.record_step(
                description=f"Step {step}: ReAct",
                tokens_used=response.usage.get("total_tokens", 0),
            )
            if guard_result.stopped:
                return {"type": "stopped", "message": guard_result.partial_summary}

            llm_text = response.content or ""
            logger.info(
                "ReAct step %d/%d | agent=%s | preview: %s",
                step, agent_def.max_steps, agent_name,
                llm_text[:200].replace("\n", " "),
            )

            # Parse the LLM output for Action or Final Answer
            action_name, action_args, final_answer = parse_llm_output(llm_text)

            # ── Final Answer ─────────────────────────────────────────────────
            if final_answer:
                log_agent_step(
                    db=self.db,
                    session_id=session_id,
                    user_id=str(user.id),
                    business_id=business_id,
                    agent_name=agent_name,
                    step_number=step,
                    action_type=ActionType.HOTL,
                    tokens_used=response.usage.get("total_tokens", 0),
                    reasoning=final_answer[:500],
                )
                self.db.commit()
                return {"type": "response", "message": final_answer, "steps": step}

            # ── Tool call ────────────────────────────────────────────────────
            if action_name:
                tool_def = tool_registry.get(action_name)

                if not tool_def:
                    # Unknown tool — inject error as Observation and let LLM retry
                    logger.warning(
                        "Agent '%s' called unknown tool '%s'. "
                        "Available: %s",
                        agent_name, action_name, tool_registry.all_names(),
                    )
                    available = ", ".join(tool_registry.all_names())
                    observation = json.dumps({
                        "error": f"Tool '{action_name}' does not exist. "
                                 f"Available tools: {available}"
                    })
                    scratchpad += _scratchpad_entry(llm_text, action_name, action_args, observation)
                    continue

                # ── HITL gate ─────────────────────────────────────────────
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
                        tool_name=action_name,
                        reasoning=f"HITL pause: {action_name}({action_args})",
                    )
                    self.db.commit()
                    return await pause_for_approval(
                        session_id=session_id,
                        agent_name=agent_name,
                        tool_name=action_name,
                        tool_args=action_args,
                        messages_so_far=messages,
                        description=tool_def.hitl_description or f"Execute {action_name}",
                    )

                # ── HOTL — execute tool immediately ──────────────────────
                try:
                    # Inspect signature to avoid passing unknown kwargs
                    import inspect
                    sig = inspect.signature(tool_def.handler)
                    safe_args = {
                        k: v for k, v in (action_args or {}).items()
                        if k in sig.parameters
                    }
                    result = await tool_def.handler(db=self.db, user=user, **safe_args)
                    AgentLogger.tool_result(agent_name, action_name, result)
                    if not isinstance(result, dict):
                        result = {"result": str(result)}
                except Exception as exc:
                    AgentLogger.error(f"Tool '{action_name}' failed", error=exc)
                    result = {"error": str(exc), "tool": action_name}

                observation = json.dumps(result, default=str)
                scratchpad += _scratchpad_entry(llm_text, action_name, action_args, observation)

                log_agent_step(
                    db=self.db,
                    session_id=session_id,
                    user_id=str(user.id),
                    business_id=business_id,
                    agent_name=agent_name,
                    step_number=step,
                    action_type=ActionType.HOTL,
                    tokens_used=response.usage.get("total_tokens", 0),
                    tool_name=action_name,
                    result_summary=observation[:500],
                    success=True,
                )
                self.db.commit()
                continue

            # ── No structure in LLM output ────────────────────────────────
            # LLM produced neither Action nor Final Answer.
            # Treat the whole response as the final answer.
            logger.warning(
                "Agent '%s' step %d: LLM output has no Action or Final Answer. "
                "Treating as direct response.",
                agent_name, step,
            )
            if llm_text.strip():
                log_agent_step(
                    db=self.db,
                    session_id=session_id,
                    user_id=str(user.id),
                    business_id=business_id,
                    agent_name=agent_name,
                    step_number=step,
                    action_type=ActionType.HOTL,
                    tokens_used=response.usage.get("total_tokens", 0),
                    reasoning=llm_text[:500],
                )
                self.db.commit()
                return {"type": "response", "message": llm_text.strip(), "steps": step}

            # Empty response — something is wrong
            return {
                "type": "error",
                "message": "I was unable to generate a response. Please try again.",
            }

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
        Resume after HITL approval: execute the approved tool and return a summary.
        """
        tool_def = tool_registry.get(tool_name)
        if not tool_def:
            return {"type": "error", "message": f"Tool '{tool_name}' not found"}

        try:
            safe_args = tool_args if isinstance(tool_args, dict) else {}
            result = await tool_def.handler(db=self.db, user=user, **safe_args)
            AgentLogger.tool_result(agent_name, tool_name, result)
            if not isinstance(result, dict):
                result = {"result": str(result)}

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

            # Generate a user-friendly summary of what was done
            try:
                agent_def = agent_registry.get(agent_name)
                task_type = agent_def.model_tier if agent_def else TaskType.FAST
                summary_messages = [
                    {
                        "role": "system",
                        "content": (
                            "You are a helpful business assistant. "
                            "Summarize the following action result in a clear, "
                            "friendly message for the user. Be concise."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"I approved the action '{tool_name}' and it returned:\n"
                            f"{json.dumps(result, default=str, indent=2)}\n\n"
                            "Please summarize what was done and any key details."
                        ),
                    },
                ]
                summary_response = await execute_task(
                    task_type=task_type,
                    messages=summary_messages,
                    max_tokens=512,
                    temperature=0.3,
                )
                return {
                    "type": "response",
                    "message": summary_response.content.strip(),
                    "tool_name": tool_name,
                }
            except Exception as summary_exc:
                logger.warning(
                    "HITL summary LLM call failed for tool '%s': %s",
                    tool_name, summary_exc,
                    exc_info=True,
                )
                # Fallback: return the raw result
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
        """Return cached system prompt or build and cache a new one."""
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


# ─────────────────────────────────────────────────────────────────────────────
# Private helpers
# ─────────────────────────────────────────────────────────────────────────────

def _extract_thought(llm_text: str) -> str:
    """Extract the Thought line from LLM output, or return empty string."""
    m = re.search(r"Thought:\s*(.+?)(?:Action:|Final Answer:|$)", llm_text, re.DOTALL | re.IGNORECASE)
    return m.group(1).strip() if m else ""


def _scratchpad_entry(
    llm_text: str,
    action_name: str,
    action_args: Dict[str, Any],
    observation: str,
) -> str:
    """Build a single Thought/Action/Action Input/Observation block for the scratchpad."""
    thought = _extract_thought(llm_text)
    args_str = json.dumps(action_args or {})
    return (
        f"\nThought: {thought}"
        f"\nAction: {action_name}"
        f"\nAction Input: {args_str}"
        f"\nObservation: {observation}\n"
    )
