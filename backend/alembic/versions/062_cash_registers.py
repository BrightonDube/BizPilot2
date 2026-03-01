"""Cash register tables

Revision ID: 062_cash_registers
Revises: 061_expenses
Create Date: 2025-02-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '062_cash_registers'
down_revision: Union[str, None] = '061_expenses'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # RegisterStatus enum
    registerstatus = postgresql.ENUM('closed', 'open', 'suspended', name='registerstatus', create_type=False)
    registerstatus.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'cash_registers',
        sa.Column('id', sa.UUID(), nullable=False, default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('business_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('location_id', sa.UUID(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.ForeignKeyConstraint(['location_id'], ['locations.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_cash_registers_business_id', 'cash_registers', ['business_id'])

    op.create_table(
        'register_sessions',
        sa.Column('id', sa.UUID(), nullable=False, default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('register_id', sa.UUID(), nullable=False),
        sa.Column('business_id', sa.UUID(), nullable=False),
        sa.Column('opened_by', sa.UUID(), nullable=False),
        sa.Column('closed_by', sa.UUID(), nullable=True),
        sa.Column('status', sa.Enum('closed', 'open', 'suspended', name='registerstatus', create_type=False), server_default='open'),
        sa.Column('opening_float', sa.Numeric(12, 2), server_default='0'),
        sa.Column('closing_float', sa.Numeric(12, 2), nullable=True),
        sa.Column('expected_cash', sa.Numeric(12, 2), nullable=True),
        sa.Column('actual_cash', sa.Numeric(12, 2), nullable=True),
        sa.Column('cash_difference', sa.Numeric(12, 2), nullable=True),
        sa.Column('total_sales', sa.Numeric(12, 2), server_default='0'),
        sa.Column('total_refunds', sa.Numeric(12, 2), server_default='0'),
        sa.Column('total_cash_payments', sa.Numeric(12, 2), server_default='0'),
        sa.Column('total_card_payments', sa.Numeric(12, 2), server_default='0'),
        sa.Column('transaction_count', sa.Integer(), server_default='0'),
        sa.Column('opened_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['register_id'], ['cash_registers.id']),
        sa.ForeignKeyConstraint(['opened_by'], ['users.id']),
        sa.ForeignKeyConstraint(['closed_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_register_sessions_register_id', 'register_sessions', ['register_id'])
    op.create_index('ix_register_sessions_business_id', 'register_sessions', ['business_id'])

    op.create_table(
        'cash_movements',
        sa.Column('id', sa.UUID(), nullable=False, default=sa.text('gen_random_uuid()')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('session_id', sa.UUID(), nullable=False),
        sa.Column('business_id', sa.UUID(), nullable=False),
        sa.Column('movement_type', sa.String(20), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('reason', sa.String(255), nullable=False),
        sa.Column('performed_by', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['register_sessions.id']),
        sa.ForeignKeyConstraint(['performed_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_cash_movements_session_id', 'cash_movements', ['session_id'])
    op.create_index('ix_cash_movements_business_id', 'cash_movements', ['business_id'])


def downgrade() -> None:
    op.drop_index('ix_cash_movements_business_id', table_name='cash_movements')
    op.drop_index('ix_cash_movements_session_id', table_name='cash_movements')
    op.drop_table('cash_movements')
    op.drop_index('ix_register_sessions_business_id', table_name='register_sessions')
    op.drop_index('ix_register_sessions_register_id', table_name='register_sessions')
    op.drop_table('register_sessions')
    op.drop_index('ix_cash_registers_business_id', table_name='cash_registers')
    op.drop_table('cash_registers')

    registerstatus = postgresql.ENUM('closed', 'open', 'suspended', name='registerstatus', create_type=False)
    registerstatus.drop(op.get_bind(), checkfirst=True)
