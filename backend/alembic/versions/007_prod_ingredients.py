"""Add product ingredients (BOM) and labor minutes

Revision ID: 007_prod_ingredients
Revises: 006_fix_pay_enums_imgurl
Create Date: 2025-12-19 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "007_prod_ingredients"
down_revision: Union[str, None] = "006_fix_pay_enums_imgurl"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    product_columns = {c["name"] for c in inspector.get_columns("products")}
    if "labor_minutes" not in product_columns:
        op.add_column(
            "products",
            sa.Column("labor_minutes", sa.Integer(), nullable=False, server_default="0"),
        )

    op.create_table(
        "product_ingredients",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("unit", sa.String(length=50), nullable=False, server_default="unit"),
        sa.Column("quantity", sa.Numeric(12, 4), nullable=False, server_default="1"),
        sa.Column("cost", sa.Numeric(12, 4), nullable=False, server_default="0"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_product_ingredients_business_id", "product_ingredients", ["business_id"])
    op.create_index("ix_product_ingredients_product_id", "product_ingredients", ["product_id"])


def downgrade() -> None:
    op.drop_index("ix_product_ingredients_product_id", table_name="product_ingredients")
    op.drop_index("ix_product_ingredients_business_id", table_name="product_ingredients")
    op.drop_table("product_ingredients")
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    product_columns = {c["name"] for c in inspector.get_columns("products")}
    if "labor_minutes" in product_columns:
        op.drop_column("products", "labor_minutes")
