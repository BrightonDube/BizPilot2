"""Create sections table for grouping tables within a floor plan.

Revision ID: 080_sections
Revises: 079_floor_plans
Create Date: 2025-01-01 00:00:00.000000

Why a sections table?
Within a floor plan, tables are often grouped into sections (e.g. "Window",
"Bar Area", "Private Dining").  Sections let managers assign staff to
specific areas and filter table views.  A section belongs to one floor plan.
"""

revision = "080_sections"
down_revision = "079_floor_plans"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


def upgrade() -> None:
    op.create_table(
        "sections",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("business_id", UUID(as_uuid=True), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("floor_plan_id", UUID(as_uuid=True), sa.ForeignKey("floor_plans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("color", sa.String(20), nullable=True),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index("ix_sections_business_id", "sections", ["business_id"])
    op.create_index("ix_sections_floor_plan_id", "sections", ["floor_plan_id"])

    # Add floor_plan_id and section_id FKs to existing restaurant_tables table
    op.add_column("restaurant_tables", sa.Column("floor_plan_id", UUID(as_uuid=True), sa.ForeignKey("floor_plans.id"), nullable=True))
    op.add_column("restaurant_tables", sa.Column("section_id", UUID(as_uuid=True), sa.ForeignKey("sections.id"), nullable=True))
    op.create_index("ix_restaurant_tables_floor_plan_id", "restaurant_tables", ["floor_plan_id"])
    op.create_index("ix_restaurant_tables_section_id", "restaurant_tables", ["section_id"])


def downgrade() -> None:
    op.drop_index("ix_restaurant_tables_section_id")
    op.drop_index("ix_restaurant_tables_floor_plan_id")
    op.drop_column("restaurant_tables", "section_id")
    op.drop_column("restaurant_tables", "floor_plan_id")
    op.drop_index("ix_sections_floor_plan_id")
    op.drop_index("ix_sections_business_id")
    op.drop_table("sections")
