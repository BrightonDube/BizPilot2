"""Add product-supplier association table

This migration creates the product_suppliers association table to enable
many-to-many relationships between products and suppliers.

Revision ID: 015_add_product_suppliers
Revises: 014_add_supplier_payment_fields
Create Date: 2026-01-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '015_add_product_suppliers'
down_revision: Union[str, None] = '014_add_supplier_payment_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create product_suppliers association table
    op.create_table(
        'product_suppliers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id'), nullable=False),
        sa.Column('supplier_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('suppliers.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
    )
    
    # Create indexes
    op.create_index('ix_product_suppliers_product_id', 'product_suppliers', ['product_id'])
    op.create_index('ix_product_suppliers_supplier_id', 'product_suppliers', ['supplier_id'])
    
    # Create unique constraint
    op.create_unique_constraint('uq_product_supplier', 'product_suppliers', ['product_id', 'supplier_id'])


def downgrade() -> None:
    op.drop_constraint('uq_product_supplier', 'product_suppliers', type_='unique')
    op.drop_index('ix_product_suppliers_supplier_id', table_name='product_suppliers')
    op.drop_index('ix_product_suppliers_product_id', table_name='product_suppliers')
    op.drop_table('product_suppliers')
