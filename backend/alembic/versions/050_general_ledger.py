"""Add general ledger tables

Revision ID: 050_general_ledger
Revises: 049_crm_core
Create Date: 2025-01-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '050_general_ledger'
down_revision: Union[str, None] = '049_crm_core'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enums
    glaccounttype = postgresql.ENUM(
        'asset', 'liability', 'equity', 'revenue', 'expense',
        name='glaccounttype', create_type=False,
    )
    glaccounttype.create(op.get_bind(), checkfirst=True)

    journalentrystatus = postgresql.ENUM(
        'draft', 'posted', 'voided',
        name='journalentrystatus', create_type=False,
    )
    journalentrystatus.create(op.get_bind(), checkfirst=True)

    # chart_of_accounts
    op.create_table(
        'chart_of_accounts',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('business_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('account_code', sa.String(20), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('account_type', glaccounttype, nullable=False),
        sa.Column('parent_id', sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey('chart_of_accounts.id'), nullable=True),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('is_active', sa.Boolean, server_default=sa.text('true')),
        sa.Column('normal_balance', sa.String(10), server_default=sa.text("'debit'")),
    )

    # journal_entries
    op.create_table(
        'journal_entries',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('business_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('entry_number', sa.String(50), nullable=False, unique=True),
        sa.Column('entry_date', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('description', sa.Text, nullable=False),
        sa.Column('reference', sa.String(100), nullable=True),
        sa.Column('status', journalentrystatus, server_default=sa.text("'draft'")),
        sa.Column('created_by_id', sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('posted_by_id', sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('posted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_auto', sa.Boolean, server_default=sa.text('false')),
    )

    # journal_lines
    op.create_table(
        'journal_lines',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('entry_id', sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey('journal_entries.id'), nullable=False, index=True),
        sa.Column('account_id', sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey('chart_of_accounts.id'), nullable=False, index=True),
        sa.Column('debit', sa.Numeric(12, 2), server_default=sa.text('0')),
        sa.Column('credit', sa.Numeric(12, 2), server_default=sa.text('0')),
        sa.Column('description', sa.Text, nullable=True),
    )

    # fiscal_periods
    op.create_table(
        'fiscal_periods',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('business_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('start_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_closed', sa.Boolean, server_default=sa.text('false')),
        sa.Column('closed_by_id', sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('fiscal_periods')
    op.drop_table('journal_lines')
    op.drop_table('journal_entries')
    op.drop_table('chart_of_accounts')

    op.execute("DROP TYPE IF EXISTS journalentrystatus")
    op.execute("DROP TYPE IF EXISTS glaccounttype")
