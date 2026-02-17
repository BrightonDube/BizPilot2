"""Revamp notifications: new enums, channels, preferences

Revision ID: 059_notifications
Revises: 058_tax_configuration
Create Date: 2025-01-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '059_notifications'
down_revision: Union[str, None] = '058_tax_configuration'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create new enum types
    notificationtype_enum = sa.Enum(
        'info', 'warning', 'error', 'success', 'order',
        'inventory', 'system', 'payment',
        name='notificationtype',
    )
    notificationchannel_enum = sa.Enum(
        'in_app', 'email', 'push',
        name='notificationchannel',
    )
    notificationtype_enum.create(op.get_bind(), checkfirst=True)
    notificationchannel_enum.create(op.get_bind(), checkfirst=True)

    # Drop old indexes that will be recreated or are no longer needed
    op.drop_index('ix_notifications_notification_type', table_name='notifications', if_exists=True)
    op.drop_index('ix_notifications_created_at', table_name='notifications', if_exists=True)

    # Remove old columns
    op.drop_column('notifications', 'priority')
    op.drop_column('notifications', 'is_archived')
    op.drop_column('notifications', 'action_label')
    op.drop_column('notifications', 'reference_type')
    op.drop_column('notifications', 'reference_id')

    # Alter notification_type from String(50) → Enum
    op.alter_column(
        'notifications', 'notification_type',
        type_=notificationtype_enum,
        postgresql_using="notification_type::notificationtype",
        nullable=True,
    )

    # Alter title length
    op.alter_column('notifications', 'title', type_=sa.String(255), existing_nullable=False)

    # Make user_id NOT NULL (was nullable before)
    op.alter_column('notifications', 'user_id', nullable=False)

    # Drop the old businesses FK if present, keep only users FK
    # (business_id no longer references businesses table in the new model)
    try:
        op.drop_constraint('notifications_business_id_fkey', 'notifications', type_='foreignkey')
    except Exception:
        pass

    # Add new columns
    op.add_column('notifications', sa.Column(
        'channel',
        notificationchannel_enum,
        server_default='in_app',
        nullable=True,
    ))
    op.add_column('notifications', sa.Column('resource_type', sa.String(100), nullable=True))
    op.add_column('notifications', sa.Column('resource_id', sa.String(100), nullable=True))

    # Create notification_preferences table
    op.create_table(
        'notification_preferences',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('order_notifications', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('inventory_alerts', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('payment_notifications', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('system_notifications', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('email_enabled', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('push_enabled', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
    )
    op.create_index('ix_notification_preferences_user_id', 'notification_preferences', ['user_id'])


def downgrade() -> None:
    # Drop notification_preferences
    op.drop_index('ix_notification_preferences_user_id', table_name='notification_preferences')
    op.drop_table('notification_preferences')

    # Remove new columns
    op.drop_column('notifications', 'resource_id')
    op.drop_column('notifications', 'resource_type')
    op.drop_column('notifications', 'channel')

    # Revert user_id to nullable
    op.alter_column('notifications', 'user_id', nullable=True)

    # Revert title length
    op.alter_column('notifications', 'title', type_=sa.String(200), existing_nullable=False)

    # Revert notification_type to String
    op.alter_column(
        'notifications', 'notification_type',
        type_=sa.String(50),
        nullable=False,
    )

    # Re-add old columns
    op.add_column('notifications', sa.Column('reference_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('notifications', sa.Column('reference_type', sa.String(50), nullable=True))
    op.add_column('notifications', sa.Column('action_label', sa.String(100), nullable=True))
    op.add_column('notifications', sa.Column('is_archived', sa.Boolean(), server_default='false', nullable=True))
    op.add_column('notifications', sa.Column('priority', sa.String(20), server_default='medium', nullable=False))

    # Re-add business FK
    op.create_foreign_key('notifications_business_id_fkey', 'notifications', 'businesses', ['business_id'], ['id'], ondelete='CASCADE')

    # Re-create old indexes
    op.create_index('ix_notifications_notification_type', 'notifications', ['notification_type'])
    op.create_index('ix_notifications_created_at', 'notifications', ['created_at'])

    # Drop enums
    sa.Enum(name='notificationchannel').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='notificationtype').drop(op.get_bind(), checkfirst=True)
