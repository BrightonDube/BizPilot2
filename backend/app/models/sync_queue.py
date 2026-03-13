"""Sync queue models for the offline-first sync engine.

Why server-side sync queue?
Offline clients (mobile POS, tablets) accumulate changes locally while
disconnected.  When connectivity resumes, they push changes to this queue.
The server processes items in order, resolves conflicts, and applies them.
This decoupled architecture ensures the server never blocks on client pushes
and can retry failures independently.
"""

import enum

from sqlalchemy import Column, String, Text, Integer, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.models.base import BaseModel


class SyncQueueStatus(str, enum.Enum):
    """Processing status for sync queue items."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class SyncQueueAction(str, enum.Enum):
    """CRUD action type for sync operations."""
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"


class SyncQueueItem(BaseModel):
    """A single queued sync operation from an offline client.

    Why JSONB payload?
    Different entity types have different schemas.  Storing the full
    serialised entity as JSONB avoids polymorphic table designs and
    makes it trivial to replay the exact state the client intended.
    """

    __tablename__ = "sync_queue"

    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    device_id = Column(UUID(as_uuid=True), nullable=True)
    entity_type = Column(String(50), nullable=False)  # product, order, customer, etc.
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    action = Column(String(20), nullable=False)  # create, update, delete
    payload = Column(JSONB, nullable=False)
    attempts = Column(Integer, default=0)
    last_error = Column(Text, nullable=True)
    status = Column(String(20), default="pending")
    processed_at = Column(DateTime(timezone=True), nullable=True)


class SyncMetadata(BaseModel):
    """Per-entity-type sync watermark for a business/device pair.

    Why track per-entity-type watermarks?
    Each entity type may sync at different rates (products rarely change,
    orders change constantly).  Storing the last sync timestamp per type
    lets the client request only changes since its last successful sync,
    reducing bandwidth and processing time.
    """

    __tablename__ = "sync_metadata"

    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
    )
    device_id = Column(UUID(as_uuid=True), nullable=True)
    entity_type = Column(String(50), nullable=False)
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    last_sync_status = Column(String(20), nullable=True)
    records_synced = Column(Integer, default=0)
