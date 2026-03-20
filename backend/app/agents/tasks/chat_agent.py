"""
backend/app/agents/tasks/chat_agent.py

Entry point agent. Routes requests to specialist agents based on intent.
Uses LLM-based classification for accurate routing.
"""

import logging
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.user_settings import AIDataSharingLevel
from app.agents.orchestrator import Orchestrator
from app.agents.lib.agent_logger import AgentLogger
from app.core.ai_models import execute_fast_task

logger = logging.getLogger("bizpilot.agents")


async def _classify_intent(message: str, history: List[Dict[str, Any]]) -> str:
    """
    Use a fast LLM call to classify the user's intent.
    Returns the name of the specialist agent to handle the request.
    """
    system_prompt = (
        "Classify the user message into one of the following categories:\n"
        "- order_agent: For purchase orders, suppliers, procurement, reordering.\n"
        "- report_agent: For sales reports, revenue data, KPI queries, performance metrics.\n"
        "- operations_agent: For staff schedules, floor plans, shifts, rosters.\n"
        "- decision_agent: For strategic analysis, 'should I' questions, forecasting.\n"
        "- chat_agent: For general business questions, greetings, or uncategorized requests.\n\n"
        "Respond ONLY with the category name (e.g., 'order_agent')."
    )
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": message}
    ]
    
    try:
        response = await execute_fast_task(messages=messages, max_tokens=20)
        intent = response.content.strip().lower()
        
        # Validation
        valid_agents = {"order_agent", "report_agent", "operations_agent", "decision_agent", "chat_agent"}
        for agent in valid_agents:
            if agent in intent:
                return agent
        return "chat_agent"
    except Exception as e:
        logger.warning(f"Intent classification failed: {e}. Falling back to keyword matching.")
        return _detect_agent_keywords(message)


def _detect_agent_keywords(message: str) -> str:
    """Fallback keyword matching."""
    lower = message.lower()
    if any(sig in lower for sig in {"should i", "analyse", "analyze", "insight", "trend", "forecast", "recommend"}):
        return "decision_agent"
    if any(sig in lower for sig in {"order", "purchase", "supplier", "procure", "reorder", "stock up", "buy"}):
        return "order_agent"
    if any(sig in lower for sig in {"report", "sales", "revenue", "daily", "weekly", "monthly", "pdf", "download"}):
        return "report_agent"
    if any(sig in lower for sig in {"floor plan", "schedule", "staff", "shift", "roster", "section", "allocation"}):
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
        Directly executes the task. Planning is now handled within the ReAct loop
        only when HITL is actually required.
        """
        agent_name = await _classify_intent(message, history)
        AgentLogger.info(f"Routing to {agent_name}", message_preview=message[:100])

        # Execute the task immediately
        return await self.orchestrator.run_task(
            agent_name=agent_name,
            user=user,
            user_message=message,
            session_id=session_id,
            chat_history=history,
            sharing_level=sharing_level,
            business_id=business_id,
        )
