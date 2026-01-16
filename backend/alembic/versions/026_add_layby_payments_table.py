"""add layby_payments table

Revision ID: 026_add_layby_payments
Revises: 025_add_layby_schedules
Create Date: 2026-01-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '026_add_layby_payments'
down_revision = '025_add_layby_schedules'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create layby_payments table for tracking all payments made on laybys.
    
    This table stores payment records including deposits, installments, final payments,
    and overpayments. It also supports refund tracking with refund amount, reason,
    timestamp, and the user who processed the refund.
    
    Validates: Requirements 3.1-3.8
    - 3.1: Record payment amount, method, timestamp, and operator
    - 3.2: Update layby balance and payment history
    - 3.3: Accept payments greater than scheduled amount (overpayments)
    - 3.4: Accept payments less than scheduled amount (partial payments)
    - 3.5: Generate a payment receipt
    - 3.6: Mark layby as ready for collection when final payment is made
    - 3.7: Log payment failures and not update balance
    - 3.8: Queue offline payments for sync when online
    """
    op.create_table(
        'layby_payments',
        # Primary key
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        
        # Foreign key to laybys table
        sa.Column('layby_id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Optional foreign key to layby_schedules (payment may be linked to a specific installment)
        sa.Column('schedule_id', postgresql.UUID(as_uuid=True), nullable=True),
        
        # Payment type: deposit, installment, final, overpayment
        # (Requirements 3.3, 3.4 - support various payment types)
        sa.Column('payment_type', sa.String(20), nullable=False),
        
        # Payment details (Requirement 3.1 - record payment amount, method)
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('payment_method', sa.String(50), nullable=False),
        sa.Column('payment_reference', sa.String(100), nullable=True),
        
        # Payment status: pending, completed, failed, refunded
        # (Requirement 3.7 - log payment failures)
        sa.Column('status', sa.String(20), nullable=False, server_default='completed'),
        
        # Refund information (for handling cancellations and refunds)
        sa.Column('refund_amount', sa.Numeric(10, 2), nullable=True),
        sa.Column('refund_reason', sa.Text(), nullable=True),
        sa.Column('refunded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('refunded_by', postgresql.UUID(as_uuid=True), nullable=True),
        
        # Metadata
        sa.Column('notes', sa.Text(), nullable=True),
        
        # Operator who processed the payment (Requirement 3.1 - record operator)
        sa.Column('processed_by', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Terminal ID - nullable without FK since terminals table may not exist
        sa.Column('terminal_id', postgresql.UUID(as_uuid=True), nullable=True),
        
        # Timestamp (Requirement 3.1 - record timestamp)
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        
        # Sync fields (Requirement 3.8 - queue offline payments for sync)
        sa.Column('synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_dirty', sa.Boolean(), nullable=False, server_default='false'),
        
        # Constraints
        sa.ForeignKeyConstraint(['layby_id'], ['laybys.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['schedule_id'], ['layby_schedules.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['processed_by'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['refunded_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create index for looking up all payments for a layby (Requirement 3.2 - payment history)
    op.create_index('idx_layby_payments_layby', 'layby_payments', ['layby_id'])


def downgrade() -> None:
    """Drop layby_payments table and its indexes."""
    # Drop index
    op.drop_index('idx_layby_payments_layby', table_name='layby_payments')
    
    # Drop table
    op.drop_table('layby_payments')
