"""POS Connection model for integrating with Point of Sale systems."""

from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, Integer, ForeignKey, DateTime, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
import enum

from app.models.base import BaseModel


class POSProvider(str, enum.Enum):
    """Supported POS system providers."""
    LIGHTSPEED = "lightspeed"
    GAAP = "gaap"
    PILOT = "pilot"
    MARKETMAN = "marketman"
    SQUARE = "square"
    SHOPIFY = "shopify"
    VEND = "vend"
    TOAST = "toast"
    CLOVER = "clover"
    REVEL = "revel"
    CUSTOM = "custom"  # For custom API integrations


class POSConnectionStatus(str, enum.Enum):
    """Status of POS connection."""
    PENDING = "pending"  # Connection initiated but not verified
    ACTIVE = "active"  # Connection active and syncing
    INACTIVE = "inactive"  # Manually disabled
    ERROR = "error"  # Connection error
    EXPIRED = "expired"  # OAuth token expired


class POSConnection(BaseModel):
    """Connection to an external POS system."""

    __tablename__ = "pos_connections"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    
    # Provider info
    provider = Column(
        SQLEnum(POSProvider, values_callable=lambda x: [e.value for e in x], name='posprovider'),
        nullable=False
    )
    name = Column(String(255), nullable=False)  # User-friendly name for the connection
    
    # Connection credentials (encrypted in production)
    api_key = Column(Text, nullable=True)
    api_secret = Column(Text, nullable=True)
    access_token = Column(Text, nullable=True)
    refresh_token = Column(Text, nullable=True)
    token_expires_at = Column(DateTime, nullable=True)
    
    # Connection config
    base_url = Column(String(500), nullable=True)  # For custom integrations
    webhook_url = Column(String(500), nullable=True)
    webhook_secret = Column(String(255), nullable=True)
    
    # Additional settings stored as JSON
    settings = Column(JSONB, default=dict)  # Store provider-specific settings
    
    # Status
    status = Column(
        SQLEnum(POSConnectionStatus, values_callable=lambda x: [e.value for e in x], name='posconnectionstatus'),
        default=POSConnectionStatus.PENDING
    )
    
    # Sync configuration
    sync_enabled = Column(Boolean, default=True)
    sync_products = Column(Boolean, default=True)
    sync_inventory = Column(Boolean, default=True)
    sync_sales = Column(Boolean, default=True)
    sync_customers = Column(Boolean, default=False)
    
    # Sync tracking
    last_sync_at = Column(DateTime, nullable=True)
    last_sync_status = Column(String(50), nullable=True)
    last_sync_error = Column(Text, nullable=True)
    
    # Relationships
    business = relationship("Business")

    def __repr__(self) -> str:
        return f"<POSConnection {self.name} ({self.provider})>"

    @property
    def is_connected(self) -> bool:
        """Check if connection is active."""
        return self.status == POSConnectionStatus.ACTIVE

    @property
    def needs_reauth(self) -> bool:
        """Check if OAuth token needs refresh."""
        if not self.token_expires_at:
            return False
        return datetime.utcnow() >= self.token_expires_at


class POSSyncLog(BaseModel):
    """Log of POS sync operations."""

    __tablename__ = "pos_sync_logs"

    connection_id = Column(UUID(as_uuid=True), ForeignKey("pos_connections.id"), nullable=False, index=True)
    
    # Sync details
    sync_type = Column(String(50), nullable=False)  # products, sales, inventory, customers
    direction = Column(String(20), nullable=False)  # pull, push
    
    # Results
    records_processed = Column(Integer, default=0)
    records_created = Column(Integer, default=0)
    records_updated = Column(Integer, default=0)
    records_failed = Column(Integer, default=0)
    
    # Status
    status = Column(String(20), nullable=False)  # success, partial, failed
    error_message = Column(Text, nullable=True)
    details = Column(JSONB, default=dict)  # Detailed sync information
    
    # Timing
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships
    connection = relationship("POSConnection")

    def __repr__(self) -> str:
        return f"<POSSyncLog {self.sync_type} {self.status}>"
