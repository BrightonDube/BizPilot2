"""Menu engineering models."""

from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class MenuItem(BaseModel):
    """Menu item linked to a product."""

    __tablename__ = "menu_items"

    business_id = Column(
        UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True
    )
    product_id = Column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True
    )
    category_id = Column(
        UUID(as_uuid=True),
        ForeignKey("product_categories.id"),
        nullable=True,
        index=True,
    )
    display_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Numeric(12, 2), nullable=False)
    cost = Column(Numeric(12, 2), nullable=False, default=0)
    image_url = Column(String(500), nullable=True)
    display_order = Column(Integer, nullable=False, default=0)
    is_available = Column(Boolean, nullable=False, default=True)
    is_featured = Column(Boolean, nullable=False, default=False)
    prep_time_minutes = Column(Integer, nullable=True)
    course = Column(String(50), nullable=True)

    product = relationship("Product", foreign_keys=[product_id])
    category = relationship("ProductCategory", foreign_keys=[category_id])
    modifier_groups = relationship(
        "ModifierGroup",
        secondary="menu_item_modifier_groups",
        back_populates="menu_items",
    )
    recipes = relationship("Recipe", back_populates="menu_item")


class ModifierGroup(BaseModel):
    """A group of modifiers (e.g. 'Size', 'Extras')."""

    __tablename__ = "modifier_groups"

    business_id = Column(
        UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True
    )
    name = Column(String(100), nullable=False)
    min_selections = Column(Integer, nullable=False, default=0)
    max_selections = Column(Integer, nullable=False, default=1)
    is_required = Column(Boolean, nullable=False, default=False)

    modifiers = relationship("Modifier", back_populates="group")
    menu_items = relationship(
        "MenuItem",
        secondary="menu_item_modifier_groups",
        back_populates="modifier_groups",
    )


class Modifier(BaseModel):
    """A single modifier option within a group."""

    __tablename__ = "modifiers"

    group_id = Column(
        UUID(as_uuid=True),
        ForeignKey("modifier_groups.id"),
        nullable=False,
        index=True,
    )
    business_id = Column(
        UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True
    )
    name = Column(String(100), nullable=False)
    price_adjustment = Column(Numeric(12, 2), nullable=False, default=0)
    is_available = Column(Boolean, nullable=False, default=True)

    group = relationship("ModifierGroup", back_populates="modifiers")


class MenuItemModifierGroup(BaseModel):
    """Link table between menu items and modifier groups."""

    __tablename__ = "menu_item_modifier_groups"

    menu_item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("menu_items.id"),
        nullable=False,
        index=True,
    )
    modifier_group_id = Column(
        UUID(as_uuid=True),
        ForeignKey("modifier_groups.id"),
        nullable=False,
        index=True,
    )


class Recipe(BaseModel):
    """Recipe for a menu item."""

    __tablename__ = "recipes"

    business_id = Column(
        UUID(as_uuid=True), ForeignKey("businesses.id"), nullable=False, index=True
    )
    menu_item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("menu_items.id"),
        nullable=True,
        index=True,
    )
    name = Column(String(255), nullable=False)
    yield_quantity = Column(Numeric(12, 2), nullable=False, default=1)
    instructions = Column(Text, nullable=True)

    menu_item = relationship("MenuItem", back_populates="recipes")
    ingredients = relationship("RecipeIngredient", back_populates="recipe")


class RecipeIngredient(BaseModel):
    """Ingredient line in a recipe."""

    __tablename__ = "recipe_ingredients"

    recipe_id = Column(
        UUID(as_uuid=True), ForeignKey("recipes.id"), nullable=False, index=True
    )
    product_id = Column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False, index=True
    )
    quantity = Column(Numeric(12, 4), nullable=False)
    unit = Column(String(20), nullable=False)

    recipe = relationship("Recipe", back_populates="ingredients")
    product = relationship("Product", foreign_keys=[product_id])
