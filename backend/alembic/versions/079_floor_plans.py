"""Create floor_plans table for restaurant layout management.

Revision ID: 079_floor_plans
Revises: 078_stock_take_scope_counters
Create Date: 2025-01-01 00:00:00.000000

Why a floor_plans table?
Restaurants often have multiple floors or areas (main dining, patio, bar).
Each floor plan is a named canvas where tables are positioned visually.
Separating floor plans from tables allows the UI to render different
layouts and lets staff quickly switch between areas.
"""

revision = "079_floor_plans"
down_revision = "078_stock_take_scope_counters"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


def upgrade() -> None:
    op.create_table(
        "floor_plans",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("business_id", UUID(as_uuid=True), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("width", sa.Integer, nullable=False, server_default="800"),
        sa.Column("height", sa.Integer, nullable=False, server_default="600"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index("ix_floor_plans_business_id", "floor_plans", ["business_id"])


def downgrade() -> None:
    op.drop_index("ix_floor_plans_business_id")
    op.drop_table("floor_plans")
