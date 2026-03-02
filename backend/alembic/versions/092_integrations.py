"""Create core Xero and WooCommerce integration tables.

Revision ID: 092_integrations
Revises: 091_pms_core
Create Date: 2025-01-01 00:00:00.000000

Why combined migration?
Both Xero and WooCommerce follow the same sync-log pattern
(external ID mapping + status tracking).  Grouping them avoids
two nearly identical migrations.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "092_integrations"
down_revision = "091_pms_core"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # xero_connections — OAuth2 connection state per business
    # ------------------------------------------------------------------
    op.create_table(
        "xero_connections",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "business_id",
            UUID(as_uuid=True),
            sa.ForeignKey("businesses.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column("tenant_id", sa.String(255), nullable=True,
                  comment="Xero tenant (organisation) ID"),
        sa.Column("access_token_encrypted", sa.Text, nullable=True),
        sa.Column("refresh_token_encrypted", sa.Text, nullable=True),
        sa.Column("token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean, default=False, nullable=False),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sync_status", sa.String(20), default="idle", nullable=False),
        sa.Column("config", JSONB, nullable=True,
                  comment="Account mappings and sync preferences"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ------------------------------------------------------------------
    # xero_sync_logs — per-entity sync tracking
    # ------------------------------------------------------------------
    op.create_table(
        "xero_sync_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "business_id",
            UUID(as_uuid=True),
            sa.ForeignKey("businesses.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("entity_type", sa.String(50), nullable=False,
                  comment="invoice | payment | contact | credit_note"),
        sa.Column("entity_id", UUID(as_uuid=True), nullable=False),
        sa.Column("xero_id", sa.String(255), nullable=True,
                  comment="Xero-assigned ID after successful sync"),
        sa.Column("direction", sa.String(10), default="push", nullable=False,
                  comment="push | pull"),
        sa.Column("status", sa.String(20), default="pending", nullable=False,
                  comment="pending | synced | failed | skipped"),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("payload_hash", sa.String(64), nullable=True,
                  comment="SHA-256 hash of synced payload for change detection"),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_xero_sync_entity",
        "xero_sync_logs",
        ["business_id", "entity_type", "entity_id"],
        unique=True,
    )

    # ------------------------------------------------------------------
    # woo_connections — WooCommerce REST API connection per business
    # ------------------------------------------------------------------
    op.create_table(
        "woo_connections",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "business_id",
            UUID(as_uuid=True),
            sa.ForeignKey("businesses.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column("store_url", sa.String(500), nullable=False),
        sa.Column("consumer_key_encrypted", sa.Text, nullable=True),
        sa.Column("consumer_secret_encrypted", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, default=False, nullable=False),
        sa.Column("webhook_secret", sa.String(255), nullable=True),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sync_status", sa.String(20), default="idle", nullable=False),
        sa.Column("config", JSONB, nullable=True,
                  comment="Sync direction, category mappings, variant handling"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ------------------------------------------------------------------
    # woo_sync_maps — per-entity ID mapping between BizPilot and WooCommerce
    # ------------------------------------------------------------------
    op.create_table(
        "woo_sync_maps",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "business_id",
            UUID(as_uuid=True),
            sa.ForeignKey("businesses.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("entity_type", sa.String(50), nullable=False,
                  comment="product | category | order | customer"),
        sa.Column("bizpilot_id", UUID(as_uuid=True), nullable=False),
        sa.Column("woo_id", sa.String(255), nullable=True,
                  comment="WooCommerce ID (integer stored as string)"),
        sa.Column("direction", sa.String(10), default="push", nullable=False),
        sa.Column("status", sa.String(20), default="pending", nullable=False),
        sa.Column("payload_hash", sa.String(64), nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_woo_sync_entity",
        "woo_sync_maps",
        ["business_id", "entity_type", "bizpilot_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_woo_sync_entity", table_name="woo_sync_maps")
    op.drop_table("woo_sync_maps")
    op.drop_table("woo_connections")
    op.drop_index("ix_xero_sync_entity", table_name="xero_sync_logs")
    op.drop_table("xero_sync_logs")
    op.drop_table("xero_connections")
