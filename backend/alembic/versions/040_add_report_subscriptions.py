"""add report_subscriptions and report_delivery_logs tables

Revision ID: 040_report_subs
Revises: 039_add_feat_defs
Create Date: 2026-01-29

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '040_report_subs'
down_revision = '039_add_feat_defs'
branch_labels = None
depends_on = None


def upgrade() -> None:
    uuid_type = sa.String(length=36).with_variant(postgresql.UUID(as_uuid=True), 'postgresql')
    
    # Create report_subscriptions table
    op.create_table(
        'report_subscriptions',
        sa.Column('id', uuid_type, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('user_id', uuid_type, nullable=False),
        sa.Column('report_type', sa.String(50), nullable=False),
        sa.Column('frequency', sa.String(20), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('last_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('user_id', 'report_type', 'frequency', name='uq_report_subscriptions_user_type_freq'),
    )
    
    op.create_index(
        'idx_report_subscriptions_user_id',
        'report_subscriptions',
        ['user_id'],
    )
    
    op.create_index(
        'idx_report_subscriptions_frequency_active',
        'report_subscriptions',
        ['frequency', 'is_active'],
    )
    
    # Create report_delivery_logs table
    op.create_table(
        'report_delivery_logs',
        sa.Column('id', uuid_type, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('user_id', uuid_type, nullable=False),
        sa.Column('report_type', sa.String(50), nullable=False),
        sa.Column('frequency', sa.String(20), nullable=False),
        sa.Column('reporting_period_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('reporting_period_end', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('error_message', sa.String(), nullable=True),
        sa.Column('retry_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('delivered_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )
    
    op.create_index(
        'idx_report_delivery_logs_user_id',
        'report_delivery_logs',
        ['user_id'],
    )
    
    op.create_index(
        'idx_report_delivery_logs_status',
        'report_delivery_logs',
        ['status'],
    )
    
    op.create_index(
        'idx_report_delivery_logs_created_at',
        'report_delivery_logs',
        ['created_at'],
    )


def downgrade() -> None:
    op.drop_index('idx_report_delivery_logs_created_at', table_name='report_delivery_logs')
    op.drop_index('idx_report_delivery_logs_status', table_name='report_delivery_logs')
    op.drop_index('idx_report_delivery_logs_user_id', table_name='report_delivery_logs')
    op.drop_table('report_delivery_logs')
    
    op.drop_index('idx_report_subscriptions_frequency_active', table_name='report_subscriptions')
    op.drop_index('idx_report_subscriptions_user_id', table_name='report_subscriptions')
    op.drop_table('report_subscriptions')
