"""Create core partner administration tables.

Revision ID: 090_partners
Revises: 089_digital_signage
Create Date: 2025-01-01 00:00:00.000000

Why a multi-tenant partner system?
BizPilot supports white-label resellers (partners) who onboard
businesses under their brand.  Partners need their own configuration,
branding, user management, and billing — all isolated from the
direct B2B tenant model.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


revision = "090_partners"
down_revision = "089_digital_signage"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # -- partners: reseller/partner organisations --------------------------
    op.create_table(
        "partners",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("partner_name", sa.String(255), nullable=False),
        sa.Column("partner_identifier", sa.String(100), nullable=False, unique=True),
        sa.Column("partner_slug", sa.String(100), nullable=False, unique=True),
        sa.Column("company_name", sa.String(255), nullable=True),
        sa.Column(
            "status",
            sa.String(20),
            server_default="pending",
            nullable=False,
            comment="pending | active | suspended | terminated",
        ),
        sa.Column("subscription_tier", sa.String(50), nullable=True),
        sa.Column("user_limit", sa.Integer, nullable=True),
        sa.Column("location_limit", sa.Integer, nullable=True),
        sa.Column("api_rate_limit", sa.Integer, nullable=True),
        sa.Column("billing_cycle", sa.String(20), server_default="monthly", nullable=False),
        sa.Column("billing_currency", sa.String(3), server_default="ZAR", nullable=False),
        sa.Column("revenue_share_percentage", sa.Numeric(5, 2), nullable=True),
        sa.Column(
            "parent_partner_id",
            UUID(as_uuid=True),
            sa.ForeignKey("partners.id"),
            nullable=True,
            comment="For sub-partner hierarchy",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # -- partner_configurations: feature flags and business rules -----------
    op.create_table(
        "partner_configurations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "partner_id",
            UUID(as_uuid=True),
            sa.ForeignKey("partners.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("features_enabled", JSONB, nullable=True),
        sa.Column("features_disabled", JSONB, nullable=True),
        sa.Column("business_rules", JSONB, nullable=True),
        sa.Column("workflow_config", JSONB, nullable=True),
        sa.Column("integration_config", JSONB, nullable=True),
        sa.Column("notification_settings", JSONB, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    # -- white_label_configs: branding per partner -------------------------
    op.create_table(
        "white_label_configs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "partner_id",
            UUID(as_uuid=True),
            sa.ForeignKey("partners.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("brand_name", sa.String(255), nullable=False),
        sa.Column("logo_url", sa.String(500), nullable=True),
        sa.Column("primary_color", sa.String(7), nullable=True),
        sa.Column("secondary_color", sa.String(7), nullable=True),
        sa.Column("custom_domain", sa.String(255), nullable=True),
        sa.Column("subdomain", sa.String(100), nullable=True),
        sa.Column("app_name", sa.String(255), nullable=True),
        sa.Column("theme_config", JSONB, nullable=True),
        sa.Column("custom_css", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
    )

    # -- partner_users: user access within a partner org -------------------
    op.create_table(
        "partner_users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "partner_id",
            UUID(as_uuid=True),
            sa.ForeignKey("partners.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("partner_role", sa.String(100), server_default="viewer", nullable=False),
        sa.Column("permissions", JSONB, nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="true", nullable=False),
        sa.Column("is_primary_contact", sa.Boolean, server_default="false", nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("partner_id", "user_id", name="uq_partner_users_partner_user"),
    )

def downgrade() -> None:
    op.drop_table("partner_users")
    op.drop_table("white_label_configs")
    op.drop_table("partner_configurations")
    op.drop_table("partners")
