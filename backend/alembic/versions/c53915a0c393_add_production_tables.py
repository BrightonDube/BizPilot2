"""add production tables

Revision ID: c53915a0c393
Revises: b180eac5e92f
Create Date: 2026-01-09 11:51:01.768034

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'c53915a0c393'
down_revision: Union[str, None] = 'b180eac5e92f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # NOTE:
    # - We create the Postgres enum type in an idempotent way.
    # - We also set create_type=False on the SQLAlchemy enum so that
    #   table creation doesn't try to CREATE TYPE again.
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE productionstatus AS ENUM "
        "('draft','pending','in_progress','completed','cancelled'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; "
        "END $$;"
    )

    production_status_enum = postgresql.ENUM(
        "draft",
        "pending",
        "in_progress",
        "completed",
        "cancelled",
        name="productionstatus",
        create_type=False,
    )

    op.create_table(
        "production_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("order_number", sa.String(length=50), nullable=False),
        sa.Column("quantity_to_produce", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("quantity_produced", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", production_status_enum, nullable=False, server_default="draft"),
        sa.Column("scheduled_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("estimated_cost", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("actual_cost", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index("ix_production_orders_business_id", "production_orders", ["business_id"])
    op.create_index("ix_production_orders_product_id", "production_orders", ["product_id"])
    op.create_index("ix_production_orders_order_number", "production_orders", ["order_number"])
    op.create_index("ix_production_orders_status", "production_orders", ["status"])

    op.create_table(
        "production_order_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column(
            "production_order_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("production_orders.id"),
            nullable=False,
        ),
        sa.Column("source_product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("unit", sa.String(length=50), nullable=False, server_default="unit"),
        sa.Column("quantity_required", sa.Numeric(12, 4), nullable=False, server_default="0"),
        sa.Column("quantity_used", sa.Numeric(12, 4), nullable=False, server_default="0"),
        sa.Column("unit_cost", sa.Numeric(12, 4), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index("ix_production_order_items_business_id", "production_order_items", ["business_id"])
    op.create_index(
        "ix_production_order_items_production_order_id",
        "production_order_items",
        ["production_order_id"],
    )
    op.create_index(
        "ix_production_order_items_source_product_id",
        "production_order_items",
        ["source_product_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_production_order_items_source_product_id", table_name="production_order_items")
    op.drop_index("ix_production_order_items_production_order_id", table_name="production_order_items")
    op.drop_index("ix_production_order_items_business_id", table_name="production_order_items")
    op.drop_table("production_order_items")

    op.drop_index("ix_production_orders_status", table_name="production_orders")
    op.drop_index("ix_production_orders_order_number", table_name="production_orders")
    op.drop_index("ix_production_orders_product_id", table_name="production_orders")
    op.drop_index("ix_production_orders_business_id", table_name="production_orders")
    op.drop_table("production_orders")

    production_status_enum = postgresql.ENUM(
        "draft",
        "pending",
        "in_progress",
        "completed",
        "cancelled",
        name="productionstatus",
        create_type=False,
    )
    production_status_enum.drop(op.get_bind(), checkfirst=True)
