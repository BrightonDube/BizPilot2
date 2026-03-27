"""add_cash_drawer_sessions

Revision ID: 105_add_cash_drawer_sessions
Revises: 104_delivery_missing_add_delivery_management_missing_tables
Create Date: 2026-03-27

"""

from alembic import op
import sqlalchemy as sa

revision = "105_add_cash_drawer_sessions"
down_revision = "104_delivery_missing_add_delivery_management_missing_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cash_drawer_sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("business_id", sa.String(36), sa.ForeignKey("businesses.id"), nullable=False, index=True),
        sa.Column("opened_by_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("closed_by_id", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("opening_float", sa.Numeric(12, 2), nullable=False),
        sa.Column("closing_float", sa.Numeric(12, 2), nullable=True),
        sa.Column("expected_float", sa.Numeric(12, 2), nullable=True),
        sa.Column("variance", sa.Numeric(12, 2), nullable=True),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("cash_drawer_sessions")
