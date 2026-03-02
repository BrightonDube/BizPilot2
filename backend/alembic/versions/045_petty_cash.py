"""Add petty cash tables

Revision ID: 045_petty_cash
Revises: 044_loyalty_program
Create Date: 2025-01-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '045_petty_cash'
down_revision: Union[str, None] = '044_loyalty_program'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enums
    fundstatus = postgresql.ENUM('active', 'closed', 'suspended', name='fundstatus', create_type=False)
    fundstatus.create(op.get_bind(), checkfirst=True)

    expensestatus = postgresql.ENUM('pending', 'approved', 'rejected', 'disbursed', 'cancelled', name='expensestatus', create_type=False)
    expensestatus.create(op.get_bind(), checkfirst=True)

    # petty_cash_funds
    op.create_table(
        'petty_cash_funds',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('initial_amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('current_balance', sa.Numeric(12, 2), nullable=False),
        sa.Column('custodian_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('status', fundstatus, default='active'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['custodian_id'], ['users.id']),
    )

    # expense_categories
    op.create_table(
        'expense_categories',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('gl_account_code', sa.String(50), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )

    # petty_cash_expenses
    op.create_table(
        'petty_cash_expenses',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('fund_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('category_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('requested_by_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('approved_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('vendor', sa.String(255), nullable=True),
        sa.Column('receipt_number', sa.String(100), nullable=True),
        sa.Column('expense_date', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('status', expensestatus, default='pending'),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['fund_id'], ['petty_cash_funds.id']),
        sa.ForeignKeyConstraint(['category_id'], ['expense_categories.id']),
        sa.ForeignKeyConstraint(['requested_by_id'], ['users.id']),
        sa.ForeignKeyConstraint(['approved_by_id'], ['users.id']),
    )

    # fund_replenishments
    op.create_table(
        'fund_replenishments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('fund_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('replenished_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['fund_id'], ['petty_cash_funds.id']),
        sa.ForeignKeyConstraint(['replenished_by_id'], ['users.id']),
    )


def downgrade() -> None:
    op.drop_table('fund_replenishments')
    op.drop_table('petty_cash_expenses')
    op.drop_table('expense_categories')
    op.drop_table('petty_cash_funds')

    expensestatus = postgresql.ENUM('pending', 'approved', 'rejected', 'disbursed', 'cancelled', name='expensestatus', create_type=False)
    expensestatus.drop(op.get_bind(), checkfirst=True)
    fundstatus = postgresql.ENUM('active', 'closed', 'suspended', name='fundstatus', create_type=False)
    fundstatus.drop(op.get_bind(), checkfirst=True)
