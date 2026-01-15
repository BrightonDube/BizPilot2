"""add_favorite_products_table

Revision ID: 49bdc7531641
Revises: 018_add_notifications
Create Date: 2026-01-15 22:30:32.367874

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '49bdc7531641'
down_revision: Union[str, None] = '018_add_notifications'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create favorite_products table
    op.create_table(
        'favorite_products',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('par_level', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('auto_reorder', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('reorder_quantity', sa.Integer(), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index('ix_favorite_products_business_id', 'favorite_products', ['business_id'])
    op.create_index('ix_favorite_products_product_id', 'favorite_products', ['product_id'])
    op.create_index('ix_favorite_products_user_id', 'favorite_products', ['user_id'])
    
    # Create unique constraint to prevent duplicate favorites
    op.create_index(
        'ix_favorite_products_unique',
        'favorite_products',
        ['business_id', 'product_id', 'user_id'],
        unique=True,
        postgresql_where=sa.text('deleted_at IS NULL')
    )


def downgrade() -> None:
    op.drop_index('ix_favorite_products_unique', table_name='favorite_products')
    op.drop_index('ix_favorite_products_user_id', table_name='favorite_products')
    op.drop_index('ix_favorite_products_product_id', table_name='favorite_products')
    op.drop_index('ix_favorite_products_business_id', table_name='favorite_products')
    op.drop_table('favorite_products')

