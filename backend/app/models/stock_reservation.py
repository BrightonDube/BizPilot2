"""Stock reservation model for tracking reserved inventory for laybys."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.base import BaseModel


class StockReservation(BaseModel):
    """
    Stock reservation model for tracking reserved inventory for laybys.
    
    This model manages stock reservations when laybys are created, ensuring that
    layby items are set aside and not available for regular sale. It tracks the
    reservation status through the layby lifecycle: reserved when created,
    released if cancelled, and collected when the layby is completed.
    
    Validates: Requirements 9.1-9.7
    - 9.1: Reduce available stock by layby quantities when layby is created
    - 9.2: Return reserved quantities to available stock when layby is cancelled
    - 9.3: Remove reserved quantities from total inventory when layby is collected
    - 9.4: Track reserved stock separately from available stock
    - 9.5: Prevent creating a layby if insufficient stock is available
    - 9.6: Display reserved stock quantities in inventory reports
    - 9.7: Flag layby for review if reserved product is discontinued
    """
    
    __tablename__ = "stock_reservations"
    
    # Foreign key to laybys table (Requirement 9.1 - link reservation to layby)
    layby_id: UUID = Column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("laybys.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Foreign key to products table (Requirement 9.4 - track by product)
    product_id: UUID = Column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    
    # Location ID for location-specific stock tracking
    # Made nullable without FK since locations table may not exist
    # (Requirement 9.6 - support location-based inventory reports)
    location_id: Optional[UUID] = Column(
        PostgreSQLUUID(as_uuid=True),
        nullable=True,
        index=True
    )
    
    # Quantity of product reserved for this layby
    # (Requirement 9.1 - reduce available stock by this quantity)
    quantity: int = Column(Integer, nullable=False)
    
    # Reservation status tracking the lifecycle of the reservation
    # Values: reserved, released, collected
    # - reserved: Initial state when layby is created (Requirement 9.1)
    # - released: When layby is cancelled, stock returns to available (Requirement 9.2)
    # - collected: When layby is completed, stock is removed from inventory (Requirement 9.3)
    status: str = Column(String(20), nullable=False, default="reserved", index=True)
    
    # Timestamp when the stock was reserved (layby creation time)
    reserved_at: datetime = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )
    
    # Timestamp when the stock was released (cancellation) or collected (completion)
    released_at: Optional[datetime] = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    layby = relationship("Layby", back_populates="stock_reservations")
    product = relationship("Product", back_populates="stock_reservations")
    
    # Table constraints
    __table_args__ = (
        # Unique constraint to prevent duplicate reservations for same product/location in a layby
        UniqueConstraint(
            "layby_id", "product_id", "location_id",
            name="uq_stock_reservation_layby_product_location"
        ),
        # Additional indexes for efficient queries
        Index("idx_stock_reservations_product", "product_id"),
        Index("idx_stock_reservations_layby", "layby_id"),
        Index("idx_stock_reservations_status", "status"),
        Index("idx_stock_reservations_location", "location_id"),
    )
    
    def __repr__(self) -> str:
        return f"<StockReservation(id={self.id}, layby_id={self.layby_id}, product_id={self.product_id}, quantity={self.quantity}, status={self.status})>"