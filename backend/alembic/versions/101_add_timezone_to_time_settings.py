"""Add timezone column to business_time_settings and change day_end_time default

Revision ID: 101_add_timezone_to_time_settings
Revises: 100_fix_sub_model_cols
Create Date: 2026-03-08 09:00:00.000000

"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "101_add_timezone_to_time_settings"
down_revision: Union[str, None] = "100_fix_sub_model_cols"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add timezone column with default
    op.add_column(
        "business_time_settings",
        sa.Column("timezone", sa.String(50), nullable=False, server_default="Africa/Johannesburg"),
    )
    # Update day_end_time default to 05:00 for existing rows that still have 23:59
    op.execute(
        "UPDATE business_time_settings SET day_end_time = '05:00:00' WHERE day_end_time = '23:59:00'"
    )
    # Update penalty hours from 5 to 4 for existing rows that still have the old default
    op.execute(
        "UPDATE business_time_settings SET auto_clock_out_penalty_hours = 4.00 WHERE auto_clock_out_penalty_hours = 5.00"
    )


def downgrade() -> None:
    op.drop_column("business_time_settings", "timezone")
    op.execute(
        "UPDATE business_time_settings SET day_end_time = '23:59:00' WHERE day_end_time = '05:00:00'"
    )
