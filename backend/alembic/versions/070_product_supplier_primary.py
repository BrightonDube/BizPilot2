"""add is_primary to product_suppliers

Revision ID: 070_product_supplier_primary
Revises: f1a2b3c4d5e6
Create Date: 2025-07-15
"""

from alembic import op
import sqlalchemy as sa

from typing import Sequence, Union

revision: str = "070_product_supplier_primary"
down_revision: Union[str, None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column(
        "product_suppliers",
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default="false"),
    )

def downgrade() -> None:
    op.drop_column("product_suppliers", "is_primary")
