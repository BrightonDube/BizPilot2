"""
backend/app/agents/lib/agent_logger.py

Structured logging for BizPilot AI agents.
Every tool call, result, and reasoning step goes through here.
Wraps Python's standard logging — no print() allowed.
"""

import logging
from typing import Any, Optional

# Use a named logger so it can be configured separately in production
_logger = logging.getLogger("bizpilot.agents")


class AgentLogger:
    """Provides structured, consistent logging for all agent operations."""

    @staticmethod
    def info(message: str, **kwargs: Any) -> None:
        """Log an informational agent event."""
        _logger.info(message, extra={"agent_data": kwargs} if kwargs else None)

    @staticmethod
    def warning(message: str, **kwargs: Any) -> None:
        """Log a non-fatal agent warning."""
        _logger.warning(message, extra={"agent_data": kwargs} if kwargs else None)

    @staticmethod
    def error(
        message: str, error: Optional[Exception] = None, **kwargs: Any
    ) -> None:
        """Log an agent error, optionally with the originating exception."""
        if error:
            kwargs["error_type"] = type(error).__name__
            kwargs["error_detail"] = str(error)
        _logger.error(message, extra={"agent_data": kwargs} if kwargs else None)

    @staticmethod
    def tool_call(agent_name: str, tool_name: str, arguments: dict) -> None:
        """Log that an agent is about to call a tool."""
        # Sanitize arguments — redact sensitive fields, truncate others
        SENSITIVE_KEYS = {
            "password", "api_key", "token", "secret", "ssn", 
            "credit_card", "authorization", "pin"
        }
        safe_args = {
            k: "[REDACTED]" if k.lower() in SENSITIVE_KEYS else str(v)[:200]
            for k, v in arguments.items()
        }
        _logger.info(
            "AGENT[%s] -> TOOL[%s] args=%s",
            agent_name,
            tool_name,
            safe_args,
        )


    @staticmethod
    def tool_result(agent_name: str, tool_name: str, result: Any) -> None:
        """Log the truncated output of a tool call."""
        # Truncate large results so logs stay readable
        result_preview = str(result)[:500]
        _logger.info(
            "TOOL[%s] -> AGENT[%s]",
            tool_name,
            agent_name,
            extra={"agent_data": {"result_preview": result_preview}},
        )

    @staticmethod
    def reasoning(agent_name: str, thought: str) -> None:
        """Log an agent's internal reasoning step."""
        _logger.info(
            "AGENT[%s] THINKING: %s",
            agent_name,
            thought[:500],
        )

    @staticmethod
    def hitl_event(session_id: str, action: str, tool_name: str) -> None:
        """Log a HITL approval or rejection event."""
        _logger.info(
            "HITL[%s] %s for tool[%s]",
            session_id,
            action.upper(),
            tool_name,
        )
