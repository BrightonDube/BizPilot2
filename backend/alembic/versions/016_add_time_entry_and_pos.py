"""Add time entry and POS connection tables

Revision ID: 016_add_time_entry_and_pos
Revises: 015_add_product_suppliers
Create Date: 2026-01-14

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "016_add_time_entry_and_pos"
down_revision: Union[str, None] = "015_add_product_suppliers"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create time entry type enum
    timeentrytype_enum = postgresql.ENUM(
        'clock_in', 'clock_out', 'break_start', 'break_end', 'manual_adjustment',
        name='timeentrytype',
        create_type=False,
    )
    timeentrytype_enum.create(op.get_bind(), checkfirst=True)
    
    # Create time entry status enum
    timeentrystatus_enum = postgresql.ENUM(
        'active', 'completed', 'pending_approval', 'approved', 'rejected',
        name='timeentrystatus',
        create_type=False,
    )
    timeentrystatus_enum.create(op.get_bind(), checkfirst=True)
    
    # Create time_entries table
    op.create_table(
        'time_entries',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('entry_type', timeentrytype_enum, nullable=True, default='clock_in'),
        sa.Column('clock_in', sa.DateTime(), nullable=True),
        sa.Column('clock_out', sa.DateTime(), nullable=True),
        sa.Column('break_start', sa.DateTime(), nullable=True),
        sa.Column('break_end', sa.DateTime(), nullable=True),
        sa.Column('hours_worked', sa.Numeric(6, 2), nullable=True, default=0),
        sa.Column('break_duration', sa.Numeric(6, 2), nullable=True, default=0),
        sa.Column('status', timeentrystatus_enum, nullable=True, default='active'),
        sa.Column('device_id', sa.String(255), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('location', sa.String(255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('approved_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['approved_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_time_entries_business_id', 'time_entries', ['business_id'])
    op.create_index('ix_time_entries_user_id', 'time_entries', ['user_id'])
    op.create_index('ix_time_entries_clock_in', 'time_entries', ['clock_in'])
    
    # Create POS provider enum
    posprovider_enum = postgresql.ENUM(
        'lightspeed', 'gaap', 'pilot', 'marketman', 'square', 'shopify', 
        'vend', 'toast', 'clover', 'revel', 'custom',
        name='posprovider',
        create_type=False,
    )
    posprovider_enum.create(op.get_bind(), checkfirst=True)
    
    # Create POS connection status enum
    posconnectionstatus_enum = postgresql.ENUM(
        'pending', 'active', 'inactive', 'error', 'expired',
        name='posconnectionstatus',
        create_type=False,
    )
    posconnectionstatus_enum.create(op.get_bind(), checkfirst=True)
    
    # Create pos_connections table
    op.create_table(
        'pos_connections',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('provider', posprovider_enum, nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('api_key', sa.Text(), nullable=True),
        sa.Column('api_secret', sa.Text(), nullable=True),
        sa.Column('access_token', sa.Text(), nullable=True),
        sa.Column('refresh_token', sa.Text(), nullable=True),
        sa.Column('token_expires_at', sa.DateTime(), nullable=True),
        sa.Column('base_url', sa.String(500), nullable=True),
        sa.Column('webhook_url', sa.String(500), nullable=True),
        sa.Column('webhook_secret', sa.String(255), nullable=True),
        sa.Column('settings', postgresql.JSONB(), nullable=True, default={}),
        sa.Column('status', posconnectionstatus_enum, nullable=True, default='pending'),
        sa.Column('sync_enabled', sa.Boolean(), nullable=True, default=True),
        sa.Column('sync_products', sa.Boolean(), nullable=True, default=True),
        sa.Column('sync_inventory', sa.Boolean(), nullable=True, default=True),
        sa.Column('sync_sales', sa.Boolean(), nullable=True, default=True),
        sa.Column('sync_customers', sa.Boolean(), nullable=True, default=False),
        sa.Column('last_sync_at', sa.DateTime(), nullable=True),
        sa.Column('last_sync_status', sa.String(50), nullable=True),
        sa.Column('last_sync_error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_pos_connections_business_id', 'pos_connections', ['business_id'])
    op.create_index('ix_pos_connections_provider', 'pos_connections', ['provider'])
    
    # Create pos_sync_logs table
    op.create_table(
        'pos_sync_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('connection_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sync_type', sa.String(50), nullable=False),
        sa.Column('direction', sa.String(20), nullable=False),
        sa.Column('records_processed', sa.Integer(), nullable=True, default=0),
        sa.Column('records_created', sa.Integer(), nullable=True, default=0),
        sa.Column('records_updated', sa.Integer(), nullable=True, default=0),
        sa.Column('records_failed', sa.Integer(), nullable=True, default=0),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('details', postgresql.JSONB(), nullable=True, default={}),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['connection_id'], ['pos_connections.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_pos_sync_logs_connection_id', 'pos_sync_logs', ['connection_id'])
    
    # Add pin_code field to users table for POS login
    op.add_column('users', sa.Column('pin_code', sa.String(6), nullable=True))
    op.add_column('users', sa.Column('pin_code_hash', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('biometric_enabled', sa.Boolean(), nullable=True, default=False))
    op.add_column('users', sa.Column('biometric_public_key', sa.Text(), nullable=True))


def downgrade() -> None:
    # Drop pin_code columns from users
    op.drop_column('users', 'biometric_public_key')
    op.drop_column('users', 'biometric_enabled')
    op.drop_column('users', 'pin_code_hash')
    op.drop_column('users', 'pin_code')
    
    # Drop pos_sync_logs
    op.drop_index('ix_pos_sync_logs_connection_id', table_name='pos_sync_logs')
    op.drop_table('pos_sync_logs')
    
    # Drop pos_connections
    op.drop_index('ix_pos_connections_provider', table_name='pos_connections')
    op.drop_index('ix_pos_connections_business_id', table_name='pos_connections')
    op.drop_table('pos_connections')
    
    # Drop time_entries
    op.drop_index('ix_time_entries_clock_in', table_name='time_entries')
    op.drop_index('ix_time_entries_user_id', table_name='time_entries')
    op.drop_index('ix_time_entries_business_id', table_name='time_entries')
    op.drop_table('time_entries')
    
    # Drop enums
    op.execute("DROP TYPE IF EXISTS posconnectionstatus")
    op.execute("DROP TYPE IF EXISTS posprovider")
    op.execute("DROP TYPE IF EXISTS timeentrystatus")
    op.execute("DROP TYPE IF EXISTS timeentrytype")
