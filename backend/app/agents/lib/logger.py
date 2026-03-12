"""
backend/app/agents/lib/logger.py

Structured logger for BizPilot AI Agents.
Wraps standard logging to provide consistent formatting for tool calls and reasoning steps.
"""

import logging
import json
from typing import Any, Optional

# Use the existing app logger name or a specialized one for agents
logger = logging.getLogger("bizpilot.agents")

class AgentLogger:
    """Provides structured logging for agent operations."""

    @staticmethod
    def info(message: str, **kwargs):
        logger.info(message, extra={"extra": kwargs} if kwargs else None)

    @staticmethod
    def error(message: str, error: Optional[Exception] = None, **kwargs):
        if error:
            kwargs["error_type"] = type(error).__name__
            kwargs["error_detail"] = str(error)
        logger.error(message, extra={"extra": kwargs} if kwargs else None)

    @staticmethod
    def tool_call(agent_name: str, tool_name: str, arguments: dict):
        """Logs a tool being invoked by an agent."""
        logger.info(
            f"AGENT[{agent_name}] -> TOOL[{tool_name}]",
            extra={"extra": {"arguments": arguments}}
        )

    @staticmethod
    def tool_result(agent_name: str, tool_name: str, result: Any):
        """Logs the output of a tool call."""
        # Truncate large results for logs
        log_result = str(result)[:500] + "..." if len(str(result)) > 500 else result
        logger.info(
            f"TOOL[{tool_name}] -> AGENT[{agent_name}]",
            extra={"extra": {"result_preview": log_result}}
        )

    @staticmethod
    def reasoning(agent_name: str, thought: str):
        """Logs an agent's internal reasoning step."""
        logger.info(f"AGENT[{agent_name}] THINKING: {thought}")
