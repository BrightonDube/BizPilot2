"""Product addons and modifier groups."""

import enum

from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class SelectionType(str, enum.Enum):
    SINGLE = "single"       # radio - pick one
    MULTIPLE = "multiple"   # checkbox - pick many


class ProductModifierGroup(BaseModel):
    """Links a modifier group to a product."""

    __tablename__ = "product_modifier_groups"

    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True)
    modifier_group_id = Column(UUID(as_uuid=True), ForeignKey("modifier_groups.id"), nullable=False, index=True)
    sort_order = Column(Integer, default=0)

    product = relationship("Product", lazy="joined")
    modifier_group = relationship("ModifierGroup", back_populates="product_links")
