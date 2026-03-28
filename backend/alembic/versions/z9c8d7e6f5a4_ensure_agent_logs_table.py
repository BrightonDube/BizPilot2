"""ensure agent_logs table exists

Revision ID: z9c8d7e6f5a4
Revises: z9b8c7d6e5f4
Create Date: 2026-03-28

The agent_logs table was supposed to be created by migration a1b2c3d4e5f6,
but that migration was on a branch of the chain that was not traversed in
production (the chain was broken at 105 before being fixed). The alembic_version
table already records a1b2c3d4e5f6 as applied (so alembic skips it), but the
actual table was never created in production.

This migration creates the table idempotently using IF NOT EXISTS so it is
safe to run even if the table somehow already exists.
"""

from typing import Sequence, Union

from alembic import op


revision: str = "z9c8d7e6f5a4"
down_revision: Union[str, None] = "z9b8c7d6e5f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS agent_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id TEXT NOT NULL,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            business_id UUID NOT NULL,
            agent_name TEXT NOT NULL,
            step_number INTEGER NOT NULL DEFAULT 1,
            tool_name TEXT,
            reasoning TEXT,
            action_type TEXT NOT NULL DEFAULT 'HOTL',
            result_summary TEXT,
            tokens_used INTEGER NOT NULL DEFAULT 0,
            success BOOLEAN NOT NULL DEFAULT TRUE,
            error_message TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            deleted_at TIMESTAMPTZ
        )
    """)

    # Create indexes idempotently
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_agent_logs_user_id ON agent_logs (user_id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_agent_logs_session_id ON agent_logs (session_id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_agent_logs_business_id ON agent_logs (business_id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_agent_logs_created_at ON agent_logs (created_at DESC)
    """)


def downgrade() -> None:
    # Only drop if it was created by this migration (can't safely know, so no-op)
    pass
