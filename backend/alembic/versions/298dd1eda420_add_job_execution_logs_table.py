"""add_job_execution_logs_table

Revision ID: 298dd1eda420
Revises: 49bdc7531641
Create Date: 2026-01-15 23:28:57.491844

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '298dd1eda420'
down_revision: Union[str, None] = '49bdc7531641'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create job_execution_logs table (using string for status to avoid enum issues)
    op.create_table(
        'job_execution_logs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('job_name', sa.String(length=100), nullable=False),
        sa.Column('start_time', sa.DateTime(), nullable=False),
        sa.Column('end_time', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('invoices_processed', sa.Integer(), nullable=True),
        sa.Column('notifications_created', sa.Integer(), nullable=True),
        sa.Column('error_count', sa.Integer(), nullable=True),
        sa.Column('error_details', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create index on job_name
    op.create_index('ix_job_execution_logs_job_name', 'job_execution_logs', ['job_name'])


def downgrade() -> None:
    # Drop index
    op.drop_index('ix_job_execution_logs_job_name', table_name='job_execution_logs')
    
    # Drop table
    op.drop_table('job_execution_logs')
