"""Staff targets and performance tables.

Revision ID: 067_staff_targets
Revises: 066_proforma_invoices
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "067_staff_targets"
down_revision = "066_proforma_invoices"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # staff_targets
    op.create_table(
        "staff_targets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("target_type", sa.String(30), nullable=False),
        sa.Column("period_type", sa.String(20), nullable=False),
        sa.Column("period_start", sa.Date, nullable=False),
        sa.Column("period_end", sa.Date, nullable=False),
        sa.Column("target_value", sa.Numeric(12, 2), nullable=False),
        sa.Column("achieved_value", sa.Numeric(12, 2), server_default="0"),
        sa.Column("status", sa.String(20), server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_staff_targets_business_id", "staff_targets", ["business_id"])
    op.create_index("ix_staff_targets_user_id", "staff_targets", ["user_id"])
    op.create_index("ix_staff_targets_period", "staff_targets", ["period_start", "period_end"])

    # target_templates
    op.create_table(
        "target_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("role_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("target_type", sa.String(30), nullable=False),
        sa.Column("period_type", sa.String(20), nullable=False),
        sa.Column("default_value", sa.Numeric(12, 2), nullable=False),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_target_templates_business_id", "target_templates", ["business_id"])

    # commission_rules
    op.create_table(
        "commission_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("rule_type", sa.String(20), nullable=False),
        sa.Column("rate", sa.Numeric(5, 2), nullable=False),
        sa.Column("min_threshold", sa.Numeric(12, 2), nullable=True),
        sa.Column("max_threshold", sa.Numeric(12, 2), nullable=True),
        sa.Column("cap_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("product_category_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_commission_rules_business_id", "commission_rules", ["business_id"])

    # commission_tiers
    op.create_table(
        "commission_tiers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("rule_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("commission_rules.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tier_order", sa.Integer, nullable=False),
        sa.Column("min_value", sa.Numeric(12, 2), nullable=False),
        sa.Column("max_value", sa.Numeric(12, 2), nullable=True),
        sa.Column("rate", sa.Numeric(5, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_commission_tiers_rule_id", "commission_tiers", ["rule_id"])

    # staff_commissions
    op.create_table(
        "staff_commissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("period_start", sa.Date, nullable=False),
        sa.Column("period_end", sa.Date, nullable=False),
        sa.Column("total_sales", sa.Numeric(12, 2), nullable=False),
        sa.Column("commission_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_staff_commissions_user_id", "staff_commissions", ["user_id"])
    op.create_index("ix_staff_commissions_business_id", "staff_commissions", ["business_id"])

    # commission_details
    op.create_table(
        "commission_details",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("commission_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("staff_commissions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sale_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("commission_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("rule_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("commission_rules.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_commission_details_commission_id", "commission_details", ["commission_id"])

    # incentive_programs
    op.create_table(
        "incentive_programs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("incentive_type", sa.String(20), nullable=False),
        sa.Column("target_type", sa.String(30), nullable=False),
        sa.Column("target_value", sa.Numeric(12, 2), nullable=False),
        sa.Column("reward_type", sa.String(20), nullable=False),
        sa.Column("reward_value", sa.Numeric(12, 2), nullable=False),
        sa.Column("start_date", sa.Date, nullable=False),
        sa.Column("end_date", sa.Date, nullable=False),
        sa.Column("is_team", sa.Boolean, server_default="false"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_incentive_programs_business_id", "incentive_programs", ["business_id"])

    # incentive_achievements
    op.create_table(
        "incentive_achievements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("incentive_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("incentive_programs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("achieved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reward_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_incentive_achievements_incentive_id", "incentive_achievements", ["incentive_id"])
    op.create_index("ix_incentive_achievements_user_id", "incentive_achievements", ["user_id"])

    # performance_snapshots
    op.create_table(
        "performance_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("snapshot_date", sa.Date, nullable=False),
        sa.Column("total_sales", sa.Numeric(12, 2), server_default="0"),
        sa.Column("transaction_count", sa.Integer, server_default="0"),
        sa.Column("item_count", sa.Integer, server_default="0"),
        sa.Column("customer_count", sa.Integer, server_default="0"),
        sa.Column("avg_transaction", sa.Numeric(12, 2), server_default="0"),
        sa.Column("hours_worked", sa.Numeric(5, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_performance_snapshots_user_id", "performance_snapshots", ["user_id"])
    op.create_index("ix_performance_snapshots_business_id", "performance_snapshots", ["business_id"])
    op.create_index("ix_performance_snapshots_date", "performance_snapshots", ["snapshot_date"])
    op.create_unique_constraint(
        "uq_perf_snapshot_user_biz_date",
        "performance_snapshots",
        ["user_id", "business_id", "snapshot_date"],
    )


def downgrade() -> None:
    op.drop_table("performance_snapshots")
    op.drop_table("incentive_achievements")
    op.drop_table("incentive_programs")
    op.drop_table("commission_details")
    op.drop_table("staff_commissions")
    op.drop_table("commission_tiers")
    op.drop_table("commission_rules")
    op.drop_table("target_templates")
    op.drop_table("staff_targets")
