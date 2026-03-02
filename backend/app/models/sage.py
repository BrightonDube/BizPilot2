"""
Sage accounting integration models.

Four models supporting the full Sage sync lifecycle:
- SageConnection: OAuth state and encrypted tokens
- SageAccountMapping: Chart of accounts mapping
- SageSyncLog: Audit trail for compliance
- SageSyncQueue: Retry queue for resilient syncing

Why encrypt tokens at the model level?
Sage OAuth tokens grant full access to a business's accounting data.
Storing them encrypted prevents exposure if the database is compromised.
The encryption/decryption is handled by the service layer using Fernet,
keeping the model clean.
"""

import enum
import uuid

from sqlalchemy import (
    Column,
    String,
    Boolean,
    Integer,
    Text,
    DateTime,
    ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.models.base import BaseModel, Base, utc_now


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class SageConnectionStatus(str, enum.Enum):
    """Status of the Sage OAuth connection."""
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    EXPIRED = "expired"
    ERROR = "error"


class SageSyncStatus(str, enum.Enum):
    """Status of a sync operation."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class SageQueueStatus(str, enum.Enum):
    """Status of a queue item."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    DEAD_LETTER = "dead_letter"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class SageConnection(BaseModel):
    """
    OAuth connection to Sage Business Cloud Accounting.

    One connection per business. Stores encrypted tokens and tracks
    sync state. The config JSONB field holds optional settings like
    default tax code and preferred sync frequency.
    """
    __tablename__ = "sage_connections"

    business_id = Column(
        UUID(as_uuid=True), ForeignKey("businesses.id"),
        nullable=False, unique=True, index=True,
    )
    company_id = Column(String(255), nullable=True)
    company_name = Column(String(255), nullable=True)
    # Why encrypted text not String?
    # OAuth tokens can be long (1000+ chars for JWT).
    # Text type has no length limit, and encryption further increases size.
    access_token_encrypted = Column(Text, nullable=True)
    refresh_token_encrypted = Column(Text, nullable=True)
    token_expires_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(
        String(20), nullable=False,
        default=SageConnectionStatus.DISCONNECTED.value,
    )
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    sync_enabled = Column(Boolean, nullable=False, default=False)
    config = Column(JSONB, nullable=True)


class SageAccountMapping(BaseModel):
    """
    Mapping between BizPilot account categories and Sage chart of accounts.

    Why bidirectional mapping?
    BizPilot's account structure differs from Sage's. A mapping layer
    decouples the two systems, allowing BizPilot to evolve its structure
    without breaking Sage integration.
    """
    __tablename__ = "sage_account_mappings"

    business_id = Column(
        UUID(as_uuid=True), ForeignKey("businesses.id"),
        nullable=False, index=True,
    )
    connection_id = Column(
        UUID(as_uuid=True), ForeignKey("sage_connections.id"),
        nullable=False, index=True,
    )
    bizpilot_account_type = Column(String(50), nullable=False)
    bizpilot_account_id = Column(String(255), nullable=True)
    sage_account_id = Column(String(255), nullable=False)
    sage_account_name = Column(String(255), nullable=True)
    tax_code = Column(String(50), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)


class SageSyncLog(Base):
    """
    Audit log for every sync operation.

    Does NOT inherit from BaseModel because sync logs should never be
    soft-deleted — they're a permanent audit trail required for
    reconciliation and compliance.
    """
    __tablename__ = "sage_sync_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(
        UUID(as_uuid=True), ForeignKey("businesses.id"),
        nullable=False, index=True,
    )
    connection_id = Column(
        UUID(as_uuid=True), ForeignKey("sage_connections.id"),
        nullable=False,
    )
    sync_type = Column(String(50), nullable=False)
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(String(255), nullable=True)
    status = Column(
        String(20), nullable=False,
        default=SageSyncStatus.PENDING.value,
    )
    error_message = Column(Text, nullable=True)
    request_data = Column(JSONB, nullable=True)
    response_data = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)


class SageSyncQueue(Base):
    """
    Retry queue for failed or deferred sync operations.

    Why a database queue instead of Redis?
    1. No Redis dependency in the current stack
    2. Database queues survive restarts
    3. Queue items need JSONB payloads that benefit from SQL queries
    4. The volume (10-100 items/day) doesn't warrant a dedicated queue

    The priority + next_retry_at fields enable backoff scheduling:
    retry_count 1 → 5 min, 2 → 15 min, 3 → 1 hr, 4 → 4 hr, 5 → dead letter
    """
    __tablename__ = "sage_sync_queue"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(
        UUID(as_uuid=True), ForeignKey("businesses.id"),
        nullable=False,
    )
    connection_id = Column(
        UUID(as_uuid=True), ForeignKey("sage_connections.id"),
        nullable=False,
    )
    operation_type = Column(String(50), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(String(255), nullable=False)
    payload = Column(JSONB, nullable=False)
    priority = Column(Integer, nullable=False, default=5)
    retry_count = Column(Integer, nullable=False, default=0)
    max_retries = Column(Integer, nullable=False, default=5)
    next_retry_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(
        String(20), nullable=False,
        default=SageQueueStatus.PENDING.value,
    )
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
