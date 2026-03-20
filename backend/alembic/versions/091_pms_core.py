"""Create core PMS (Property Management System) integration tables.

Revision ID: 091_pms_core
Revises: 090_partners
Create Date: 2025-01-01 00:00:00.000000

Why PMS integration?
Hotels and lodges need to post restaurant/bar charges directly to
guest folios.  This migration creates the connection, charge,
reconciliation, and audit tables that bridge BizPilot POS with
external PMS platforms (Opera, Protel, Mews, Cloudbeds).
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


revision = "091_pms_core"
down_revision = "090_partners"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # ------------------------------------------------------------------
    # pms_connections — one row per PMS integration per business
    # ------------------------------------------------------------------
    op.create_table(
        "pms_connections",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "business_id",
            UUID(as_uuid=True),
            sa.ForeignKey("businesses.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("adapter_type", sa.String(50), nullable=False,
                  comment="opera | protel | mews | cloudbeds | generic"),
        sa.Column("connection_name", sa.String(255), nullable=False),
        sa.Column("host_url", sa.String(500), nullable=False),
        sa.Column("encrypted_credentials", sa.Text, nullable=True,
                  comment="Fernet-encrypted JSON blob of API keys/passwords"),
        sa.Column("is_active", sa.Boolean, default=True, nullable=False),
        sa.Column("last_health_check_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("health_status", sa.String(20), default="unknown", nullable=False),
        sa.Column("config", JSONB, nullable=True,
                  comment="Adapter-specific config (property ID, resort code, etc.)"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ------------------------------------------------------------------
    # pms_guest_cache — local cache of guest profiles for fast lookup
    # ------------------------------------------------------------------
    op.create_table(
        "pms_guest_cache",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "connection_id",
            UUID(as_uuid=True),
            sa.ForeignKey("pms_connections.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("pms_guest_id", sa.String(255), nullable=False),
        sa.Column("guest_name", sa.String(500), nullable=False),
        sa.Column("room_number", sa.String(20), nullable=True),
        sa.Column("check_in_date", sa.Date, nullable=True),
        sa.Column("check_out_date", sa.Date, nullable=True),
        sa.Column("folio_number", sa.String(100), nullable=True),
        sa.Column("credit_limit", sa.Numeric(12, 2), nullable=True),
        sa.Column("guest_data", JSONB, nullable=True,
                  comment="Full guest profile from PMS for offline access"),
        sa.Column("cached_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_pms_guest_cache_room",
        "pms_guest_cache",
        ["connection_id", "room_number"],
    )

    # ------------------------------------------------------------------
    # pms_charges — charges posted to guest folios
    # ------------------------------------------------------------------
    op.create_table(
        "pms_charges",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "connection_id",
            UUID(as_uuid=True),
            sa.ForeignKey("pms_connections.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "business_id",
            UUID(as_uuid=True),
            sa.ForeignKey("businesses.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("order_id", UUID(as_uuid=True), nullable=True),
        sa.Column("room_number", sa.String(20), nullable=False),
        sa.Column("guest_name", sa.String(500), nullable=True),
        sa.Column("folio_number", sa.String(100), nullable=True),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(3), default="ZAR", nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), default="pending", nullable=False,
                  comment="pending | posted | failed | reversed"),
        sa.Column("pms_transaction_id", sa.String(255), nullable=True,
                  comment="External reference returned by PMS after posting"),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("posted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("posted_by", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ------------------------------------------------------------------
    # pms_charge_reversals — reversal/refund records
    # ------------------------------------------------------------------
    op.create_table(
        "pms_charge_reversals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "charge_id",
            UUID(as_uuid=True),
            sa.ForeignKey("pms_charges.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("reason", sa.Text, nullable=False),
        sa.Column("status", sa.String(20), default="pending", nullable=False,
                  comment="pending | approved | posted | rejected"),
        sa.Column("approved_by", UUID(as_uuid=True), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("pms_reversal_id", sa.String(255), nullable=True),
        sa.Column("reversed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ------------------------------------------------------------------
    # pms_reconciliation_sessions — EOD reconciliation runs
    # ------------------------------------------------------------------
    op.create_table(
        "pms_reconciliation_sessions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "connection_id",
            UUID(as_uuid=True),
            sa.ForeignKey("pms_connections.id"),
            nullable=False,
        ),
        sa.Column(
            "business_id",
            UUID(as_uuid=True),
            sa.ForeignKey("businesses.id"),
            nullable=False,
        ),
        sa.Column("session_date", sa.Date, nullable=False),
        sa.Column("status", sa.String(20), default="in_progress", nullable=False,
                  comment="in_progress | completed | failed"),
        sa.Column("pos_total", sa.Numeric(12, 2), nullable=True),
        sa.Column("pms_total", sa.Numeric(12, 2), nullable=True),
        sa.Column("variance", sa.Numeric(12, 2), nullable=True),
        sa.Column("started_by", UUID(as_uuid=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ------------------------------------------------------------------
    # pms_reconciliation_items — line-level reconciliation detail
    # ------------------------------------------------------------------
    op.create_table(
        "pms_reconciliation_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "session_id",
            UUID(as_uuid=True),
            sa.ForeignKey("pms_reconciliation_sessions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("charge_id", UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(30), default="pending", nullable=False,
                  comment="matched | missing_in_pms | missing_in_pos | amount_mismatch | resolved"),
        sa.Column("pos_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("pms_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("resolution_note", sa.Text, nullable=True),
        sa.Column("resolved_by", UUID(as_uuid=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ------------------------------------------------------------------
    # pms_audit_logs — immutable audit trail
    # ------------------------------------------------------------------
    op.create_table(
        "pms_audit_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "business_id",
            UUID(as_uuid=True),
            sa.ForeignKey("businesses.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "connection_id",
            UUID(as_uuid=True),
            sa.ForeignKey("pms_connections.id"),
            nullable=True,
        ),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False,
                  comment="charge | reversal | guest | connection | reconciliation"),
        sa.Column("entity_id", UUID(as_uuid=True), nullable=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=True),
        sa.Column("details", JSONB, nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

def downgrade() -> None:
    op.drop_table("pms_audit_logs")
    op.drop_table("pms_reconciliation_items")
    op.drop_table("pms_reconciliation_sessions")
    op.drop_table("pms_charge_reversals")
    op.drop_table("pms_charges")
    op.drop_index("ix_pms_guest_cache_room", table_name="pms_guest_cache")
    op.drop_table("pms_guest_cache")
    op.drop_table("pms_connections")
