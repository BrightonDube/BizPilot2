"""orders direction and supplier

Revision ID: 06e2032472c6
Revises: d21cfee4a049
Create Date: 2025-12-31 02:05:42.975277

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '06e2032472c6'
down_revision: Union[str, None] = 'd21cfee4a049'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    order_direction = postgresql.ENUM('inbound', 'outbound', name='orderdirection')
    order_direction.create(op.get_bind(), checkfirst=True)

    op.add_column('orders', sa.Column('supplier_id', sa.UUID(), nullable=True))
    op.create_index(op.f('ix_orders_supplier_id'), 'orders', ['supplier_id'], unique=False)
    op.create_foreign_key(
        'fk_orders_supplier_id_suppliers',
        'orders',
        'suppliers',
        ['supplier_id'],
        ['id'],
    )

    op.add_column(
        'orders',
        sa.Column(
            'direction',
            order_direction,
            nullable=False,
            server_default='inbound',
        ),
    )
    op.alter_column('orders', 'direction', server_default=None)



def downgrade() -> None:
    op.drop_column('orders', 'direction')

    op.drop_constraint('fk_orders_supplier_id_suppliers', 'orders', type_='foreignkey')
    op.drop_index(op.f('ix_orders_supplier_id'), table_name='orders')
    op.drop_column('orders', 'supplier_id')

    order_direction = postgresql.ENUM('inbound', 'outbound', name='orderdirection')
    order_direction.drop(op.get_bind(), checkfirst=True)

