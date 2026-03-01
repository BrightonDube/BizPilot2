"""Add gift cards and gift card transactions

Revision ID: 060_gift_cards
Revises: 059_notifications
Create Date: 2025-01-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '060_gift_cards'
down_revision: Union[str, None] = '059_notifications'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    giftcardstatus_enum = sa.Enum(
        'active', 'redeemed', 'expired', 'cancelled',
        name='giftcardstatus',
    )
    giftcardstatus_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'gift_cards',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('initial_value', sa.Numeric(12, 2), nullable=False),
        sa.Column('current_balance', sa.Numeric(12, 2), nullable=False),
        sa.Column('status', giftcardstatus_enum, nullable=False, server_default='active'),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('customer_name', sa.String(255), nullable=True),
        sa.Column('customer_email', sa.String(255), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id']),
        sa.ForeignKeyConstraint(['customer_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_gift_cards_business_id', 'gift_cards', ['business_id'])
    op.create_index('ix_gift_cards_code', 'gift_cards', ['code'], unique=True)

    op.create_table(
        'gift_card_transactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('gift_card_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('transaction_type', sa.String(20), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('balance_after', sa.Numeric(12, 2), nullable=False),
        sa.Column('reference', sa.String(100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('performed_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['gift_card_id'], ['gift_cards.id']),
        sa.ForeignKeyConstraint(['performed_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_gift_card_transactions_gift_card_id', 'gift_card_transactions', ['gift_card_id'])


def downgrade() -> None:
    op.drop_index('ix_gift_card_transactions_gift_card_id', table_name='gift_card_transactions')
    op.drop_table('gift_card_transactions')
    op.drop_index('ix_gift_cards_code', table_name='gift_cards')
    op.drop_index('ix_gift_cards_business_id', table_name='gift_cards')
    op.drop_table('gift_cards')

    sa.Enum(name='giftcardstatus').drop(op.get_bind(), checkfirst=True)
