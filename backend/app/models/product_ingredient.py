import uuid

from sqlalchemy import Column, String, Numeric, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class ProductIngredient(BaseModel):
    __tablename__ = "product_ingredients"

    business_id = Column(UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True)

    name = Column(String(255), nullable=False)
    unit = Column(String(50), nullable=False, default="unit")
    quantity = Column(Numeric(12, 4), nullable=False, default=1)
    cost = Column(Numeric(12, 4), nullable=False, default=0)
    sort_order = Column(Integer, nullable=False, default=0)

    product = relationship("Product", back_populates="ingredients")

    @property
    def line_total(self) -> float:
        return float((self.cost or 0) * (self.quantity or 0))
