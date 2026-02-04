"""restore business_time_settings

Revision ID: 6ead9fc807d9
Revises: 040_report_subs
Create Date: 2026-02-04 01:57:43.288784

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '6ead9fc807d9'
down_revision: Union[str, None] = '040_report_subs'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('business_time_settings',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), autoincrement=False, nullable=False),
        sa.Column('business_id', sa.UUID(), autoincrement=False, nullable=False),
        sa.Column('day_end_time', postgresql.TIME(), server_default=sa.text("'23:59:00'::time without time zone"), autoincrement=False, nullable=False),
        sa.Column('auto_clock_out_penalty_hours', sa.NUMERIC(precision=4, scale=2), server_default=sa.text('5.00'), autoincrement=False, nullable=True),
        sa.Column('standard_work_hours', sa.NUMERIC(precision=4, scale=2), server_default=sa.text('8.00'), autoincrement=False, nullable=True),
        sa.Column('overtime_threshold', sa.NUMERIC(precision=4, scale=2), server_default=sa.text('8.00'), autoincrement=False, nullable=True),
        sa.Column('payroll_period_type', sa.VARCHAR(length=20), server_default=sa.text("'monthly'::character varying"), autoincrement=False, nullable=True),
        sa.Column('payroll_period_start_day', sa.INTEGER(), server_default=sa.text('1'), autoincrement=False, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), autoincrement=False, nullable=True),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], name=op.f('business_time_settings_business_id_fkey'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name=op.f('business_time_settings_pkey')),
        sa.UniqueConstraint('business_id', name=op.f('business_time_settings_business_id_key'))
    )


def downgrade() -> None:
    op.drop_table('business_time_settings')
