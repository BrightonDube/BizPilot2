"""Add loyalty program tables

Revision ID: 044_loyalty_program
Revises: 043_order_management
Create Date: 2025-01-02 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '044_loyalty_program'
down_revision: Union[str, None] = '043_order_management'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enums
    loyaltytier = postgresql.ENUM('bronze', 'silver', 'gold', 'platinum', name='loyaltytier', create_type=False)
    loyaltytier.create(op.get_bind(), checkfirst=True)

    pointstransactiontype = postgresql.ENUM('earn', 'redeem', 'expire', 'adjust', 'bonus', name='pointstransactiontype', create_type=False)
    pointstransactiontype.create(op.get_bind(), checkfirst=True)

    # Create loyalty_programs table
    op.create_table(
        'loyalty_programs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), server_default='Rewards Program'),
        sa.Column('points_per_rand', sa.Numeric(8, 2), server_default='1'),
        sa.Column('redemption_rate', sa.Numeric(8, 2), server_default='100'),
        sa.Column('min_redemption_points', sa.Integer(), server_default='100'),
        sa.Column('points_expiry_days', sa.Integer(), server_default='365'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('silver_threshold', sa.Integer(), server_default='1000'),
        sa.Column('gold_threshold', sa.Integer(), server_default='5000'),
        sa.Column('platinum_threshold', sa.Integer(), server_default='15000'),
        sa.Column('silver_multiplier', sa.Numeric(4, 2), server_default='1.5'),
        sa.Column('gold_multiplier', sa.Numeric(4, 2), server_default='2.0'),
        sa.Column('platinum_multiplier', sa.Numeric(4, 2), server_default='3.0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_loyalty_programs_business_id', 'loyalty_programs', ['business_id'], unique=True)

    # Create customer_loyalty table
    op.create_table(
        'customer_loyalty',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('customers.id'), nullable=False),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('points_balance', sa.Integer(), server_default='0'),
        sa.Column('lifetime_points', sa.Integer(), server_default='0'),
        sa.Column('tier', loyaltytier, server_default='bronze'),
        sa.Column('tier_updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_customer_loyalty_customer_id', 'customer_loyalty', ['customer_id'], unique=True)
    op.create_index('ix_customer_loyalty_business_id', 'customer_loyalty', ['business_id'])

    # Create points_transactions table
    op.create_table(
        'points_transactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('customers.id'), nullable=False),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('transaction_type', pointstransactiontype, nullable=False),
        sa.Column('points', sa.Integer(), nullable=False),
        sa.Column('balance_after', sa.Integer(), nullable=False),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_points_transactions_customer_id', 'points_transactions', ['customer_id'])
    op.create_index('ix_points_transactions_business_id', 'points_transactions', ['business_id'])


def downgrade() -> None:
    op.drop_table('points_transactions')
    op.drop_table('customer_loyalty')
    op.drop_table('loyalty_programs')

    op.execute('DROP TYPE IF EXISTS pointstransactiontype')
    op.execute('DROP TYPE IF EXISTS loyaltytier')
