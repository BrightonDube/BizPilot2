"""Models for WooCommerce e-commerce integration.

Manages REST API connections and bi-directional entity sync mapping
between BizPilot products/orders and WooCommerce.

Why separate from Xero?
WooCommerce syncs products, inventory, and orders (e-commerce data),
while Xero syncs invoices and payments (accounting data).  Different
data flows, different conflict resolution strategies.
"""

from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.models.base import BaseModel


class WooConnection(BaseModel):
    """WooCommerce REST API connection per business.

    Consumer key/secret are stored encrypted.  The webhook_secret
    is used to verify incoming WooCommerce webhook payloads.
    """

    __tablename__ = "woo_connections"

    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=False,
        unique=True,
    )
    store_url = Column(String(500), nullable=False)
    consumer_key_encrypted = Column(Text, nullable=True)
    consumer_secret_encrypted = Column(Text, nullable=True)
    is_active = Column(Boolean, default=False, nullable=False)
    webhook_secret = Column(String(255), nullable=True)
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    sync_status = Column(String(20), default="idle", nullable=False)
    config = Column(
        JSONB,
        nullable=True,
        comment="Sync direction, category mappings, variant handling",
    )


class WooSyncMap(BaseModel):
    """Per-entity ID mapping between BizPilot and WooCommerce.

    Enables bi-directional sync by tracking which BizPilot entities
    have been pushed/pulled and their WooCommerce counterparts.
    """

    __tablename__ = "woo_sync_maps"

    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id"),
        nullable=False,
        index=True,
    )
    entity_type = Column(
        String(50),
        nullable=False,
        comment="product | category | order | customer",
    )
    bizpilot_id = Column(UUID(as_uuid=True), nullable=False)
    woo_id = Column(
        String(255),
        nullable=True,
        comment="WooCommerce ID (integer stored as string)",
    )
    direction = Column(String(10), default="push", nullable=False)
    status = Column(String(20), default="pending", nullable=False)
    payload_hash = Column(String(64), nullable=True)
    error_message = Column(Text, nullable=True)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
