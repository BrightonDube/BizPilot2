"""Create driver_shifts table for scheduling delivery drivers.

Revision ID: 082_driver_shifts
Revises: 081_reservations
Create Date: 2025-01-01 00:00:00.000000

Why a dedicated driver_shifts table?
The drivers table tracks who is available for deliveries, but businesses
need to schedule drivers in advance, track shift adherence, and compute
labour cost vs delivery revenue.  Without scheduled shifts, the system
can only react to driver availability rather than plan capacity.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "082_driver_shifts"
down_revision = "081_reservations"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        "driver_shifts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "driver_id",
            UUID(as_uuid=True),
            sa.ForeignKey("drivers.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("shift_date", sa.Date, nullable=False),
        sa.Column("start_time", sa.Time, nullable=False),
        sa.Column("end_time", sa.Time, nullable=False),
        sa.Column("actual_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actual_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "status",
            sa.String(30),
            server_default="scheduled",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

def downgrade() -> None:
    op.drop_table("driver_shifts")
