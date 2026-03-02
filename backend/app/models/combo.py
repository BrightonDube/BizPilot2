"""Combo deal and combo component models.

These models support bundled product offerings at discounted prices
(Requirement 4 of the addons-modifiers spec).  A ComboDeal groups
multiple ComboComponents, each of which is either a fixed product or a
"choice" slot where the customer picks from a set of allowed products
or categories.

Why a dedicated model file instead of adding to menu.py?
The combo feature is logically separate from modifier groups and has its
own API surface, service layer, and pricing logic.  Keeping it in its
own file improves readability and reduces merge conflicts.
"""

import enum

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class ComboComponentType(str, enum.Enum):
    """Whether a combo component is a specific product or a customer choice.

    FIXED  – the component is always the same product.
    CHOICE – the customer picks from allowed products/categories.
    """

    FIXED = "fixed"
    CHOICE = "choice"


class ComboDeal(BaseModel):
    """A bundled product offering at a discounted price.

    combo_price  – what the customer pays for the whole bundle.
    original_price – sum of component prices at regular pricing, used to
                     display savings ("Save R30!").
    location_ids – optional list of locations; NULL means everywhere.
    """

    __tablename__ = "combo_deals"

    business_id = Column(
        UUID(as_uuid=True),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    combo_price = Column(Numeric(12, 2), nullable=False)
    original_price = Column(Numeric(12, 2), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    location_ids = Column(ARRAY(UUID(as_uuid=True)), nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)

    # Relationships
    components = relationship(
        "ComboComponent",
        back_populates="combo_deal",
        lazy="selectin",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<ComboDeal {self.name!r} price={self.combo_price}>"


class ComboComponent(BaseModel):
    """A single item-slot within a combo deal.

    If component_type is FIXED, fixed_product_id points to the exact
    product.  If component_type is CHOICE, the customer picks from the
    products identified by allowed_product_ids and/or
    allowed_category_ids.
    """

    __tablename__ = "combo_components"

    combo_deal_id = Column(
        UUID(as_uuid=True),
        ForeignKey("combo_deals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    component_type = Column(
        SQLEnum(
            ComboComponentType,
            values_callable=lambda x: [e.value for e in x],
            name="combocomponenttype",
            create_type=False,  # Created by Alembic migration
        ),
        nullable=False,
    )
    fixed_product_id = Column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    allowed_category_ids = Column(ARRAY(UUID(as_uuid=True)), nullable=True)
    allowed_product_ids = Column(ARRAY(UUID(as_uuid=True)), nullable=True)
    quantity = Column(Integer, nullable=False, default=1)
    sort_order = Column(Integer, nullable=False, default=0)
    allow_modifiers = Column(Boolean, nullable=False, default=True)

    # Relationships
    combo_deal = relationship("ComboDeal", back_populates="components")
    fixed_product = relationship("Product", foreign_keys=[fixed_product_id])

    def __repr__(self) -> str:
        return f"<ComboComponent {self.name!r} type={self.component_type}>"
