"""Models for Xero accounting integration.

Manages OAuth2 connections and per-entity sync tracking for pushing
invoices, payments, and contacts from BizPilot to Xero.

Why a sync log table?
Idempotent sync requires knowing what has already been pushed.
The sync log tracks entity→Xero ID mappings and payload hashes
to avoid duplicate pushes and detect upstream changes.
"""

from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.models.base import BaseModel


class XeroConnection(BaseModel):
    """OAuth2 connection to a Xero organisation.

    One connection per business.  Tokens are stored encrypted.
    """

    __tablename__ = "xero_connections"

    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=False,
        unique=True,
    )
    tenant_id = Column(
        String(255),
        nullable=True,
        comment="Xero tenant (organisation) ID",
    )
    access_token_encrypted = Column(Text, nullable=True)
    refresh_token_encrypted = Column(Text, nullable=True)
    token_expires_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=False, nullable=False)
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    sync_status = Column(String(20), default="idle", nullable=False)
    config = Column(
        JSONB,
        nullable=True,
        comment="Account mappings and sync preferences",
    )


class XeroSyncLog(BaseModel):
    """Per-entity sync tracking for Xero integration.

    Each row maps a BizPilot entity to its Xero counterpart
    and tracks the sync status and payload hash.
    """

    __tablename__ = "xero_sync_logs"

    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=False,
        index=True,
    )
    entity_type = Column(
        String(50),
        nullable=False,
        comment="invoice | payment | contact | credit_note",
    )
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    xero_id = Column(
        String(255),
        nullable=True,
        comment="Xero-assigned ID after successful sync",
    )
    direction = Column(String(10), default="push", nullable=False)
    status = Column(
        String(20),
        default="pending",
        nullable=False,
        comment="pending | synced | failed | skipped",
    )
    error_message = Column(Text, nullable=True)
    payload_hash = Column(
        String(64),
        nullable=True,
        comment="SHA-256 of synced payload for change detection",
    )
    synced_at = Column(DateTime(timezone=True), nullable=True)
