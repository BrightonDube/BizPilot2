"""
backend/app/agents/lib/observability_logger.py

Writes a permanent audit record for every agent step to the agent_logs table.
Uses SQLAlchemy Session — no direct DB access by agents.
Fails silently so a logging error never breaks the agent response.
"""

import logging
import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.models.agent_log import AgentLog

logger = logging.getLogger("bizpilot.agents")


def log_agent_step(
    db: Session,
    session_id: str,
    user_id: str,
    business_id: str,
    agent_name: str,
    step_number: int,
    action_type: str,
    tokens_used: int,
    tool_name: Optional[str] = None,
    reasoning: Optional[str] = None,
    result_summary: Optional[str] = None,
    success: bool = True,
    error_message: Optional[str] = None,
) -> None:
    """
    Write one agent step to the agent_logs table.
    Intentionally catches all exceptions — a logging failure must never
    prevent the user from getting a response.
    """
    try:
        # Truncate free-text fields to avoid accidentally storing raw user data
        safe_reasoning = _truncate(reasoning, 1000)
        safe_summary = _truncate(result_summary, 500)
        safe_error = _truncate(error_message, 500)

        # Ensure user_id and business_id are valid UUID strings/objects
        try:
            u_id = uuid.UUID(str(user_id))
            b_id = uuid.UUID(str(business_id))
        except (ValueError, TypeError):
            logger.error(f"Invalid UUID for log: user={user_id}, business={business_id}")
            return

        log_entry = AgentLog(
            session_id=session_id,
            user_id=u_id,
            business_id=b_id,
            agent_name=agent_name,
            step_number=step_number,
            tool_name=tool_name,
            reasoning=safe_reasoning,
            action_type=action_type,
            result_summary=safe_summary,
            tokens_used=tokens_used,
            success=success,
            error_message=safe_error,
        )
        db.add(log_entry)
        # Use flush instead of commit so the transaction remains open
        # and doesn't trigger a mid-task commit that might break other logic
        db.flush()

    except Exception as exc:
        # Never let a logging error crash the agent — just warn
        logger.warning(
            "Failed to write agent_log for session %s step %d: %s",
            session_id,
            step_number,
            str(exc),
        )
        # Roll back the failed flush so the session stays usable
        try:
            db.rollback()
        except Exception:
            pass


def _truncate(value: Optional[str], max_chars: int) -> Optional[str]:
    """Truncate a string field to prevent large payloads in audit logs."""
    if value is None:
        return None
    if len(value) <= max_chars:
        return value
    return value[:max_chars] + "...[truncated]"
