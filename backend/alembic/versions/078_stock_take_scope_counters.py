"""Create stock_take_scope and stock_take_counters tables.

Revision ID: 078_stock_take_scope_counters
Revises: 077_inventory_report_configs
Create Date: 2025-01-01 00:00:00.000000

Why separate scope and counters tables?
- stock_take_scope: Enables partial stock takes scoped to specific categories,
  locations, or products.  Without this, every stock take session must count
  every product in the business — impractical for large inventories.
- stock_take_counters: Tracks which staff members are assigned to count.
  This supports multi-person counting with accountability and prevents
  duplicate assignments via the unique constraint.
"""

revision = "078_stock_take_scope_counters"
down_revision = "077_inventory_report_configs"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


def upgrade() -> None:
    # Partial count scoping
    op.create_table(
        "stock_take_scope",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("session_id", UUID(as_uuid=True), sa.ForeignKey("stock_take_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scope_type", sa.String(20), nullable=False),
        sa.Column("scope_id", UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_index("ix_stock_take_scope_session_id", "stock_take_scope", ["session_id"])

    # Assigned counters (staff)
    op.create_table(
        "stock_take_counters",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("session_id", UUID(as_uuid=True), sa.ForeignKey("stock_take_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("assigned_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("session_id", "user_id", name="uq_stock_take_counter"),
    )

    op.create_index("ix_stock_take_counters_session_id", "stock_take_counters", ["session_id"])
    op.create_index("ix_stock_take_counters_user_id", "stock_take_counters", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_stock_take_counters_user_id")
    op.drop_index("ix_stock_take_counters_session_id")
    op.drop_table("stock_take_counters")
    op.drop_index("ix_stock_take_scope_session_id")
    op.drop_table("stock_take_scope")
