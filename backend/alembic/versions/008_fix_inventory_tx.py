"""Fix inventory_transactions columns to match model

Revision ID: 008_fix_inventory_tx
Revises: 007_prod_ingredients
Create Date: 2025-12-19 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '008_fix_inventory_tx'
down_revision: Union[str, None] = '007_prod_ingredients'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(bind, table_name: str, column_name: str) -> bool:
    insp = sa.inspect(bind)
    cols = insp.get_columns(table_name)
    return any(c['name'] == column_name for c in cols)


def upgrade() -> None:
    bind = op.get_bind()

    # inventory_transactions was originally created with legacy columns (quantity, performed_by, performed_at).
    # The current ORM expects quantity_change/quantity_before/quantity_after and user_id.

    with op.batch_alter_table('inventory_transactions') as batch_op:
        # Legacy NOT NULL column that the current ORM doesn't populate.
        # If it exists, ensure inserts won't fail by giving it a default and allowing NULL.
        if _has_column(bind, 'inventory_transactions', 'quantity'):
            batch_op.alter_column(
                'quantity',
                existing_type=sa.Integer(),
                nullable=True,
                server_default='0',
            )

        if not _has_column(bind, 'inventory_transactions', 'quantity_change'):
            batch_op.add_column(sa.Column('quantity_change', sa.Integer(), nullable=True))
        if not _has_column(bind, 'inventory_transactions', 'quantity_before'):
            batch_op.add_column(sa.Column('quantity_before', sa.Integer(), nullable=True))
        if not _has_column(bind, 'inventory_transactions', 'quantity_after'):
            batch_op.add_column(sa.Column('quantity_after', sa.Integer(), nullable=True))
        if not _has_column(bind, 'inventory_transactions', 'total_cost'):
            batch_op.add_column(sa.Column('total_cost', sa.Numeric(12, 2), nullable=True))
        if not _has_column(bind, 'inventory_transactions', 'from_location'):
            batch_op.add_column(sa.Column('from_location', sa.String(100), nullable=True))
        if not _has_column(bind, 'inventory_transactions', 'to_location'):
            batch_op.add_column(sa.Column('to_location', sa.String(100), nullable=True))
        if not _has_column(bind, 'inventory_transactions', 'user_id'):
            batch_op.add_column(sa.Column('user_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=True))

    # Best-effort backfill for existing rows created under the legacy schema.
    # We map:
    # - quantity -> quantity_change
    # - performed_by -> user_id
    # - performed_at -> created_at (only if created_at is null)
    # quantity_before/after are not derivable; we set to 0/quantity_change when missing.

    if _has_column(bind, 'inventory_transactions', 'quantity') and _has_column(bind, 'inventory_transactions', 'quantity_change'):
        op.execute(
            """
            UPDATE inventory_transactions
            SET quantity_change = quantity
            WHERE quantity_change IS NULL
            """
        )

        if _has_column(bind, 'inventory_transactions', 'quantity_before'):
            op.execute(
                """
                UPDATE inventory_transactions
                SET quantity_before = 0
                WHERE quantity_before IS NULL
                """
            )

        if _has_column(bind, 'inventory_transactions', 'quantity_after'):
            op.execute(
                """
                UPDATE inventory_transactions
                SET quantity_after = COALESCE(quantity_change, 0)
                WHERE quantity_after IS NULL
                """
            )

    if _has_column(bind, 'inventory_transactions', 'performed_by') and _has_column(bind, 'inventory_transactions', 'user_id'):
        op.execute(
            """
            UPDATE inventory_transactions
            SET user_id = performed_by
            WHERE user_id IS NULL
            """
        )

    if _has_column(bind, 'inventory_transactions', 'performed_at'):
        # created_at exists on BaseModel, but older rows might have performed_at only.
        if _has_column(bind, 'inventory_transactions', 'created_at'):
            op.execute(
                """
                UPDATE inventory_transactions
                SET created_at = performed_at
                WHERE created_at IS NULL AND performed_at IS NOT NULL
                """
            )


def downgrade() -> None:
    bind = op.get_bind()

    with op.batch_alter_table('inventory_transactions') as batch_op:
        if _has_column(bind, 'inventory_transactions', 'quantity'):
            batch_op.alter_column(
                'quantity',
                existing_type=sa.Integer(),
                nullable=False,
                server_default=None,
            )

        if _has_column(bind, 'inventory_transactions', 'user_id'):
            batch_op.drop_column('user_id')
        if _has_column(bind, 'inventory_transactions', 'to_location'):
            batch_op.drop_column('to_location')
        if _has_column(bind, 'inventory_transactions', 'from_location'):
            batch_op.drop_column('from_location')
        if _has_column(bind, 'inventory_transactions', 'total_cost'):
            batch_op.drop_column('total_cost')
        if _has_column(bind, 'inventory_transactions', 'quantity_after'):
            batch_op.drop_column('quantity_after')
        if _has_column(bind, 'inventory_transactions', 'quantity_before'):
            batch_op.drop_column('quantity_before')
        if _has_column(bind, 'inventory_transactions', 'quantity_change'):
            batch_op.drop_column('quantity_change')
