"""Add user audit logs table

Revision ID: 054_audit_logs
Revises: 053_online_ordering
Create Date: 2025-01-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '054_audit_logs'
down_revision: Union[str, None] = '053_online_ordering'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum
    auditaction = postgresql.ENUM(
        'login', 'logout', 'create', 'update', 'delete',
        'export', 'import', 'view', 'print', 'void', 'refund',
        name='auditaction', create_type=False,
    )
    auditaction.create(op.get_bind(), checkfirst=True)

    # user_audit_logs
    op.create_table(
        'user_audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True, index=True),
        sa.Column('action', auditaction, nullable=False),
        sa.Column('resource_type', sa.String(100), nullable=False),
        sa.Column('resource_id', sa.String(100), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('metadata_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index('ix_user_audit_logs_action', 'user_audit_logs', ['action'])


def downgrade() -> None:
    op.drop_table('user_audit_logs')
    op.execute("DROP TYPE IF EXISTS auditaction")
