"""Add CRM core tables

Revision ID: 049_crm_core
Revises: 048_delivery_management
Create Date: 2025-01-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '049_crm_core'
down_revision: Union[str, None] = '048_delivery_management'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum
    interactiontype = postgresql.ENUM(
        'note', 'call', 'email', 'meeting', 'follow_up',
        name='interactiontype', create_type=False,
    )
    interactiontype.create(op.get_bind(), checkfirst=True)

    # customer_segments
    op.create_table(
        'customer_segments',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('criteria', sa.Text, nullable=True),
        sa.Column('color', sa.String(20), server_default='#3B82F6'),
        sa.Column('is_auto', sa.Boolean, server_default=sa.text('false'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )

    # customer_segment_members
    op.create_table(
        'customer_segment_members',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('segment_id', sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey('customer_segments.id'), nullable=False, index=True),
        sa.Column('customer_id', sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey('customers.id'), nullable=False, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )

    # customer_interactions
    op.create_table(
        'customer_interactions',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('customer_id', sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey('customers.id'), nullable=False, index=True),
        sa.Column('business_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('user_id', sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('interaction_type', sa.Enum('note', 'call', 'email', 'meeting', 'follow_up', name='interactiontype', create_constraint=False, native_enum=False), nullable=False),
        sa.Column('subject', sa.String(255), nullable=False),
        sa.Column('content', sa.Text, nullable=True),
        sa.Column('follow_up_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_completed', sa.Boolean, server_default=sa.text('false'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )

    # customer_metrics
    op.create_table(
        'customer_metrics',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('customer_id', sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey('customers.id'), nullable=False, unique=True, index=True),
        sa.Column('business_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('total_orders', sa.Integer, server_default=sa.text('0'), nullable=False),
        sa.Column('total_spent', sa.Numeric(12, 2), server_default=sa.text('0'), nullable=False),
        sa.Column('average_order_value', sa.Numeric(12, 2), server_default=sa.text('0'), nullable=False),
        sa.Column('last_order_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('first_order_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('days_since_last_order', sa.Integer, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('customer_metrics')
    op.drop_table('customer_interactions')
    op.drop_table('customer_segment_members')
    op.drop_table('customer_segments')
    postgresql.ENUM(name='interactiontype').drop(op.get_bind(), checkfirst=True)
