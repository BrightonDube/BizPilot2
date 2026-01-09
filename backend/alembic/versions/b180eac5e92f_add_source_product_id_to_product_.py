"""add source_product_id to product_ingredients

Revision ID: b180eac5e92f
Revises: b41692817381
Create Date: 2026-01-09 11:49:14.953617

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b180eac5e92f'
down_revision: Union[str, None] = 'b41692817381'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
 
    columns = {c["name"] for c in inspector.get_columns("product_ingredients")}
    if "source_product_id" not in columns:
        op.add_column(
            "product_ingredients",
            sa.Column("source_product_id", postgresql.UUID(as_uuid=True), nullable=True),
        )
 
    existing_indexes = {ix.get("name") for ix in inspector.get_indexes("product_ingredients")}
    if "ix_product_ingredients_source_product_id" not in existing_indexes:
        op.create_index(
            "ix_product_ingredients_source_product_id",
            "product_ingredients",
            ["source_product_id"],
        )
 
    existing_fks = {fk.get("name") for fk in inspector.get_foreign_keys("product_ingredients")}
    if "fk_product_ingredients_source_product_id_products" not in existing_fks:
        op.create_foreign_key(
            "fk_product_ingredients_source_product_id_products",
            "product_ingredients",
            "products",
            ["source_product_id"],
            ["id"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
 
    existing_fks = {fk.get("name") for fk in inspector.get_foreign_keys("product_ingredients")}
    if "fk_product_ingredients_source_product_id_products" in existing_fks:
        op.drop_constraint(
            "fk_product_ingredients_source_product_id_products",
            "product_ingredients",
            type_="foreignkey",
        )
 
    existing_indexes = {ix.get("name") for ix in inspector.get_indexes("product_ingredients")}
    if "ix_product_ingredients_source_product_id" in existing_indexes:
        op.drop_index("ix_product_ingredients_source_product_id", table_name="product_ingredients")
 
    columns = {c["name"] for c in inspector.get_columns("product_ingredients")}
    if "source_product_id" in columns:
        op.drop_column("product_ingredients", "source_product_id")
