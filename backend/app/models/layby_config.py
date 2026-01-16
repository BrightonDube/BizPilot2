"""Layby configuration model for storing layby policy settings.

This model stores configurable layby policies per business (and optionally per location).
Validates: Requirements 12.1-12.8
"""

from decimal import Decimal

from sqlalchemy import Boolean, Column, ForeignKey, Integer, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class LaybyConfig(BaseModel):
    """Layby configuration model for business-specific layby policies.
    
    This model allows businesses to configure their layby terms including:
    - Minimum deposit percentage (Requirement 12.1)
    - Maximum layby duration (Requirement 12.2)
    - Cancellation fees (Requirement 12.3)
    - Restocking fees (Requirement 12.4)
    - Extension fees and limits (Requirement 12.5)
    - Reminder notification timing (Requirement 12.6)
    - Collection grace period (Requirement 12.7)
    - Enable/disable layby feature per location (Requirement 12.8)
    """

    __tablename__ = "layby_config"
    __table_args__ = (
        UniqueConstraint("business_id", "location_id", name="uq_layby_config_business_location"),
    )

    # Business and location references
    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    location_id = Column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
    )  # Optional: for location-specific config

    # Deposit configuration (Requirement 12.1)
    min_deposit_percentage = Column(
        Numeric(5, 2),
        nullable=False,
        default=Decimal("10.00"),
    )

    # Duration configuration (Requirement 12.2)
    max_duration_days = Column(
        Integer,
        nullable=False,
        default=90,
    )

    # Cancellation fee configuration (Requirement 12.3)
    cancellation_fee_percentage = Column(
        Numeric(5, 2),
        nullable=False,
        default=Decimal("10.00"),
    )
    cancellation_fee_minimum = Column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("10.00"),
    )

    # Restocking fee configuration (Requirement 12.4)
    restocking_fee_per_item = Column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0.00"),
    )

    # Extension configuration (Requirement 12.5)
    extension_fee = Column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    max_extensions = Column(
        Integer,
        nullable=False,
        default=2,
    )

    # Reminder configuration (Requirement 12.6)
    reminder_days_before = Column(
        Integer,
        nullable=False,
        default=3,
    )

    # Collection grace period (Requirement 12.7)
    collection_grace_days = Column(
        Integer,
        nullable=False,
        default=14,
    )

    # Enable/disable layby feature (Requirement 12.8)
    is_enabled = Column(
        Boolean,
        nullable=False,
        default=True,
        index=True,
    )

    # Relationships
    business = relationship("Business", back_populates="layby_configs")

    def __repr__(self) -> str:
        location_str = f", location={self.location_id}" if self.location_id else ""
        return f"<LaybyConfig business={self.business_id}{location_str}>"

    @property
    def min_deposit_percentage_float(self) -> float:
        """Return min_deposit_percentage as a float for calculations."""
        return float(self.min_deposit_percentage)

    @property
    def cancellation_fee_percentage_float(self) -> float:
        """Return cancellation_fee_percentage as a float for calculations."""
        return float(self.cancellation_fee_percentage)
