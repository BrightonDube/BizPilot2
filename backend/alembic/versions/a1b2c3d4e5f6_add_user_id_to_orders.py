"""Add user_id to orders table

Revision ID: a1b2c3d4e5f6
Revises: 04c9537675e7
Create Date: 2025-01-15 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "04c9537675e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index(op.f("ix_orders_user_id"), "orders", ["user_id"], unique=False)
    op.create_foreign_key("fk_orders_user_id_users", "orders", "users", ["user_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint("fk_orders_user_id_users", "orders", type_="foreignkey")
    op.drop_index(op.f("ix_orders_user_id"), table_name="orders")
    op.drop_column("orders", "user_id")
