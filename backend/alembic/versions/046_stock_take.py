"""Add stock take tables

Revision ID: 046_stock_take
Revises: 045_petty_cash
Create Date: 2025-01-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '046_stock_take'
down_revision: Union[str, None] = '045_petty_cash'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum
    stocktakestatus = postgresql.ENUM(
        'draft', 'in_progress', 'completed', 'cancelled',
        name='stocktakestatus', create_type=False,
    )
    stocktakestatus.create(op.get_bind(), checkfirst=True)

    # stock_take_sessions
    op.create_table(
        'stock_take_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('reference', sa.String(50), nullable=False, unique=True),
        sa.Column('status', stocktakestatus, nullable=False, server_default='draft'),
        sa.Column('started_by_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('completed_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id']),
        sa.ForeignKeyConstraint(['started_by_id'], ['users.id']),
        sa.ForeignKeyConstraint(['completed_by_id'], ['users.id']),
    )

    # stock_counts
    op.create_table(
        'stock_counts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('system_quantity', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('counted_quantity', sa.Integer(), nullable=True),
        sa.Column('variance', sa.Integer(), nullable=True),
        sa.Column('unit_cost', sa.Numeric(12, 2), nullable=True),
        sa.Column('variance_value', sa.Numeric(12, 2), nullable=True),
        sa.Column('counted_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['session_id'], ['stock_take_sessions.id']),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id']),
        sa.ForeignKeyConstraint(['counted_by_id'], ['users.id']),
    )

    # inventory_adjustments
    op.create_table(
        'inventory_adjustments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('adjustment_type', sa.String(50), nullable=False),
        sa.Column('quantity_change', sa.Integer(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('approved_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('adjustment_date', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id']),
        sa.ForeignKeyConstraint(['session_id'], ['stock_take_sessions.id']),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.ForeignKeyConstraint(['approved_by_id'], ['users.id']),
    )


def downgrade() -> None:
    op.drop_table('inventory_adjustments')
    op.drop_table('stock_counts')
    op.drop_table('stock_take_sessions')

    stocktakestatus = postgresql.ENUM(
        'draft', 'in_progress', 'completed', 'cancelled',
        name='stocktakestatus', create_type=False,
    )
    stocktakestatus.drop(op.get_bind(), checkfirst=True)
