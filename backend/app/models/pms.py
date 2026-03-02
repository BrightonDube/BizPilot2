"""Models for PMS (Property Management System) integration.

Bridges BizPilot POS with external property management systems
(Opera, Protel, Mews, Cloudbeds) for hotel/lodge room charging.

Why a separate integration layer?
PMS systems vary wildly in API design and data models.  This module
provides a unified internal data model that adapters translate to/from,
keeping the rest of the codebase PMS-agnostic.
"""

import uuid

from sqlalchemy import (
    Column,
    String,
    Text,
    Boolean,
    Date,
    DateTime,
    Numeric,
    ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.models.base import BaseModel


class PMSConnection(BaseModel):
    """Configuration for a PMS integration instance.

    Each business may have one active connection to a PMS.
    Credentials are stored Fernet-encrypted (not plain text).
    """

    __tablename__ = "pms_connections"

    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=False,
        index=True,
    )
    adapter_type = Column(
        String(50),
        nullable=False,
        comment="opera | protel | mews | cloudbeds | generic",
    )
    connection_name = Column(String(255), nullable=False)
    host_url = Column(String(500), nullable=False)
    encrypted_credentials = Column(
        Text,
        nullable=True,
        comment="Fernet-encrypted JSON blob of API keys/passwords",
    )
    is_active = Column(Boolean, default=True, nullable=False)
    last_health_check_at = Column(DateTime(timezone=True), nullable=True)
    health_status = Column(String(20), default="unknown", nullable=False)
    config = Column(
        JSONB,
        nullable=True,
        comment="Adapter-specific config (property ID, resort code, etc.)",
    )


class PMSGuestCache(BaseModel):
    """Cached guest profile from PMS for fast lookup and offline access.

    Why cache?
    Network round-trips to the PMS for every room charge lookup
    adds 200-500ms latency.  Caching reduces this to <10ms.
    The cache is refreshed on check-in, check-out, and hourly.
    """

    __tablename__ = "pms_guest_cache"

    connection_id = Column(
        UUID(as_uuid=True),
        ForeignKey("pms_connections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    pms_guest_id = Column(String(255), nullable=False)
    guest_name = Column(String(500), nullable=False)
    room_number = Column(String(20), nullable=True)
    check_in_date = Column(Date, nullable=True)
    check_out_date = Column(Date, nullable=True)
    folio_number = Column(String(100), nullable=True)
    credit_limit = Column(Numeric(12, 2), nullable=True)
    guest_data = Column(
        JSONB,
        nullable=True,
        comment="Full guest profile from PMS for offline access",
    )
    cached_at = Column(DateTime(timezone=True), nullable=True)


class PMSCharge(BaseModel):
    """A charge posted (or pending) to a guest's PMS folio.

    Status flow: pending → posted | failed
    Reversed charges get a separate PMSChargeReversal record.
    """

    __tablename__ = "pms_charges"

    connection_id = Column(
        UUID(as_uuid=True),
        ForeignKey("pms_connections.id"),
        nullable=False,
        index=True,
    )
    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=False,
        index=True,
    )
    order_id = Column(UUID(as_uuid=True), nullable=True)
    room_number = Column(String(20), nullable=False)
    guest_name = Column(String(500), nullable=True)
    folio_number = Column(String(100), nullable=True)
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), default="ZAR", nullable=False)
    description = Column(Text, nullable=True)
    status = Column(
        String(20),
        default="pending",
        nullable=False,
        comment="pending | posted | failed | reversed",
    )
    pms_transaction_id = Column(
        String(255),
        nullable=True,
        comment="External reference returned by PMS after posting",
    )
    error_message = Column(Text, nullable=True)
    posted_at = Column(DateTime(timezone=True), nullable=True)
    posted_by = Column(UUID(as_uuid=True), nullable=True)


class PMSChargeReversal(BaseModel):
    """Reversal/refund of a previously posted PMS charge.

    Requires manager approval before posting to PMS.
    """

    __tablename__ = "pms_charge_reversals"

    charge_id = Column(
        UUID(as_uuid=True),
        ForeignKey("pms_charges.id"),
        nullable=False,
        index=True,
    )
    reason = Column(Text, nullable=False)
    status = Column(
        String(20),
        default="pending",
        nullable=False,
        comment="pending | approved | posted | rejected",
    )
    approved_by = Column(UUID(as_uuid=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    pms_reversal_id = Column(String(255), nullable=True)
    reversed_at = Column(DateTime(timezone=True), nullable=True)


class PMSReconciliationSession(BaseModel):
    """End-of-day reconciliation run comparing POS charges vs PMS records."""

    __tablename__ = "pms_reconciliation_sessions"

    connection_id = Column(
        UUID(as_uuid=True),
        ForeignKey("pms_connections.id"),
        nullable=False,
    )
    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=False,
    )
    session_date = Column(Date, nullable=False)
    status = Column(
        String(20),
        default="in_progress",
        nullable=False,
        comment="in_progress | completed | failed",
    )
    pos_total = Column(Numeric(12, 2), nullable=True)
    pms_total = Column(Numeric(12, 2), nullable=True)
    variance = Column(Numeric(12, 2), nullable=True)
    started_by = Column(UUID(as_uuid=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)


class PMSReconciliationItem(BaseModel):
    """Individual line item in a reconciliation session."""

    __tablename__ = "pms_reconciliation_items"

    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("pms_reconciliation_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    charge_id = Column(UUID(as_uuid=True), nullable=True)
    status = Column(
        String(30),
        default="pending",
        nullable=False,
        comment="matched | missing_in_pms | missing_in_pos | amount_mismatch | resolved",
    )
    pos_amount = Column(Numeric(12, 2), nullable=True)
    pms_amount = Column(Numeric(12, 2), nullable=True)
    resolution_note = Column(Text, nullable=True)
    resolved_by = Column(UUID(as_uuid=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)


class PMSAuditLog(BaseModel):
    """Immutable audit log for all PMS transactions.

    Why immutable?
    PMS charges involve real money (guest bills).  Audit logs must be
    tamper-proof for compliance and dispute resolution.  Entries are
    insert-only with no update/delete operations.
    """

    __tablename__ = "pms_audit_logs"

    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=False,
        index=True,
    )
    connection_id = Column(
        UUID(as_uuid=True),
        ForeignKey("pms_connections.id"),
        nullable=True,
    )
    action = Column(String(100), nullable=False)
    entity_type = Column(
        String(50),
        nullable=False,
        comment="charge | reversal | guest | connection | reconciliation",
    )
    entity_id = Column(UUID(as_uuid=True), nullable=True)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    details = Column(JSONB, nullable=True)
    ip_address = Column(String(45), nullable=True)
