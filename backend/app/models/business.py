"""Business model for individual business entities."""

from sqlalchemy import Column, String, ForeignKey, Numeric, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import BaseModel


class Business(BaseModel):
    """Business model for individual business entities."""

    __tablename__ = "businesses"

    name = Column(String(255), nullable=False)
    slug = Column(String(100), index=True, nullable=False)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)

    # Business details
    logo_url = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)

    # Address
    address_street = Column(String(255), nullable=True)
    address_city = Column(String(100), nullable=True)
    address_state = Column(String(100), nullable=True)
    address_postal_code = Column(String(20), nullable=True)
    address_country = Column(String(100), default="South Africa")

    # Tax and financial
    tax_number = Column(String(50), nullable=True)  # South African tax number
    vat_number = Column(String(50), nullable=True)  # VAT registration number
    vat_rate = Column(Numeric(5, 2), default=15.00)  # South African VAT rate
    currency = Column(String(3), default="ZAR")

    # Contact
    phone = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    website = Column(String(255), nullable=True)

    # Invoice settings
    invoice_prefix = Column(String(10), default="INV")
    invoice_terms = Column(Text, nullable=True)
    bank_name = Column(String(100), nullable=True)
    bank_account_number = Column(String(50), nullable=True)
    bank_branch_code = Column(String(20), nullable=True)

    # Relationships
    organization = relationship("Organization", back_populates="businesses")
    business_users = relationship("BusinessUser", back_populates="business", cascade="all, delete-orphan")
    departments = relationship("Department", back_populates="business", cascade="all, delete-orphan")
    layby_configs = relationship("LaybyConfig", back_populates="business", cascade="all, delete-orphan")
    
    # Subscription system relationships
    subscription = relationship("BusinessSubscription", back_populates="business", uselist=False, cascade="all, delete-orphan")
    feature_overrides = relationship("FeatureOverride", back_populates="business", cascade="all, delete-orphan")
    devices = relationship("DeviceRegistry", back_populates="business", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Business {self.name}>"
