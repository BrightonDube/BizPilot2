"""Supplier model for supplier management."""

from sqlalchemy import Column, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, ARRAY

from app.models.base import BaseModel


class Supplier(BaseModel):
    """Supplier model for purchasing."""

    __tablename__ = "suppliers"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)

    name = Column(String(255), nullable=False, index=True)
    contact_name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True, index=True)
    phone = Column(String(50), nullable=True)

    tax_number = Column(String(100), nullable=True)
    website = Column(String(255), nullable=True)

    address_line1 = Column(String(255), nullable=True)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    country = Column(String(100), nullable=True)

    notes = Column(Text, nullable=True)
    tags = Column(ARRAY(String), default=[])

    def __repr__(self) -> str:
        return f"<Supplier {self.name}>"

    @property
    def display_name(self) -> str:
        return self.name or "Unknown"

    @property
    def full_address(self) -> str:
        parts = [
            self.address_line1,
            self.address_line2,
            f"{self.city}, {self.state} {self.postal_code}".strip(", "),
            self.country,
        ]
        return "\n".join(p for p in parts if p)
