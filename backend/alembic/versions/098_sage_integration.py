"""Add Sage accounting integration tables.

Revision ID: 098_sage_integration
Revises: 097_petty_cash_ext
Create Date: 2025-01-01 00:00:00.000000

Why these tables?
Sage integration requires persistent storage for:
- OAuth connection state and encrypted tokens
- Account mappings between BizPilot and Sage chart of accounts
- Sync audit trail for compliance and debugging
- Retry queue for resilient async syncing
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


revision = "098_sage_integration"
down_revision = "097_petty_cash_ext"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # sage_connections — OAuth connection state per business
    # ------------------------------------------------------------------
    op.create_table(
        "sage_connections",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("business_id", UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False, unique=True),
        sa.Column("company_id", sa.String(255), nullable=True),
        sa.Column("company_name", sa.String(255), nullable=True),
        sa.Column("access_token_encrypted", sa.Text, nullable=True),
        sa.Column("refresh_token_encrypted", sa.Text, nullable=True),
        sa.Column("token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="disconnected"),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sync_enabled", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("config", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_sage_connections_business_id", "sage_connections", ["business_id"])

    # ------------------------------------------------------------------
    # sage_account_mappings — BizPilot account → Sage account mapping
    # ------------------------------------------------------------------
    op.create_table(
        "sage_account_mappings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("business_id", UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("connection_id", UUID(as_uuid=True), sa.ForeignKey("sage_connections.id"), nullable=False),
        sa.Column("bizpilot_account_type", sa.String(50), nullable=False),
        sa.Column("bizpilot_account_id", sa.String(255), nullable=True),
        sa.Column("sage_account_id", sa.String(255), nullable=False),
        sa.Column("sage_account_name", sa.String(255), nullable=True),
        sa.Column("tax_code", sa.String(50), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_sage_account_mappings_business_id", "sage_account_mappings", ["business_id"])
    op.create_index("ix_sage_account_mappings_connection_id", "sage_account_mappings", ["connection_id"])

    # ------------------------------------------------------------------
    # sage_sync_logs — audit trail for all sync operations
    # ------------------------------------------------------------------
    op.create_table(
        "sage_sync_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("business_id", UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("connection_id", UUID(as_uuid=True), sa.ForeignKey("sage_connections.id"), nullable=False),
        sa.Column("sync_type", sa.String(50), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=True),
        sa.Column("entity_id", sa.String(255), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("request_data", JSONB, nullable=True),
        sa.Column("response_data", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_sage_sync_logs_business_id", "sage_sync_logs", ["business_id"])
    op.create_index("ix_sage_sync_logs_status", "sage_sync_logs", ["status"])

    # ------------------------------------------------------------------
    # sage_sync_queue — retry queue for failed sync operations
    # ------------------------------------------------------------------
    op.create_table(
        "sage_sync_queue",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("business_id", UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("connection_id", UUID(as_uuid=True), sa.ForeignKey("sage_connections.id"), nullable=False),
        sa.Column("operation_type", sa.String(50), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", sa.String(255), nullable=False),
        sa.Column("payload", JSONB, nullable=False),
        sa.Column("priority", sa.Integer, nullable=False, server_default="5"),
        sa.Column("retry_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("max_retries", sa.Integer, nullable=False, server_default="5"),
        sa.Column("next_retry_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_sage_sync_queue_business_status", "sage_sync_queue", ["business_id", "status"])
    op.create_index("ix_sage_sync_queue_next_retry", "sage_sync_queue", ["next_retry_at"])


def downgrade() -> None:
    op.drop_table("sage_sync_queue")
    op.drop_table("sage_sync_logs")
    op.drop_table("sage_account_mappings")
    op.drop_table("sage_connections")
