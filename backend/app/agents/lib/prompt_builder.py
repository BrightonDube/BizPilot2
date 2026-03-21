"""
backend/app/agents/lib/prompt_builder.py

Assembles context-rich system prompts for agents.
Sanitizes user input and enforces token budgets on dynamic context.
"""

import re
import logging
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.user import User

logger = logging.getLogger("bizpilot.agents")

# Rough token estimate: 1 token ≈ 4 characters
_CHARS_PER_TOKEN = 4
# Leave this many tokens for chat history + user message + response
_CONTEXT_TOKEN_BUDGET = 4000


def sanitize_user_input(text: str) -> str:
    """
    Strip HTML tags and common injection patterns from user input.
    User message goes into the 'user' role only — never the system prompt.
    This is a defence-in-depth measure against prompt injection.
    """
    if not text:
        return ""
    # Remove HTML tags
    text = re.sub(r"<[^>]+>", "", text)
    # Remove javascript: and data: protocols
    text = re.sub(r"(?i)(javascript|data|vbscript):", "", text)
    # Collapse excessive whitespace
    text = " ".join(text.split())
    # Hard cap on length
    return text[:2000]


def _truncate_to_budget(content: str, budget_chars: int) -> str:
    """Truncate a string to fit within a character budget."""
    if len(content) <= budget_chars:
        return content
    return content[:budget_chars] + "\n[...truncated to fit context budget]"


class PromptBuilder:
    """Assembles system prompts from static role description + live context."""

    @staticmethod
    def build(
        role_description: str,
        capabilities: List[str],
        constraints: List[str],
        static_context: Dict[str, Any],
        dynamic_context: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Build a complete system prompt.
        Dynamic context is truncated if it would exceed the token budget.
        """
        parts = [
            f"# Role\n{role_description}",
            "\n# Your Capabilities\n"
            + "\n".join(f"- {c}" for c in capabilities),
            "\n# Constraints & Hard Rules\n"
            + "\n".join(f"- {r}" for r in constraints),
            "\n# Business Context\n"
            + "\n".join(f"{k}: {v}" for k, v in static_context.items()),
        ]

        if dynamic_context:
            raw = "\n".join(f"{k}: {v}" for k, v in dynamic_context.items())
            budget = _CONTEXT_TOKEN_BUDGET * _CHARS_PER_TOKEN
            parts.append(
                "\n# Live Business Data\n" + _truncate_to_budget(raw, budget)
            )

        parts.append(
            "\n# CRITICAL RULES FOR THIS AI ASSISTANT\n\n"
            "You are BizPilot AI, a helpful business assistant for a POS/ERP system.\n\n"
            "For conversational messages (hello, hi, how are you, thanks, etc):\n"
            "- Respond naturally and conversationally. NEVER generate a plan. NEVER ask for approval.\n\n"
            "For simple data queries (show me sales, check inventory, what are my KPIs):\n"
            "- Query the data using your tools and present the results directly. No plan needed.\n\n"
            "For actions that are TRULY irreversible (deleting records, sending emails to customers, placing real purchase orders with external suppliers):\n"
            "- Ask ONE clear confirmation question: 'Are you sure you want to [action]? This cannot be undone.'\n"
            "- Do not generate a multi-step plan. Just ask the one question.\n\n"
            "NEVER generate numbered execution plans with 'REQUIRES YOUR APPROVAL' steps.\n"
            "NEVER show the user your internal reasoning steps.\n"
            "NEVER ask for approval before answering a simple question.\n"
            "NEVER ask 'Shall I proceed? [Yes] [No]' for conversational messages or read-only queries.\n\n"
            "If you do not know how to do something, say so clearly and briefly. Do not generate a plan to figure out how to do it.\n\n"
            "Always respond in plain, friendly English. No jargon. No bureaucracy.\n"
        )

        return "\n".join(parts)


class ContextProvider:
    """Gathers static and dynamic business context for prompt assembly."""

    def __init__(self, db: Session):
        self.db = db

    def get_static_context(self, user: User) -> Dict[str, Any]:
        """Fetch context that rarely changes: business name, currency, industry."""
        from app.services.ai_context_service import AIContextService

        ai_service = AIContextService(self.db)
        # Using the public method _get_business_for_user is the only way
        # to get the business for a user without duplicating the join logic.
        business = ai_service._get_business_for_user(user.id)
        if not business:
            return {}
        return {
            "business_name": business.name,
            "industry": getattr(business, "industry", "General Business") or "General Business",
            "currency": getattr(business, "currency", "ZAR") or "ZAR",
        }

    def get_dynamic_context(self, user: User, sharing_level: Any) -> Dict[str, Any]:
        """Fetch live metrics — respects the user's data-sharing preference."""
        from app.services.ai_context_service import AIContextService
        from app.models.user_settings import AIDataSharingLevel

        if sharing_level == AIDataSharingLevel.NONE:
            return {}

        ai_service = AIContextService(self.db)
        return ai_service.build_business_context(user, sharing_level)
