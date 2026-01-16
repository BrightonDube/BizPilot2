"""add layby_audit table

Revision ID: 027_add_layby_audit
Revises: 026_add_layby_payments
Create Date: 2026-01-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '027_add_layby_audit'
down_revision = '026_add_layby_payments'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create layby_audit table for tracking all changes and actions on laybys.
    
    This table provides a complete audit trail for laybys, recording all state changes,
    payments, modifications, cancellations, extensions, and customer communications.
    The old_value and new_value columns use JSONB to store flexible before/after state.
    
    Validates: Requirements 11.1-11.8
    - 11.1: Record all layby state changes with timestamp and operator
    - 11.2: Record all payment transactions with full details
    - 11.3: Record all modifications to payment schedules
    - 11.4: Record all cancellations with reasons and fee calculations
    - 11.5: Record all extensions with reasons and new terms
    - 11.6: Record all customer communications sent
    - 11.7: Make audit trail viewable but not editable
    - 11.8: Support searching audit trail by layby, customer, operator, or date range
    """
    op.create_table(
        'layby_audit',
        # Primary key
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        
        # Foreign key to laybys table
        sa.Column('layby_id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Action type describing what happened
        # Actions: created, payment_made, payment_refunded, schedule_updated,
        # extended, cancelled, collected, status_changed, reminder_sent, etc.
        # (Requirements 11.1-11.6 - record various action types)
        sa.Column('action', sa.String(50), nullable=False),
        
        # JSONB columns for storing old and new values
        # This allows flexible storage of any state changes
        # (Requirements 11.1-11.5 - capture full details of changes)
        sa.Column('old_value', postgresql.JSONB(), nullable=True),
        sa.Column('new_value', postgresql.JSONB(), nullable=True),
        
        # Additional details/notes about the action
        sa.Column('details', sa.Text(), nullable=True),
        
        # User who performed the action (Requirement 11.1 - record operator)
        sa.Column('performed_by', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Terminal ID - nullable without FK since terminals table may not exist
        sa.Column('terminal_id', postgresql.UUID(as_uuid=True), nullable=True),
        
        # IP address for additional audit context
        sa.Column('ip_address', sa.String(45), nullable=True),
        
        # Timestamp (Requirement 11.1 - record timestamp)
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        
        # Constraints
        sa.ForeignKeyConstraint(['layby_id'], ['laybys.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['performed_by'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create index for looking up all audit records for a layby (Requirement 11.8 - search by layby)
    op.create_index('idx_layby_audit_layby', 'layby_audit', ['layby_id'])
    
    # Create index for searching by date range (Requirement 11.8 - search by date range)
    op.create_index('idx_layby_audit_created', 'layby_audit', ['created_at'])


def downgrade() -> None:
    """Drop layby_audit table and its indexes."""
    # Drop indexes
    op.drop_index('idx_layby_audit_created', table_name='layby_audit')
    op.drop_index('idx_layby_audit_layby', table_name='layby_audit')
    
    # Drop table
    op.drop_table('layby_audit')
