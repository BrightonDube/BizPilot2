"""Customer model for customer management."""

from sqlalchemy import Column, String, Text, Numeric, Integer, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, ARRAY
import enum

from app.models.base import BaseModel


class CustomerType(str, enum.Enum):
    """Customer type."""

    INDIVIDUAL = "individual"
    BUSINESS = "business"


class Customer(BaseModel):
    """Customer model for CRM."""

    __tablename__ = "customers"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    
    # Customer type
    customer_type = Column(SQLEnum(CustomerType), default=CustomerType.INDIVIDUAL)
    
    # Contact info
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    email = Column(String(255), nullable=True, index=True)
    phone = Column(String(50), nullable=True)
    
    # Company info (for business customers)
    company_name = Column(String(255), nullable=True)
    tax_number = Column(String(100), nullable=True)  # VAT number, TIN, etc.
    
    # Address
    address_line1 = Column(String(255), nullable=True)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    country = Column(String(100), nullable=True)
    
    # Additional info
    notes = Column(Text, nullable=True)
    tags = Column(ARRAY(String), default=[])
    
    # Metrics (denormalized for performance)
    total_orders = Column(Integer, default=0)
    total_spent = Column(Numeric(12, 2), default=0)
    average_order_value = Column(Numeric(12, 2), default=0)

    def __repr__(self) -> str:
        if self.company_name:
            return f"<Customer {self.company_name}>"
        return f"<Customer {self.first_name} {self.last_name}>"

    @property
    def display_name(self) -> str:
        """Get display name for the customer."""
        if self.company_name:
            return self.company_name
        parts = [self.first_name, self.last_name]
        return " ".join(p for p in parts if p) or "Unknown"

    @property
    def full_address(self) -> str:
        """Get formatted full address."""
        parts = [
            self.address_line1,
            self.address_line2,
            f"{self.city}, {self.state} {self.postal_code}".strip(", "),
            self.country,
        ]
        return "\n".join(p for p in parts if p)
