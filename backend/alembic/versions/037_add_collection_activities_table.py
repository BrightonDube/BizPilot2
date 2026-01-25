"""add collection_activities table

Revision ID: 037_add_collection_activities
Revises: 036_add_account_payments
Create Date: 2026-01-21

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '037_add_collection_activities'
down_revision = '036_add_account_payments'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create collection_activities table.
    
    This table tracks collection activities for overdue customer accounts:
    - Logs all collection attempts (calls, emails, visits)
    - Records payment promises and their outcomes
    - Provides audit trail for collections process
    
    Validates: Requirement 7 - Collections Management
    - Requirement 7.1: Flag accounts for collection based on rules
    - Requirement 7.2: Log collection activities (calls, emails)
    - Requirement 7.3: Support payment promises with due dates
    - Requirement 7.4: Send automated payment reminders
    - Requirement 7.5: Track collection success rate
    - Requirement 7.6: Support write-off workflow for bad debt
    """
    
    # Create collection_activities table
    op.create_table(
        'collection_activities',
        # Primary key
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        
        # Foreign key to customer account (Requirement 7.1, 7.2)
        # Links activity to the account being collected
        sa.Column('account_id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Activity type (Requirement 7.2)
        # Values: 'phone_call', 'email', 'letter', 'visit', 'promise', 'note', 'reminder'
        # Tracks the type of collection activity performed
        sa.Column('activity_type', sa.String(50), nullable=False),
        
        # Activity notes (Requirement 7.2)
        # Detailed notes about the collection activity
        # e.g., "Customer answered, promised payment by Friday"
        sa.Column('notes', sa.Text(), nullable=True),
        
        # Payment promise date (Requirement 7.3)
        # Date when customer promised to make payment
        # Used for follow-up scheduling and promise tracking
        sa.Column('promise_date', sa.Date(), nullable=True),
        
        # Payment promise amount (Requirement 7.3)
        # Amount customer promised to pay
        # Can be partial payment or full balance
        sa.Column('promise_amount', sa.Numeric(12, 2), nullable=True),
        
        # Activity outcome (Requirement 7.5)
        # Values: 'successful', 'no_answer', 'refused', 'promise_made', 'promise_kept', 'promise_broken'
        # Used for tracking collection success rate
        sa.Column('outcome', sa.String(50), nullable=True),
        
        # Audit trail (Requirement 7.2)
        # Track who performed the collection activity
        sa.Column('performed_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        
        # Constraints
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['account_id'], ['customer_accounts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['performed_by'], ['users.id'], ondelete='SET NULL'),
        
        # Check constraint: if promise_date is set, promise_amount should be set
        # This ensures promise records are complete
        sa.CheckConstraint(
            '(promise_date IS NULL AND promise_amount IS NULL) OR (promise_date IS NOT NULL AND promise_amount IS NOT NULL)',
            name='ck_collection_activities_promise_complete'
        ),
        
        # Check constraint: promise_amount must be positive if set
        sa.CheckConstraint(
            'promise_amount IS NULL OR promise_amount > 0',
            name='ck_collection_activities_promise_amount_positive'
        )
    )
    
    # Create indexes for collection_activities
    
    # Index for looking up all activities for an account (Requirement 7.2)
    # Used for: activity history, collections dashboard, account review
    op.create_index(
        'idx_collection_activities_account_id',
        'collection_activities',
        ['account_id']
    )
    
    # Index for activity type filtering (Requirement 7.2, 7.5)
    # Used for: activity type reports, success rate analysis by activity type
    op.create_index(
        'idx_collection_activities_type',
        'collection_activities',
        ['activity_type']
    )
    
    # Index for promise date tracking (Requirement 7.3)
    # Used for: follow-up scheduling, promise due date alerts, promise tracking
    op.create_index(
        'idx_collection_activities_promise_date',
        'collection_activities',
        ['promise_date']
    )
    
    # Index for outcome analysis (Requirement 7.5)
    # Used for: success rate calculations, outcome reporting
    op.create_index(
        'idx_collection_activities_outcome',
        'collection_activities',
        ['outcome']
    )
    
    # Index for chronological activity queries (Requirement 7.2)
    # Used for: activity timeline, recent activities, date range reports
    op.create_index(
        'idx_collection_activities_created_at',
        'collection_activities',
        ['created_at']
    )
    
    # Composite index for account + date queries (Requirement 7.2)
    # Used for: account activity history by date range
    op.create_index(
        'idx_collection_activities_account_date',
        'collection_activities',
        ['account_id', 'created_at']
    )
    
    # Index for user activity tracking (Requirement 7.2)
    # Used for: collections officer performance, workload distribution
    op.create_index(
        'idx_collection_activities_performed_by',
        'collection_activities',
        ['performed_by']
    )
    
    # Composite index for promise tracking (Requirement 7.3)
    # Used for: finding accounts with promises due, promise follow-up
    op.create_index(
        'idx_collection_activities_promise_tracking',
        'collection_activities',
        ['promise_date', 'outcome']
    )


def downgrade() -> None:
    """Drop collection_activities table and its indexes."""
    
    # Drop indexes
    op.drop_index('idx_collection_activities_promise_tracking', table_name='collection_activities')
    op.drop_index('idx_collection_activities_performed_by', table_name='collection_activities')
    op.drop_index('idx_collection_activities_account_date', table_name='collection_activities')
    op.drop_index('idx_collection_activities_created_at', table_name='collection_activities')
    op.drop_index('idx_collection_activities_outcome', table_name='collection_activities')
    op.drop_index('idx_collection_activities_promise_date', table_name='collection_activities')
    op.drop_index('idx_collection_activities_type', table_name='collection_activities')
    op.drop_index('idx_collection_activities_account_id', table_name='collection_activities')
    
    # Drop table
    op.drop_table('collection_activities')
