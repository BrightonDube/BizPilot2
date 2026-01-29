"""Base model with common fields."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.core.database import Base


def utc_now() -> datetime:
    """Get current UTC time (timezone-aware)."""
    return datetime.now(timezone.utc)


# JSON type that works with both PostgreSQL and SQLite
# PostgreSQL will use JSONB, SQLite will use JSON
JSONType = JSON().with_variant(JSONB(), 'postgresql')


class BaseModel(Base):
    """Abstract base model with common fields."""

    __abstract__ = True

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    @property
    def is_deleted(self) -> bool:
        """Check if record is soft-deleted."""
        return self.deleted_at is not None

    def soft_delete(self) -> None:
        """Mark record as deleted."""
        self.deleted_at = utc_now()


class TimestampMixin:
    """Mixin for timestamp fields."""

    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
