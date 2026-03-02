"""Multi-location models."""

import enum
from sqlalchemy import Column, String, Integer, Text, ForeignKey, Enum as SQLEnum, Boolean, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class TransferStatus(str, enum.Enum):
    PENDING = "pending"
    IN_TRANSIT = "in_transit"
    RECEIVED = "received"
    CANCELLED = "cancelled"


class Location(BaseModel):
    """Business location / branch."""
    __tablename__ = "locations"

    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    is_warehouse = Column(Boolean, default=False)
    is_primary = Column(Boolean, default=False)

    stock_levels = relationship("LocationStock", back_populates="location", lazy="selectin")


class LocationStock(BaseModel):
    """Stock level at a specific location."""
    __tablename__ = "location_stock"

    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True)
    quantity = Column(Integer, default=0)
    min_quantity = Column(Integer, default=0)
    max_quantity = Column(Integer, nullable=True)

    location = relationship("Location", back_populates="stock_levels")
    product = relationship("Product", lazy="joined")


class StockTransfer(BaseModel):
    """Transfer stock between locations."""
    __tablename__ = "stock_transfers"

    business_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    from_location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False)
    to_location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False)
    status = Column(
        SQLEnum(TransferStatus, values_callable=lambda x: [e.value for e in x], name='transferstatus'),
        default=TransferStatus.PENDING,
    )
    reference_number = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    initiated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    from_location = relationship("Location", foreign_keys=[from_location_id], lazy="joined")
    to_location = relationship("Location", foreign_keys=[to_location_id], lazy="joined")
    items = relationship("StockTransferItem", back_populates="transfer", lazy="selectin")


class StockTransferItem(BaseModel):
    """Line item in a stock transfer."""
    __tablename__ = "stock_transfer_items"

    transfer_id = Column(UUID(as_uuid=True), ForeignKey("stock_transfers.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    received_quantity = Column(Integer, default=0)

    transfer = relationship("StockTransfer", back_populates="items")
    product = relationship("Product", lazy="joined")


class LocationSetting(BaseModel):
    """Location-specific configuration override.

    Why key-value instead of typed columns?
    Different locations may need wildly different settings (operating hours,
    tax rates, delivery zones).  A key-value pattern avoids schema changes
    when new settings are introduced.
    """

    __tablename__ = "location_settings"
    __table_args__ = (
        UniqueConstraint("location_id", "setting_key", name="uq_location_setting"),
    )

    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False, index=True)
    setting_key = Column(String(100), nullable=False)
    setting_value = Column(Text, nullable=True)


class LocationPricing(BaseModel):
    """Per-location product price override.

    Why location-level pricing?
    Businesses with multiple locations often have different pricing
    (downtown vs suburban, high-rent vs low-rent areas).  This table
    overrides the base product price for a specific location.
    """

    __tablename__ = "location_pricing"
    __table_args__ = (
        UniqueConstraint("location_id", "product_id", name="uq_location_product_pricing"),
    )

    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    selling_price = Column(Numeric(12, 2), nullable=False)
    cost_price = Column(Numeric(12, 2), nullable=True)
    is_active = Column(Boolean, default=True)


class AccessLevel(str, enum.Enum):
    """Access levels for user-location assignments."""
    VIEW = "view"
    MANAGE = "manage"
    ADMIN = "admin"


class UserLocationAccess(BaseModel):
    """Per-user per-location permission assignment.

    Why a separate access table?
    Business roles (from RBAC) define what a user CAN do.  This table
    defines WHERE they can do it.  A manager might have "manage" access
    to Location A but only "view" access to Location B.
    """

    __tablename__ = "user_location_access"
    __table_args__ = (
        UniqueConstraint("user_id", "location_id", name="uq_user_location_access"),
    )

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=False, index=True)
    access_level = Column(String(20), nullable=False, default="view")
