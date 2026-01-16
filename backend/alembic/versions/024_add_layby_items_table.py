"""add layby_items table

Revision ID: 024_add_layby_items
Revises: 023_add_laybys
Create Date: 2026-01-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '024_add_layby_items'
down_revision = '023_add_laybys'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create layby_items table for storing items within a layby.
    
    This table stores the individual products/items that are part of a layby.
    Each layby can have multiple items, and each item references a product
    with quantity, pricing, and discount information.
    
    Validates: Requirements 1.2
    """
    op.create_table(
        'layby_items',
        # Primary key
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        
        # Foreign key to laybys table (Requirement 1.2 - multiple products per layby)
        sa.Column('layby_id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Product reference
        sa.Column('product_id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Denormalized product info (for historical record keeping)
        sa.Column('product_name', sa.String(255), nullable=False),
        sa.Column('product_sku', sa.String(100), nullable=True),
        
        # Quantity and pricing
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('unit_price', sa.Numeric(10, 2), nullable=False),
        sa.Column('discount_amount', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('tax_amount', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('total_amount', sa.Numeric(10, 2), nullable=False),
        
        # Optional notes for the item
        sa.Column('notes', sa.Text(), nullable=True),
        
        # Timestamp
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        
        # Constraints
        sa.ForeignKeyConstraint(['layby_id'], ['laybys.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for common queries
    op.create_index('ix_layby_items_layby_id', 'layby_items', ['layby_id'])
    op.create_index('ix_layby_items_product_id', 'layby_items', ['product_id'])


def downgrade() -> None:
    """Drop layby_items table and its indexes."""
    # Drop indexes
    op.drop_index('ix_layby_items_product_id', table_name='layby_items')
    op.drop_index('ix_layby_items_layby_id', table_name='layby_items')
    
    # Drop table
    op.drop_table('layby_items')
