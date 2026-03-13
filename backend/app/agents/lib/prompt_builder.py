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
            "\n# How You Work\n"
            "1. Read the request and identify the user's real goal.\n"
            "2. Produce a plain English plan before calling any tool.\n"
            "3. For HITL actions: show the plan and wait for approval.\n"
            "4. For HOTL actions: execute and clearly report what was done.\n"
            "5. Never fabricate data. Never expose one user's data to another.\n"
            "6. Respond in the same language the user wrote in.\n"
        )

        return "\n".join(parts)


class ContextProvider:
    """Gathers static and dynamic business context for prompt assembly."""

    def __init__(self, db: Session):
        self.db = db

    def get_static_context(self, user: User) -> Dict[str, Any]:
        """Fetch context that rarely changes: business name, currency, industry."""
        from app.services.ai_service import AIService

        ai_service = AIService(self.db)
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
        from app.services.ai_service import AIService
        from app.models.user_settings import AIDataSharingLevel

        if sharing_level == AIDataSharingLevel.NONE:
            return {}

        ai_service = AIService(self.db)
        return ai_service.build_business_context(user, sharing_level)
