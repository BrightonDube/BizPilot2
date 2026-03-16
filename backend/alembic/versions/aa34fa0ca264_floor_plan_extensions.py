"""floor_plan_extensions

Revision ID: aa34fa0ca264
Revises: 3bc48f58a175
Create Date: 2026-03-13 12:40:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = 'aa34fa0ca264'
down_revision: Union[str, None] = '3bc48f58a175'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. Update floor_plans table
    op.add_column("floor_plans", sa.Column("width_units", sa.Integer(), server_default="100", nullable=False))
    op.add_column("floor_plans", sa.Column("height_units", sa.Integer(), server_default="100", nullable=False))

    # 2. Create floor_plan_tables table
    op.create_table(
        "floor_plan_tables",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("business_id", UUID(as_uuid=True), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("floor_plan_id", UUID(as_uuid=True), sa.ForeignKey("floor_plans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("section", sa.String(50), nullable=True),
        sa.Column("x_position", sa.Numeric(5, 2), nullable=False),
        sa.Column("y_position", sa.Numeric(5, 2), nullable=False),
        sa.Column("width", sa.Numeric(5, 2), server_default="10.00", nullable=False),
        sa.Column("height", sa.Numeric(5, 2), server_default="10.00", nullable=False),
        sa.Column("capacity", sa.Integer(), server_default="4", nullable=False),
        sa.Column("shape", sa.String(20), server_default="rectangle", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_floor_plan_tables_business_id", "floor_plan_tables", ["business_id"])
    op.create_index("ix_floor_plan_tables_floor_plan_id", "floor_plan_tables", ["floor_plan_id"])

    # 3. Create floor_plan_section_assignments table
    op.create_table(
        "floor_plan_section_assignments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("business_id", UUID(as_uuid=True), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("section_name", sa.String(50), nullable=False),
        sa.Column("waiter_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("floor_plan_id", UUID(as_uuid=True), sa.ForeignKey("floor_plans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_floor_plan_section_assignments_business_id", "floor_plan_section_assignments", ["business_id"])

def downgrade() -> None:
    op.drop_index("ix_floor_plan_section_assignments_business_id")
    op.drop_table("floor_plan_section_assignments")
    op.drop_index("ix_floor_plan_tables_floor_plan_id")
    op.drop_index("ix_floor_plan_tables_business_id")
    op.drop_table("floor_plan_tables")
    op.drop_column("floor_plans", "height_units")
    op.drop_column("floor_plans", "width_units")
