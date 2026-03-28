"""
backend/app/agents/intent_classifier.py

Classifies user intent to determine complexity, required agents, and tools.
Provides fast pattern-matching classification before LLM routing.
"""
from enum import Enum
from dataclasses import dataclass, field
from typing import List
import logging

logger = logging.getLogger(__name__)


class IntentComplexity(Enum):
    """How complex the user's request is."""
    GREETING = "greeting"            # hello, hi, thanks — no tools needed
    SIMPLE_QUERY = "simple_query"    # what time, who are you — LLM knowledge only
    DATA_LOOKUP = "data_lookup"      # show me sales, list suppliers — 1 tool call
    MULTI_STEP = "multi_step"        # create order for X — multiple tool calls
    COMPLEX_ACTION = "complex_action"  # send report to all managers — chained agents


@dataclass
class ClassifiedIntent:
    """Result of intent classification."""
    complexity: IntentComplexity
    primary_agent: str
    supporting_agents: List[str] = field(default_factory=list)
    required_tools: List[str] = field(default_factory=list)
    needs_confirmation: bool = False
    reasoning: str = ""


# Patterns for fast classification without LLM (saves tokens)
GREETING_PATTERNS = {
    "hello", "hi", "hey", "thanks", "thank you", "good morning",
    "good afternoon", "help", "what can you do", "who are you",
}

AGENT_KEYWORDS = {
    "chat_agent": ["what", "how", "explain", "tell me", "describe", "why"],
    "order_agent": ["order", "purchase", "buy", "send order", "create order", "stock", "supplier", "procure", "reorder"],
    "report_agent": ["report", "summary", "sales", "revenue", "analytics", "stats", "weekly", "monthly", "daily"],
    "crm_agent": ["customer", "client", "contact", "vendor", "loyalty", "segment"],
    "finance_agent": ["invoice", "payment", "balance", "outstanding", "debt", "expense", "petty cash"],
    "email_agent": ["email", "notify", "alert", "message", "forward"],
    "inventory_agent": ["inventory", "stock", "quantity", "product", "items", "low stock"],
    "decision_agent": ["recommend", "suggest", "should i", "best", "advice", "analyse", "analyze", "forecast"],
}


def classify_intent(message: str, business_context: dict) -> ClassifiedIntent:
    """
    Classifies the user message to determine routing before calling LLM.
    Uses pattern matching for speed — the ChatAgent's _classify_intent uses an
    actual LLM call; this is the fast pre-filter used by the orchestrator.
    """
    lower = message.lower().strip()

    # Fast path: greetings never need tools
    words = lower.split()
    if any(g in lower for g in GREETING_PATTERNS) and len(words) < 6:
        return ClassifiedIntent(
            complexity=IntentComplexity.GREETING,
            primary_agent="chat_agent",
            reasoning="Simple greeting — no tools required",
        )

    # Score each agent by keyword matches
    agent_scores: dict[str, int] = {}
    for agent, keywords in AGENT_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in lower)
        if score > 0:
            agent_scores[agent] = score

    # Break ties by preferring specialist agents over chat_agent
    def _score_key(agent: str) -> tuple:
        return (agent_scores[agent], 0 if agent == "chat_agent" else 1)

    primary = max(agent_scores, key=_score_key) if agent_scores else "chat_agent"
    supporting = [a for a in agent_scores if a != primary]

    # Determine complexity
    action_words = {"create", "send", "update", "delete", "generate", "email", "make", "place"}
    has_action = any(a in lower for a in action_words)
    multi_entity = lower.count(" and ") > 0 or lower.count(",") > 1

    if has_action and multi_entity:
        complexity = IntentComplexity.COMPLEX_ACTION
        needs_confirmation = True
    elif has_action:
        complexity = IntentComplexity.MULTI_STEP
        needs_confirmation = "delete" in lower or "send" in lower
    elif len(words) > 3:
        complexity = IntentComplexity.DATA_LOOKUP
        needs_confirmation = False
    else:
        complexity = IntentComplexity.SIMPLE_QUERY
        needs_confirmation = False

    return ClassifiedIntent(
        complexity=complexity,
        primary_agent=primary,
        supporting_agents=supporting,
        needs_confirmation=needs_confirmation,
        reasoning=f"Matched agent '{primary}' with score {agent_scores.get(primary, 0)}",
    )
