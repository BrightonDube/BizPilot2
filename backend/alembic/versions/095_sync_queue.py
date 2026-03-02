"""Add sync queue and sync metadata tables for offline-first sync engine.

Revision ID: 095_sync_queue
Revises: 094_month_end_extensions
Create Date: 2025-01-01 00:00:00.000000

Why server-side sync queue?
The offline-sync-engine spec requires the backend to track pending sync
operations and metadata per entity type.  Mobile/offline clients push
changes to this queue; the server resolves conflicts and applies them.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "095_sync_queue"
down_revision = "094_month_end_extensions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -- sync_queue: pending operations from offline clients ------------
    op.create_table(
        "sync_queue",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("business_id", UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("device_id", UUID(as_uuid=True), nullable=True),
        sa.Column("entity_type", sa.String(50), nullable=False),  # product, order, customer, etc.
        sa.Column("entity_id", UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(20), nullable=False),  # create, update, delete
        sa.Column("payload", JSONB, nullable=False),
        sa.Column("attempts", sa.Integer, server_default="0"),
        sa.Column("last_error", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), server_default="pending"),  # pending, processing, completed, failed
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_sync_queue_business_status", "sync_queue", ["business_id", "status"])
    op.create_index("ix_sync_queue_entity", "sync_queue", ["entity_type", "entity_id"])

    # -- sync_metadata: per-entity-type watermark tracking --------------
    op.create_table(
        "sync_metadata",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("business_id", UUID(as_uuid=True), sa.ForeignKey("businesses.id"), nullable=False),
        sa.Column("device_id", UUID(as_uuid=True), nullable=True),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_sync_status", sa.String(20), nullable=True),
        sa.Column("records_synced", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_unique_constraint(
        "uq_sync_metadata_entity", "sync_metadata",
        ["business_id", "device_id", "entity_type"],
    )


def downgrade() -> None:
    op.drop_table("sync_metadata")
    op.drop_table("sync_queue")
