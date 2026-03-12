"""
backend/app/agents/tasks/chat_agent.py

Entry point agent. Routes requests to specialist agents based on intent.
Uses keyword + context signals to route — no separate LLM call for routing.
"""

import logging
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.user_settings import AIDataSharingLevel
from app.agents.orchestrator import Orchestrator
from app.agents.lib.agent_logger import AgentLogger

logger = logging.getLogger("bizpilot.agents")

# Keywords that signal each specialist agent
_ORDER_SIGNALS = {"order", "purchase", "supplier", "procure", "reorder", "stock up", "buy"}
_REPORT_SIGNALS = {"report", "sales", "revenue", "daily", "weekly", "monthly", "pdf", "download"}
_DECISION_SIGNALS = {"should i", "analyse", "analyze", "insight", "trend", "forecast", "recommend"}
_OPERATIONS_SIGNALS = {"floor plan", "schedule", "staff", "shift", "roster", "section", "allocation"}


def _detect_agent(message: str) -> str:
    """
    Map a user message to the best specialist agent.
    Falls back to 'chat_agent' for general questions.
    """
    lower = message.lower()
    if any(sig in lower for sig in _ORDER_SIGNALS):
        return "order_agent"
    if any(sig in lower for sig in _REPORT_SIGNALS):
        return "report_agent"
    if any(sig in lower for sig in _DECISION_SIGNALS):
        return "decision_agent"
    if any(sig in lower for sig in _OPERATIONS_SIGNALS):
        return "operations_agent"
    return "chat_agent"


class ChatAgent:
    """
    User-facing entry point. Detects intent and delegates to the right agent.
    Called directly by AIService.send_message().
    """

    def __init__(self, db: Session) -> None:
        self.db = db
        self.orchestrator = Orchestrator(db)

    async def run(
        self,
        user: User,
        message: str,
        history: List[Dict[str, Any]],
        sharing_level: AIDataSharingLevel,
        session_id: str = "",
        business_id: str = "",
        plan_confirmed: bool = False,
    ) -> Dict[str, Any]:
        """
        Process a user message.

        If plan_confirmed is False (default), generate and return a plan.
        If plan_confirmed is True, execute the task.
        """
        agent_name = _detect_agent(message)
        AgentLogger.info(f"Routing to {agent_name}", message_preview=message[:100])

        if not plan_confirmed:
            # Always generate a plan first — never jump straight to tools
            return await self.orchestrator.generate_plan(
                agent_name=agent_name,
                user=user,
                user_message=message,
            )

        # User has confirmed the plan — execute the task
        return await self.orchestrator.run_task(
            agent_name=agent_name,
            user=user,
            user_message=message,
            session_id=session_id,
            chat_history=history,
            sharing_level=sharing_level,
            business_id=business_id,
        )
