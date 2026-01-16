"""Department model for business organizational units."""

from sqlalchemy import Column, String, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import BaseModel


class Department(BaseModel):
    """Department model for business organizational units."""

    __tablename__ = "departments"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(7), nullable=True)  # Hex color code (e.g., #FF5733)
    icon = Column(String(50), nullable=True)  # Icon identifier (e.g., 'users', 'chart-bar')

    # Relationships
    business = relationship("Business", back_populates="departments")
    business_users = relationship("BusinessUser", back_populates="department")

    def __repr__(self) -> str:
        return f"<Department {self.name} (Business: {self.business_id})>"
