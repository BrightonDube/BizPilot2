"""Add composite indexes for dashboard performance

Revision ID: 004_performance_indexes
Revises: 8f1e3ca8b3e8
Create Date: 2024-12-17

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '004_performance_indexes'
down_revision: Union[str, None] = '8f1e3ca8b3e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Composite index for orders queries filtered by business_id + created_at
    # This dramatically speeds up dashboard stats, revenue-by-month queries
    op.create_index(
        'ix_orders_business_created',
        'orders',
        ['business_id', 'created_at'],
        if_not_exists=True
    )
    
    # Composite index for products filtered by business_id + status
    # Speeds up product counts and low-stock queries
    op.create_index(
        'ix_products_business_status',
        'products',
        ['business_id', 'status'],
        if_not_exists=True
    )
    
    # Composite index for products with inventory tracking
    op.create_index(
        'ix_products_business_inventory',
        'products',
        ['business_id', 'track_inventory', 'quantity'],
        if_not_exists=True
    )
    
    # Composite index for invoices by business + status
    op.create_index(
        'ix_invoices_business_status',
        'invoices',
        ['business_id', 'status'],
        if_not_exists=True
    )
    
    # Index for business_users lookup (frequently used in auth)
    op.create_index(
        'ix_business_users_user_status',
        'business_users',
        ['user_id', 'status'],
        if_not_exists=True
    )


def downgrade() -> None:
    op.drop_index('ix_business_users_user_status', table_name='business_users')
    op.drop_index('ix_invoices_business_status', table_name='invoices')
    op.drop_index('ix_products_business_inventory', table_name='products')
    op.drop_index('ix_products_business_status', table_name='products')
    op.drop_index('ix_orders_business_created', table_name='orders')
