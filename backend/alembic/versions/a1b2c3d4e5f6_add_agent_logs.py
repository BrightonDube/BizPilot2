"""add agent_logs table

Revision ID: a1b2c3d4e5f6
Revises: 070_product_supplier_primary, 103_zone_fee_fields
Create Date: 2026-03-12

"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, tuple[str, ...], None] = (
    "070_product_supplier_primary",
    "103_zone_fee_fields",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agent_logs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("session_id", sa.Text(), nullable=False),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("agent_name", sa.Text(), nullable=False),
        sa.Column("step_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("tool_name", sa.Text(), nullable=True),
        sa.Column("reasoning", sa.Text(), nullable=True),
        sa.Column("action_type", sa.Text(), nullable=False, server_default="HOTL"),
        sa.Column("result_summary", sa.Text(), nullable=True),
        sa.Column("tokens_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("success", sa.Boolean(), nullable=False, server_default="TRUE"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index("idx_agent_logs_user_id", "agent_logs", ["user_id"])
    op.create_index("idx_agent_logs_session_id", "agent_logs", ["session_id"])
    op.create_index("idx_agent_logs_business_id", "agent_logs", ["business_id"])
    op.create_index(
        "idx_agent_logs_created_at",
        "agent_logs",
        [sa.text("created_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("idx_agent_logs_created_at", table_name="agent_logs")
    op.drop_index("idx_agent_logs_business_id", table_name="agent_logs")
    op.drop_index("idx_agent_logs_session_id", table_name="agent_logs")
    op.drop_index("idx_agent_logs_user_id", table_name="agent_logs")
    op.drop_table("agent_logs")
