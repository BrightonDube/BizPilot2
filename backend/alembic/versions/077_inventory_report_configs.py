"""Create inventory_report_configs table for saved report settings.

Revision ID: 077_inventory_report_configs
Revises: 076_gl_account_mappings
Create Date: 2025-01-01 00:00:00.000000

Why persist report configs?
Users frequently re-run the same inventory reports with identical filters
(date ranges, categories, locations).  Saving configs avoids repetitive
setup and enables scheduled report emails to reference a stored config.
"""

revision = "077_inventory_report_configs"
down_revision = "076_gl_account_mappings"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


def upgrade() -> None:
    op.create_table(
        "inventory_report_configs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("business_id", UUID(as_uuid=True), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("report_type", sa.String(50), nullable=False),
        sa.Column("filters", JSONB, nullable=True),
        sa.Column("group_by", sa.String(50), nullable=True),
        sa.Column("sort_by", sa.String(50), nullable=True),
        sa.Column("sort_direction", sa.String(4), nullable=True, server_default="asc"),
        sa.Column("is_default", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("is_shared", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("schedule_cron", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index("ix_inventory_report_configs_business_id", "inventory_report_configs", ["business_id"])
    op.create_index("ix_inventory_report_configs_created_by", "inventory_report_configs", ["created_by_id"])
    op.create_index("ix_inventory_report_configs_report_type", "inventory_report_configs", ["report_type"])


def downgrade() -> None:
    op.drop_index("ix_inventory_report_configs_report_type")
    op.drop_index("ix_inventory_report_configs_created_by")
    op.drop_index("ix_inventory_report_configs_business_id")
    op.drop_table("inventory_report_configs")
