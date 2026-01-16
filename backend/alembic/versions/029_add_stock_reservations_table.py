"""add stock_reservations table

Revision ID: 029_add_stock_reservations
Revises: 028_add_layby_notifications
Create Date: 2026-01-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '029_add_stock_reservations'
down_revision = '028_add_layby_notifications'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create stock_reservations table for tracking reserved inventory for laybys.
    
    This table manages stock reservations when laybys are created, ensuring that
    layby items are set aside and not available for regular sale. It tracks the
    reservation status through the layby lifecycle: reserved when created,
    released if cancelled, and collected when the layby is completed.
    
    Validates: Requirements 9.1-9.7
    - 9.1: Reduce available stock by layby quantities when layby is created
    - 9.2: Return reserved quantities to available stock when layby is cancelled
    - 9.3: Remove reserved quantities from total inventory when layby is collected
    - 9.4: Track reserved stock separately from available stock
    - 9.5: Prevent creating a layby if insufficient stock is available
    - 9.6: Display reserved stock quantities in inventory reports
    - 9.7: Flag layby for review if reserved product is discontinued
    """
    op.create_table(
        'stock_reservations',
        # Primary key
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        
        # Foreign key to laybys table (Requirement 9.1 - link reservation to layby)
        sa.Column('layby_id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Foreign key to products table (Requirement 9.4 - track by product)
        sa.Column('product_id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Location ID for location-specific stock tracking
        # Made nullable without FK since locations table may not exist
        # (Requirement 9.6 - support location-based inventory reports)
        sa.Column('location_id', postgresql.UUID(as_uuid=True), nullable=True),
        
        # Quantity of product reserved for this layby
        # (Requirement 9.1 - reduce available stock by this quantity)
        sa.Column('quantity', sa.Integer(), nullable=False),
        
        # Reservation status tracking the lifecycle of the reservation
        # Values: reserved, released, collected
        # - reserved: Initial state when layby is created (Requirement 9.1)
        # - released: When layby is cancelled, stock returns to available (Requirement 9.2)
        # - collected: When layby is completed, stock is removed from inventory (Requirement 9.3)
        sa.Column('status', sa.String(20), nullable=False, server_default='reserved'),
        
        # Timestamp when the stock was reserved (layby creation time)
        sa.Column('reserved_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        
        # Timestamp when the stock was released (cancellation) or collected (completion)
        sa.Column('released_at', sa.DateTime(timezone=True), nullable=True),
        
        # Constraints
        sa.ForeignKeyConstraint(['layby_id'], ['laybys.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        
        # Unique constraint to prevent duplicate reservations for same product/location in a layby
        sa.UniqueConstraint('layby_id', 'product_id', 'location_id', name='uq_stock_reservation_layby_product_location')
    )
    
    # Create index for looking up reservations by product
    # (Requirement 9.6 - efficient queries for inventory reports showing reserved stock)
    op.create_index('idx_stock_reservations_product', 'stock_reservations', ['product_id'])
    
    # Create index for looking up all reservations for a layby
    op.create_index('idx_stock_reservations_layby', 'stock_reservations', ['layby_id'])
    
    # Create index for filtering by status (useful for finding active reservations)
    op.create_index('idx_stock_reservations_status', 'stock_reservations', ['status'])
    
    # Create index for location-based queries
    op.create_index('idx_stock_reservations_location', 'stock_reservations', ['location_id'])


def downgrade() -> None:
    """Drop stock_reservations table and its indexes."""
    # Drop indexes
    op.drop_index('idx_stock_reservations_location', table_name='stock_reservations')
    op.drop_index('idx_stock_reservations_status', table_name='stock_reservations')
    op.drop_index('idx_stock_reservations_layby', table_name='stock_reservations')
    op.drop_index('idx_stock_reservations_product', table_name='stock_reservations')
    
    # Drop table
    op.drop_table('stock_reservations')
