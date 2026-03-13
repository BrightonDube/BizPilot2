"""SQLAlchemy models for the bulk operations system.

This module defines the ORM layer for tracked bulk operations, their
per-record items, and reusable import/export templates.

Why a separate model file instead of extending an existing one?
Bulk operations cut across many domains (products, inventory, suppliers)
so they deserve their own module.  Keeping them isolated also avoids
circular imports with the entity models they reference.
"""

import enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


# ── Enums ────────────────────────────────────────────────────────────────────

class BulkOperationType(str, enum.Enum):
    """Supported bulk operation categories.

    Why str + Enum?  Allows seamless JSON serialisation and comparison
    with the varchar column stored in PostgreSQL.
    """

    PRICE_UPDATE = "price_update"
    STOCK_ADJUSTMENT = "stock_adjustment"
    IMPORT = "import"
    EXPORT = "export"
    CATEGORY_ASSIGN = "category_assign"
    SUPPLIER_ASSIGN = "supplier_assign"
    ACTIVATE = "activate"
    DELETE = "delete"


class OperationStatus(str, enum.Enum):
    """Lifecycle states for a BulkOperation.

    Flow: pending → validating → processing → completed | failed
    Alternative flows:
      - pending → cancelled  (user cancelled before start)
      - processing → cancelled  (user cancelled mid-run)
      - completed → rolling_back → completed  (rollback finished)
    """

    PENDING = "pending"
    VALIDATING = "validating"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    ROLLING_BACK = "rolling_back"


class ItemStatus(str, enum.Enum):
    """Per-record status within a bulk operation."""

    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


# ── Models ───────────────────────────────────────────────────────────────────

class BulkOperation(BaseModel):
    """Header record for a tracked bulk operation.

    Tracks aggregate progress (total, processed, successful, failed) and
    stores operation-specific parameters as JSONB so each operation type
    can carry its own configuration without schema changes.
    """

    __tablename__ = "bulk_operations"

    operation_type = Column(
        String(50),
        nullable=False,
        index=True,
        comment="Discriminator for the type of bulk action",
    )
    status = Column(
        String(30),
        nullable=False,
        default=OperationStatus.PENDING.value,
        index=True,
        comment="Current lifecycle state",
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=False,
        index=True,
    )

    # ── Progress counters ────────────────────────────────────────────────
    total_records = Column(Integer, nullable=False, default=0)
    processed_records = Column(Integer, nullable=False, default=0)
    successful_records = Column(Integer, nullable=False, default=0)
    failed_records = Column(Integer, nullable=False, default=0)

    # ── Operation payload ────────────────────────────────────────────────
    parameters = Column(
        JSONB,
        nullable=True,
        comment="Operation-specific parameters (adjustment_type, file_path, etc.)",
    )
    error_summary = Column(Text, nullable=True)

    # ── Timestamps ───────────────────────────────────────────────────────
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # ── Relationships ────────────────────────────────────────────────────
    items = relationship(
        "BulkOperationItem",
        back_populates="operation",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )

    # Convenience properties
    @property
    def progress_percentage(self) -> float:
        """Calculate completion percentage, safe from division-by-zero."""
        if self.total_records == 0:
            return 0.0
        return round(self.processed_records / self.total_records * 100, 1)

    @property
    def is_terminal(self) -> bool:
        """Return True if the operation is in a final state."""
        return self.status in (
            OperationStatus.COMPLETED.value,
            OperationStatus.FAILED.value,
            OperationStatus.CANCELLED.value,
        )


class BulkOperationItem(BaseModel):
    """Per-record detail row within a bulk operation.

    Stores before/after snapshots as JSONB to enable rollback and audit
    without requiring a separate audit table for every entity type.
    """

    __tablename__ = "bulk_operation_items"

    bulk_operation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("bulk_operations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    record_id = Column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
        comment="FK to the affected entity (product, inventory_item, etc.)",
    )
    status = Column(
        String(20),
        nullable=False,
        default=ItemStatus.PENDING.value,
        index=True,
    )
    before_data = Column(JSONB, nullable=True, comment="Original values snapshot")
    after_data = Column(JSONB, nullable=True, comment="New values snapshot")
    error_message = Column(Text, nullable=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)

    # ── Relationships ────────────────────────────────────────────────────
    operation = relationship("BulkOperation", back_populates="items")


class BulkTemplate(BaseModel):
    """Reusable template for import/export operations.

    System templates (is_system_template=True) are available to all
    businesses.  User-created templates are scoped to a single business.
    template_data holds the field mapping, validation rules, and default
    values as JSONB — keeping the schema flexible for different operation
    types.
    """

    __tablename__ = "bulk_templates"

    name = Column(String(255), nullable=False)
    operation_type = Column(
        String(50),
        nullable=False,
        index=True,
    )
    description = Column(Text, nullable=True)
    template_data = Column(
        JSONB,
        nullable=False,
        comment="Field mappings, validation rules, default values",
    )
    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=True,
        index=True,
        comment="NULL for system templates",
    )
    is_system_template = Column(Boolean, nullable=False, default=False)
    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )
