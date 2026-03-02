"""Add inventory periods, period snapshots, ABC classification, stock count history.

Revision ID: 094_month_end_extensions
Revises: 093_gl_extensions
Create Date: 2025-01-01 00:00:00.000000

Why these tables?
- inventory_periods: Month-end close/reopen lifecycle for inventory valuation.
- period_snapshots: Frozen product-level snapshot at close, used for COGS reporting.
- product_abc_classifications: Pareto-based counting frequency optimization.
- stock_count_history: Append-only recount log for blind-count auditing.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "094_month_end_extensions"
down_revision = "093_gl_extensions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -- inventory_periods: month-end close lifecycle -------------------
    op.create_table(
        "inventory_periods",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("business_id", UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("period_year", sa.Integer, nullable=False),
        sa.Column("period_month", sa.Integer, nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),  # open|closed|reopened
        sa.Column("opening_value", sa.Numeric(14, 2), server_default="0"),
        sa.Column("closing_value", sa.Numeric(14, 2), nullable=True),
        sa.Column("cogs", sa.Numeric(14, 2), nullable=True),
        sa.Column("adjustments_value", sa.Numeric(14, 2), server_default="0"),
        sa.Column("closed_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reopened_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("reopened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_unique_constraint(
        "uq_inventory_period", "inventory_periods",
        ["business_id", "period_year", "period_month"],
    )
    op.create_index("ix_inv_periods_business", "inventory_periods", ["business_id"])

    # -- period_snapshots: frozen product-level data at close -----------
    op.create_table(
        "period_snapshots",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("period_id", UUID(as_uuid=True), sa.ForeignKey("inventory_periods.id"), nullable=False),
        sa.Column("product_id", UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("quantity", sa.Integer, nullable=False, server_default="0"),
        sa.Column("unit_cost", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("total_value", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_unique_constraint(
        "uq_period_snapshot_product", "period_snapshots",
        ["period_id", "product_id"],
    )
    op.create_index("ix_period_snapshots_period", "period_snapshots", ["period_id"])

    # -- product_abc_classifications: Pareto-based counting priority ----
    op.create_table(
        "product_abc_classifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("business_id", UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("product_id", UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("classification", sa.String(1), nullable=False),  # A, B, C
        sa.Column("annual_value", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("count_frequency_days", sa.Integer, nullable=False, server_default="90"),
        sa.Column("last_counted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_unique_constraint(
        "uq_abc_classification_product", "product_abc_classifications",
        ["business_id", "product_id"],
    )
    op.create_index("ix_abc_class_business", "product_abc_classifications", ["business_id"])

    # -- stock_count_history: append-only recount log -------------------
    op.create_table(
        "stock_count_history",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("count_id", UUID(as_uuid=True), sa.ForeignKey("stock_counts.id"), nullable=False),
        sa.Column("counted_quantity", sa.Integer, nullable=False),
        sa.Column("counted_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("counted_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("notes", sa.Text, nullable=True),
    )
    op.create_index("ix_count_history_count", "stock_count_history", ["count_id"])


def downgrade() -> None:
    op.drop_table("stock_count_history")
    op.drop_table("product_abc_classifications")
    op.drop_table("period_snapshots")
    op.drop_table("inventory_periods")
