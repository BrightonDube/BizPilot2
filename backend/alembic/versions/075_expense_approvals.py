"""Create expense_approvals table for petty-cash approval workflows.

Revision ID: 075_expense_approvals
Revises: 074_dashboard_templates_shares
Create Date: 2025-01-01 00:00:00.000000

Why a separate approvals table instead of columns on expense_requests?
Multi-level approval workflows require one row per approval level per request.
A join table with a unique constraint on (request_id, approval_level) enforces
exactly one decision per tier while allowing any number of approval levels.
"""

revision = "075_expense_approvals"
down_revision = "074_dashboard_templates_shares"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


def upgrade() -> None:
    op.create_table(
        "expense_approvals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("request_id", UUID(as_uuid=True), sa.ForeignKey("expense_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("approver_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("approval_level", sa.Integer, nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("requested_date", sa.Date, nullable=True),
        sa.Column("required_by_date", sa.Date, nullable=True),
        sa.Column("approved_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("disbursed_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("priority", sa.String(20), nullable=False, server_default="normal"),
        sa.Column("tags", sa.ARRAY(sa.Text), nullable=True),
        sa.Column("attachments", JSONB, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("request_id", "approval_level", name="uq_expense_approval_level"),
    )

    op.create_index("ix_expense_approvals_request_id", "expense_approvals", ["request_id"])
    op.create_index("ix_expense_approvals_approver_id", "expense_approvals", ["approver_id"])
    op.create_index("ix_expense_approvals_status", "expense_approvals", ["status"])


def downgrade() -> None:
    op.drop_index("ix_expense_approvals_status")
    op.drop_index("ix_expense_approvals_approver_id")
    op.drop_index("ix_expense_approvals_request_id")
    op.drop_table("expense_approvals")
