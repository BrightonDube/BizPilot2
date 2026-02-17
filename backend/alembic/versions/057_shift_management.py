"""Add shift management tables

Revision ID: 057_shift_management
Revises: 056_addons_modifiers
Create Date: 2025-01-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '057_shift_management'
down_revision: Union[str, None] = '056_addons_modifiers'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enums
    shiftstatus = postgresql.ENUM(
        'scheduled', 'in_progress', 'completed', 'cancelled', 'no_show',
        name='shiftstatus', create_type=False,
    )
    shiftstatus.create(op.get_bind(), checkfirst=True)

    leavetype = postgresql.ENUM(
        'annual', 'sick', 'family', 'unpaid', 'other',
        name='leavetype', create_type=False,
    )
    leavetype.create(op.get_bind(), checkfirst=True)

    leavestatus = postgresql.ENUM(
        'pending', 'approved', 'rejected',
        name='leavestatus', create_type=False,
    )
    leavestatus.create(op.get_bind(), checkfirst=True)

    # Create shifts table
    op.create_table(
        'shifts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column(
            'user_id', postgresql.UUID(as_uuid=True),
            sa.ForeignKey('users.id'), nullable=False, index=True,
        ),
        sa.Column(
            'location_id', postgresql.UUID(as_uuid=True),
            sa.ForeignKey('locations.id'), nullable=True,
        ),
        sa.Column('shift_date', sa.Date(), nullable=False, index=True),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('break_minutes', sa.Integer(), server_default='0'),
        sa.Column('role', sa.String(100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('status', shiftstatus, server_default='scheduled'),
        sa.Column('actual_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('actual_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            'created_at', sa.DateTime(timezone=True),
            nullable=False, server_default=sa.func.now(),
        ),
        sa.Column(
            'updated_at', sa.DateTime(timezone=True),
            nullable=False, server_default=sa.func.now(),
        ),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )

    # Create leave_requests table
    op.create_table(
        'leave_requests',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column(
            'user_id', postgresql.UUID(as_uuid=True),
            sa.ForeignKey('users.id'), nullable=False, index=True,
        ),
        sa.Column('leave_type', leavetype, nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('status', leavestatus, server_default='pending'),
        sa.Column(
            'approved_by', postgresql.UUID(as_uuid=True),
            sa.ForeignKey('users.id'), nullable=True,
        ),
        sa.Column(
            'created_at', sa.DateTime(timezone=True),
            nullable=False, server_default=sa.func.now(),
        ),
        sa.Column(
            'updated_at', sa.DateTime(timezone=True),
            nullable=False, server_default=sa.func.now(),
        ),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('leave_requests')
    op.drop_table('shifts')

    postgresql.ENUM(name='leavestatus').drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name='leavetype').drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name='shiftstatus').drop(op.get_bind(), checkfirst=True)
