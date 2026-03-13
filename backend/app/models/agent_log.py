"""SQLAlchemy model for agent_logs table.

Stores a permanent audit trail of every decision an AI agent makes.
Every tool call, routing decision, and HITL event is recorded here.
"""

from sqlalchemy import Column, Text, Integer, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import BaseModel


class AgentLog(BaseModel):
    """Audit record for a single agent step."""

    __tablename__ = "agent_logs"

    # Which session this step belongs to (UUID generated per chat request)
    session_id = Column(Text, nullable=False, index=True)

    # The authenticated user who triggered this agent run
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Business context — denormalised for fast audit queries
    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    # Which agent processed this step (e.g. "order_agent")
    agent_name = Column(Text, nullable=False)

    # Step number within the current session (1-indexed)
    step_number = Column(Integer, nullable=False, default=1)

    # Tool that was called — null if this was a reasoning-only step
    tool_name = Column(Text, nullable=True)

    # Agent's reasoning text for this step
    reasoning = Column(Text, nullable=True)

    # HOTL or HITL — what kind of action was taken
    action_type = Column(Text, nullable=False, default="HOTL")

    # One-line summary of the tool result (truncated, never raw data)
    result_summary = Column(Text, nullable=True)

    # Tokens consumed by this step
    tokens_used = Column(Integer, nullable=False, default=0)

    # Whether this step completed successfully
    success = Column(Boolean, nullable=False, default=True)

    # Error message if success=False
    error_message = Column(Text, nullable=True)
