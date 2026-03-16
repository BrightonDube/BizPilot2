"""Add report_templates table

Revision ID: 064_report_templates
Revises: 063_commission_records
Create Date: 2026-03-01 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from typing import Sequence, Union

revision: str = "064_report_templates"
down_revision: Union[str, None] = "063_commission_records"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table(
        "report_templates",
        sa.Column("id", sa.UUID(), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("business_id", sa.UUID(), nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("report_type", sa.String(50), nullable=False, server_default="custom"),
        sa.Column("metrics", JSONB(), nullable=False, server_default="[]"),
        sa.Column("filters", JSONB(), nullable=False, server_default="{}"),
        sa.Column("group_by", JSONB(), nullable=False, server_default="[]"),
        sa.Column("sort_by", sa.String(100), nullable=True),
        sa.Column("sort_direction", sa.String(4), nullable=True, server_default="desc"),
        sa.Column("is_scheduled", sa.Boolean(), server_default="false"),
        sa.Column("schedule_cron", sa.String(100), nullable=True),
        sa.Column("schedule_recipients", JSONB(), nullable=True, server_default="[]"),
        sa.Column("is_public", sa.Boolean(), server_default="false"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_report_templates_business_id", "report_templates", ["business_id"])

def downgrade() -> None:
    op.drop_index("ix_report_templates_business_id", table_name="report_templates")
    op.drop_table("report_templates")
