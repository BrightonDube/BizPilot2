"""
backend/app/agents/tasks/chat_agent.py

Entry point agent. Routes requests to specialist agents based on intent.
Uses LLM-based classification for accurate routing, with multi-agent chaining
for requests that span multiple domains.
"""

import logging
from typing import Any, Dict, List, Union

from sqlalchemy.orm import Session

from app.models.user import User
from app.models.user_settings import AIDataSharingLevel
from app.agents.orchestrator import Orchestrator
from app.agents.lib.agent_logger import AgentLogger
from app.core.ai_models import execute_fast_task

logger = logging.getLogger("bizpilot.agents")

VALID_AGENTS = {
    "order_agent", "report_agent", "operations_agent", "decision_agent",
    "chat_agent", "email_agent", "finance_agent", "crm_agent",
}


async def _classify_intent(
    message: str, history: List[Dict[str, Any]]
) -> Union[str, List[str]]:
    """
    Use a fast LLM call to classify the user's intent.
    Returns the name of the specialist agent, or a list for chaining.
    """
    system_prompt = (
        "Classify the user message into one or more agent categories.\n"
        "Available agents:\n"
        "- order_agent: Purchase orders, suppliers, procurement, reordering.\n"
        "- report_agent: Sales reports, revenue data, KPI queries, performance metrics.\n"
        "- operations_agent: Staff schedules, floor plans, shifts, rosters, POS, cash registers, laybys.\n"
        "- decision_agent: Strategic analysis, 'should I' questions, forecasting, recommendations.\n"
        "- email_agent: Sending emails, sharing reports via email, notifications.\n"
        "- finance_agent: Expenses, petty cash, journal entries, GL accounts, invoices.\n"
        "- crm_agent: Customer management, segments, loyalty, interactions.\n"
        "- chat_agent: General business questions, greetings, or uncategorized requests.\n\n"
        "If the request needs multiple agents in sequence (e.g. 'email me the sales report' "
        "needs report_agent then email_agent), respond with comma-separated names.\n"
        "Respond ONLY with the agent name(s), nothing else."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": message},
    ]

    try:
        response = await execute_fast_task(messages=messages, max_tokens=50)
        intent_raw = response.content.strip().lower()

        # Parse comma-separated agents
        agents = [a.strip() for a in intent_raw.split(",") if a.strip()]
        validated = [a for a in agents if a in VALID_AGENTS]

        if len(validated) > 1:
            return validated
        elif len(validated) == 1:
            return validated[0]
        return "chat_agent"
    except Exception as e:
        logger.warning(f"Intent classification failed: {e}. Falling back to keyword matching.")
        return _detect_agent_keywords(message)


def _detect_agent_keywords(message: str) -> Union[str, List[str]]:
    """Fallback keyword matching with multi-agent detection."""
    lower = message.lower()

    agents: List[str] = []

    # Check for email + report chain
    has_email = any(sig in lower for sig in {"email", "send", "forward", "share via"})
    has_report = any(sig in lower for sig in {"report", "sales", "revenue", "daily", "weekly", "monthly"})

    if has_email and has_report:
        return ["report_agent", "email_agent"]

    if has_email:
        agents.append("email_agent")
    if any(sig in lower for sig in {"expense", "petty cash", "journal", "ledger", "gl ", "account balance"}):
        agents.append("finance_agent")
    if any(sig in lower for sig in {"customer segment", "loyalty", "crm", "interaction log"}):
        agents.append("crm_agent")
    if any(sig in lower for sig in {"should i", "analyse", "analyze", "insight", "trend", "forecast", "recommend"}):
        agents.append("decision_agent")
    if any(sig in lower for sig in {"order", "purchase", "supplier", "procure", "reorder", "stock up", "buy"}):
        agents.append("order_agent")
    if has_report:
        agents.append("report_agent")
    if any(sig in lower for sig in {"floor plan", "schedule", "staff", "shift", "roster", "section", "allocation", "register", "cashup", "layby"}):
        agents.append("operations_agent")

    if len(agents) > 1:
        return agents
    elif len(agents) == 1:
        return agents[0]
    return "chat_agent"


class ChatAgent:
    """
    User-facing entry point. Detects intent and delegates to the right agent.
    Supports multi-agent chaining for complex requests.
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
        Routes to single agent or chains multiple agents.
        """
        intent = await _classify_intent(message, history)

        if isinstance(intent, list):
            AgentLogger.info(
                f"Chaining agents: {' -> '.join(intent)}",
                message_preview=message[:100],
            )
            return await self._run_chained(
                agent_chain=intent,
                user=user,
                message=message,
                history=history,
                sharing_level=sharing_level,
                session_id=session_id,
                business_id=business_id,
            )

        agent_name = intent
        AgentLogger.info(f"Routing to {agent_name}", message_preview=message[:100])

        return await self.orchestrator.run_task(
            agent_name=agent_name,
            user=user,
            user_message=message,
            session_id=session_id,
            chat_history=history,
            sharing_level=sharing_level,
            business_id=business_id,
        )

    async def _run_chained(
        self,
        agent_chain: List[str],
        user: User,
        message: str,
        history: List[Dict[str, Any]],
        sharing_level: AIDataSharingLevel,
        session_id: str,
        business_id: str,
    ) -> Dict[str, Any]:
        """Execute a chain of agents sequentially, passing context forward."""
        accumulated_context: Dict[str, Any] = {}

        for agent_name in agent_chain:
            result = await self.orchestrator.run_task(
                agent_name=agent_name,
                user=user,
                user_message=message,
                session_id=session_id,
                chat_history=history,
                sharing_level=sharing_level,
                business_id=business_id,
                extra_context=accumulated_context if accumulated_context else None,
            )
            accumulated_context[agent_name] = result

            # If any agent pauses (HITL, error, stopped), return immediately
            if result.get("type") in ("hitl_request", "error", "stopped"):
                return result

        return result
