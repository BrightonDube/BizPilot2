"""add layby_schedules table

Revision ID: 025_add_layby_schedules
Revises: 024_add_layby_items
Create Date: 2026-01-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '025_add_layby_schedules'
down_revision = '024_add_layby_items'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create layby_schedules table for tracking payment installments.
    
    This table stores the payment schedule for each layby, with individual
    installments that track due dates, amounts due, amounts paid, and status.
    Each layby can have multiple scheduled installments based on the payment
    frequency (weekly, bi-weekly, monthly).
    
    Validates: Requirements 2.1-2.7
    - 2.1: Support weekly, bi-weekly, and monthly payment frequencies
    - 2.2: Calculate equal installment amounts based on remaining balance and duration
    - 2.3: Set a maximum layby duration (configurable, default 90 days)
    - 2.4: Generate due dates for each scheduled payment
    - 2.5: Allow custom payment amounts that differ from calculated installments
    - 2.6: Recalculate remaining installments when schedule is modified
    - 2.7: Display the full payment schedule to the customer at creation time
    """
    op.create_table(
        'layby_schedules',
        # Primary key
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        
        # Foreign key to laybys table
        sa.Column('layby_id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Installment tracking (Requirement 2.4 - generate due dates for each scheduled payment)
        sa.Column('installment_number', sa.Integer(), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=False),
        
        # Amount tracking (Requirement 2.2 - calculate equal installment amounts)
        sa.Column('amount_due', sa.Numeric(10, 2), nullable=False),
        sa.Column('amount_paid', sa.Numeric(10, 2), nullable=False, server_default='0'),
        
        # Status tracking: pending, partial, paid, overdue
        # (Requirement 2.5 - allow custom payment amounts / partial payments)
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        
        # Payment completion timestamp
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        
        # Constraints
        sa.ForeignKeyConstraint(['layby_id'], ['laybys.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        # Unique constraint: each layby can only have one installment with a given number
        sa.UniqueConstraint('layby_id', 'installment_number', name='uq_layby_schedules_layby_installment')
    )
    
    # Create indexes for common queries
    # Index for looking up all schedules for a layby
    op.create_index('idx_layby_schedules_layby', 'layby_schedules', ['layby_id'])
    # Index for finding schedules by due date (for reminder queries)
    op.create_index('idx_layby_schedules_due', 'layby_schedules', ['due_date'])


def downgrade() -> None:
    """Drop layby_schedules table and its indexes."""
    # Drop indexes
    op.drop_index('idx_layby_schedules_due', table_name='layby_schedules')
    op.drop_index('idx_layby_schedules_layby', table_name='layby_schedules')
    
    # Drop table
    op.drop_table('layby_schedules')
