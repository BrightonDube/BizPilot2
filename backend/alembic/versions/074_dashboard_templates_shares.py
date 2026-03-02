"""Add dashboard_templates, dashboard_shares, export_schedules tables.

Extends the custom dashboards system with:
  - dashboard_templates: pre-built and user-saved dashboard configurations
  - dashboard_shares: fine-grained sharing (view/edit) between users
  - dashboard_export_schedules: recurring PDF/CSV exports via email

Why three separate tables instead of one?
  Templates, shares, and schedules have independent lifecycles and different
  FK relationships.  Merging them would create a wide, sparse table.

Revision ID: 074_dashboard_templates_shares
Revises: 073_bulk_operations
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


revision = "074_dashboard_templates_shares"
down_revision = "073_bulk_operations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Dashboard Templates ─────────────────────────────────────────
    op.create_table(
        "dashboard_templates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("business_id", UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=True, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("category", sa.String(100), nullable=True),
        # Full layout + widget config serialised as JSON so a template can
        # recreate a complete dashboard in one step.
        sa.Column("layout", JSONB, nullable=False, server_default="{}"),
        sa.Column("widgets_config", JSONB, nullable=False, server_default="[]"),
        sa.Column("thumbnail_url", sa.String(500), nullable=True),
        # System templates (business_id=NULL) are read-only for users
        sa.Column("is_system", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── Dashboard Shares ────────────────────────────────────────────
    op.create_table(
        "dashboard_shares",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("dashboard_id", UUID(as_uuid=True), sa.ForeignKey("dashboards.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("shared_with_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("permission", sa.String(20), nullable=False, server_default="view"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        # Prevent duplicate shares for the same user+dashboard pair
        sa.UniqueConstraint("dashboard_id", "shared_with_user_id", name="uq_dashboard_share_user"),
    )

    # ── Dashboard Export Schedules ──────────────────────────────────
    op.create_table(
        "dashboard_export_schedules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("dashboard_id", UUID(as_uuid=True), sa.ForeignKey("dashboards.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("format", sa.String(20), nullable=False, server_default="pdf"),
        sa.Column("frequency", sa.String(20), nullable=False, server_default="weekly"),
        sa.Column("recipients", JSONB, nullable=False, server_default="[]"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("last_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_send_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("dashboard_export_schedules")
    op.drop_table("dashboard_shares")
    op.drop_table("dashboard_templates")
