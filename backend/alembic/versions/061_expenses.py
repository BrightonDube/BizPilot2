"""Add expense tracking tables

Revision ID: 061_expenses
Revises: 060_gift_cards
Create Date: 2025-01-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '061_expenses'
down_revision: Union[str, None] = '060_gift_cards'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    expensetrackingstatus = sa.Enum(
        'pending', 'approved', 'rejected', 'paid',
        name='expensetrackingstatus',
    )
    expensetrackingstatus.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'expense_tracking_categories',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('budget_limit', sa.Numeric(12, 2), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_expense_tracking_categories_business_id', 'expense_tracking_categories', ['business_id'])

    op.create_table(
        'expenses',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('category_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('submitted_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('approved_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('vendor', sa.String(255), nullable=True),
        sa.Column('receipt_url', sa.String(500), nullable=True),
        sa.Column('expense_date', sa.Date(), nullable=False),
        sa.Column('status', expensetrackingstatus, server_default='pending', nullable=True),
        sa.Column('payment_method', sa.String(50), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id']),
        sa.ForeignKeyConstraint(['category_id'], ['expense_tracking_categories.id']),
        sa.ForeignKeyConstraint(['submitted_by'], ['users.id']),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_expenses_business_id', 'expenses', ['business_id'])
    op.create_index('ix_expenses_category_id', 'expenses', ['category_id'])
    op.create_index('ix_expenses_submitted_by', 'expenses', ['submitted_by'])


def downgrade() -> None:
    op.drop_index('ix_expenses_submitted_by', table_name='expenses')
    op.drop_index('ix_expenses_category_id', table_name='expenses')
    op.drop_index('ix_expenses_business_id', table_name='expenses')
    op.drop_table('expenses')
    op.drop_index('ix_expense_tracking_categories_business_id', table_name='expense_tracking_categories')
    op.drop_table('expense_tracking_categories')
    sa.Enum(name='expensetrackingstatus').drop(op.get_bind(), checkfirst=True)
