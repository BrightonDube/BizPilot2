"""add layby_notifications table

Revision ID: 028_add_layby_notifications
Revises: 027_add_layby_audit
Create Date: 2026-01-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '028_add_layby_notifications'
down_revision = '027_add_layby_audit'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create layby_notifications table for tracking customer notifications.
    
    This table stores all notifications sent to customers regarding their laybys,
    including payment reminders, overdue notices, collection ready notifications,
    cancellation confirmations, and schedule updates. It supports both SMS and
    email channels and tracks delivery status.
    
    Validates: Requirements 7.1-7.7
    - 7.1: Send payment reminder notifications before due dates
    - 7.2: Send overdue payment notifications when payments are missed
    - 7.3: Send collection ready notifications when layby is fully paid
    - 7.4: Support SMS and email notification channels
    - 7.5: Include layby reference, amount due, and due date in notifications
    - 7.6: Allow customers to opt out of reminder notifications
    - 7.7: Log all sent notifications in the layby audit trail
    """
    op.create_table(
        'layby_notifications',
        # Primary key
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        
        # Foreign key to laybys table
        sa.Column('layby_id', postgresql.UUID(as_uuid=True), nullable=False),
        
        # Notification type describing what kind of notification was sent
        # Types: payment_reminder, overdue_notice, collection_ready,
        # cancellation_confirmation, schedule_update
        # (Requirements 7.1-7.3 - different notification types)
        sa.Column('notification_type', sa.String(50), nullable=False),
        
        # Channel used to send the notification (Requirement 7.4 - SMS and email support)
        # Values: sms, email
        sa.Column('channel', sa.String(20), nullable=False),
        
        # Recipient address (phone number for SMS, email address for email)
        sa.Column('recipient', sa.String(255), nullable=False),
        
        # Subject line (primarily for email notifications)
        sa.Column('subject', sa.String(255), nullable=True),
        
        # Message content (Requirement 7.5 - includes layby reference, amount, due date)
        sa.Column('message', sa.Text(), nullable=False),
        
        # Delivery status tracking (Requirement 7.7 - log all sent notifications)
        # Values: pending, sent, failed
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        
        # Timestamp when notification was actually sent
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        
        # Error message if notification failed to send
        sa.Column('error_message', sa.Text(), nullable=True),
        
        # Creation timestamp
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        
        # Constraints
        sa.ForeignKeyConstraint(['layby_id'], ['laybys.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create index for looking up all notifications for a layby
    op.create_index('idx_layby_notifications_layby', 'layby_notifications', ['layby_id'])
    
    # Create index for filtering by notification type
    op.create_index('idx_layby_notifications_type', 'layby_notifications', ['notification_type'])
    
    # Create index for filtering by status (useful for retry logic on failed notifications)
    op.create_index('idx_layby_notifications_status', 'layby_notifications', ['status'])
    
    # Create index for filtering by creation date (useful for reporting)
    op.create_index('idx_layby_notifications_created', 'layby_notifications', ['created_at'])


def downgrade() -> None:
    """Drop layby_notifications table and its indexes."""
    # Drop indexes
    op.drop_index('idx_layby_notifications_created', table_name='layby_notifications')
    op.drop_index('idx_layby_notifications_status', table_name='layby_notifications')
    op.drop_index('idx_layby_notifications_type', table_name='layby_notifications')
    op.drop_index('idx_layby_notifications_layby', table_name='layby_notifications')
    
    # Drop table
    op.drop_table('layby_notifications')
