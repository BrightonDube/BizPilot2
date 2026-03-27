"""
backend/app/agents/constants.py

Single source of truth for all agent configuration.
All model names, limits, TTLs, and thresholds live here only.
"""

from app.core.ai_models import TaskType


class AgentTier:
    """
    Maps agent task complexity to ai_models.TaskType routing tiers.

    This is the ONLY place where tier-to-model-type mapping lives.
    The actual model names live in app/core/ai_models.py MODEL_REGISTRY.
    """

    # Routing, short lookups, simple confirms
    FAST = TaskType.FAST

    # PO drafting, chat, general tool calling
    BALANCED = TaskType.TOOL_CALLING

    # Strategic analysis, forecasting, multi-step decisions
    POWERFUL = TaskType.TOOL_CALLING

    # Universal fallback if all others fail
    FALLBACK = TaskType.FALLBACK


class Limits:
    """Hard limits applied by RunawayGuard to every agent task."""

    MAX_STEPS = 10              # Maximum ReAct loop turns per task
    MAX_TOKENS_PER_TASK = 32000 # Token budget per task
    TIMEOUT_SECONDS = 30        # Wall-clock timeout per task


class RedisTTL:
    """TTL values (seconds) for every Redis key namespace."""

    SYSTEM_PROMPT = 3600        # 1 hour — prompts rarely change
    SESSION_MEMORY = 86400      # 24 hours — conversation window
    HITL_PENDING = 900          # 15 minutes — approval must come quickly
    PLAN_CACHE = 300            # 5 minutes — plan is session-scoped


class RedisPrefix:
    """
    Namespaced key prefixes for all agent Redis keys.
    Format: bizpilot:agent:{type}:{id}
    """

    PROMPT = "bizpilot:agent:prompt"        # {agent_name}
    SESSION = "bizpilot:agent:session"      # {user_id}:{session_id}
    HITL = "bizpilot:agent:hitl"            # {session_id}
    PLAN = "bizpilot:agent:plan"            # {session_id}


class RiskLevel:
    """Risk classification for every tool action."""

    LOW = "LOW"         # Read-only, fully reversible
    MEDIUM = "MEDIUM"   # Creates a draft or preview
    HIGH = "HIGH"       # Creates a permanent record
    CRITICAL = "CRITICAL"  # Sends communication, triggers payment


class ActionType:
    """Controls whether human approval is required before execution."""

    # Human On The Loop — execute automatically, user can review after
    HOTL = "HOTL"

    # Human In The Loop — pause, show to user, wait for explicit approval
    HITL = "HITL"
