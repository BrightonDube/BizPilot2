"""Base model with common fields."""

import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class BaseModel(Base):
    """Abstract base model with common fields."""

    __abstract__ = True

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class TimestampMixin:
    """Mixin for timestamp fields."""

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
