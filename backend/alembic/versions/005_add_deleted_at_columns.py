"""Add deleted_at columns for soft delete support

Revision ID: 005_add_deleted_at_columns
Revises: a90cb766ccf3
Create Date: 2025-12-18 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "005_add_deleted_at_columns"
down_revision: Union[str, None] = "a90cb766ccf3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_TABLES = [
    "users",
    "organizations",
    "businesses",
    "roles",
    "business_users",
    "product_categories",
    "products",
    "customers",
    "orders",
    "order_items",
    "invoices",
    "invoice_items",
    "inventory_items",
    "inventory_transactions",
]


def upgrade() -> None:
    for table in _TABLES:
        op.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ")


def downgrade() -> None:
    for table in _TABLES:
        op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS deleted_at")
