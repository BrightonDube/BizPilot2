"""Menu engineering service."""

from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.menu import (
    MenuItem,
    MenuItemModifierGroup,
    Modifier,
    ModifierGroup,
    Recipe,
    RecipeIngredient,
)
from app.models.product import Product


class MenuService:
    """Service for menu engineering operations."""

    def __init__(self, db: Session):
        self.db = db

    # ── Menu Items ───────────────────────────────────────────────

    def create_item(
        self,
        business_id: str,
        product_id: str,
        display_name: str,
        price: Decimal,
        **kwargs: Any,
    ) -> MenuItem:
        """Create a menu item."""
        item = MenuItem(
            business_id=business_id,
            product_id=product_id,
            display_name=display_name,
            price=price,
            **kwargs,
        )
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def get_item(self, item_id: str, business_id: str) -> Optional[MenuItem]:
        """Get a menu item by ID."""
        return (
            self.db.query(MenuItem)
            .filter(
                MenuItem.id == item_id,
                MenuItem.business_id == business_id,
                MenuItem.deleted_at.is_(None),
            )
            .first()
        )

    def list_items(
        self,
        business_id: str,
        category_id: Optional[str] = None,
        available_only: bool = True,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[MenuItem], int]:
        """List menu items with filtering and pagination."""
        query = self.db.query(MenuItem).filter(
            MenuItem.business_id == business_id,
            MenuItem.deleted_at.is_(None),
        )
        if category_id:
            query = query.filter(MenuItem.category_id == category_id)
        if available_only:
            query = query.filter(MenuItem.is_available.is_(True))

        total = query.count()
        items = (
            query.order_by(MenuItem.display_order.asc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def update_item(self, item_id: str, business_id: str, **kwargs: Any) -> Optional[MenuItem]:
        """Update a menu item."""
        item = self.get_item(item_id, business_id)
        if not item:
            return None
        for field, value in kwargs.items():
            if hasattr(item, field):
                setattr(item, field, value)
        self.db.commit()
        self.db.refresh(item)
        return item

    def toggle_availability(self, item_id: str, business_id: str) -> Optional[MenuItem]:
        """Toggle the availability of a menu item."""
        item = self.get_item(item_id, business_id)
        if not item:
            return None
        item.is_available = not item.is_available
        self.db.commit()
        self.db.refresh(item)
        return item

    # ── Modifier Groups / Modifiers ──────────────────────────────

    def create_modifier_group(
        self,
        business_id: str,
        name: str,
        min_selections: int = 0,
        max_selections: int = 1,
        is_required: bool = False,
    ) -> ModifierGroup:
        """Create a modifier group."""
        group = ModifierGroup(
            business_id=business_id,
            name=name,
            min_selections=min_selections,
            max_selections=max_selections,
            is_required=is_required,
        )
        self.db.add(group)
        self.db.commit()
        self.db.refresh(group)
        return group

    def add_modifier(
        self,
        group_id: str,
        business_id: str,
        name: str,
        price_adjustment: Decimal = Decimal("0"),
    ) -> Modifier:
        """Add a modifier to a group."""
        modifier = Modifier(
            group_id=group_id,
            business_id=business_id,
            name=name,
            price_adjustment=price_adjustment,
        )
        self.db.add(modifier)
        self.db.commit()
        self.db.refresh(modifier)
        return modifier

    def list_modifier_groups(self, business_id: str) -> List[ModifierGroup]:
        """List all modifier groups for a business."""
        return (
            self.db.query(ModifierGroup)
            .filter(
                ModifierGroup.business_id == business_id,
                ModifierGroup.deleted_at.is_(None),
            )
            .order_by(ModifierGroup.name.asc())
            .all()
        )

    def attach_modifier_group(
        self, item_id: str, group_id: str, business_id: str
    ) -> MenuItemModifierGroup:
        """Link a modifier group to a menu item."""
        # Verify both belong to the business
        item = self.get_item(item_id, business_id)
        if not item:
            raise ValueError("Menu item not found")

        group = (
            self.db.query(ModifierGroup)
            .filter(
                ModifierGroup.id == group_id,
                ModifierGroup.business_id == business_id,
                ModifierGroup.deleted_at.is_(None),
            )
            .first()
        )
        if not group:
            raise ValueError("Modifier group not found")

        link = MenuItemModifierGroup(
            menu_item_id=item_id,
            modifier_group_id=group_id,
        )
        self.db.add(link)
        self.db.commit()
        self.db.refresh(link)
        return link

    # ── Recipes ──────────────────────────────────────────────────

    def create_recipe(
        self,
        business_id: str,
        name: str,
        menu_item_id: Optional[str] = None,
        yield_quantity: Decimal = Decimal("1"),
        instructions: Optional[str] = None,
    ) -> Recipe:
        """Create a recipe."""
        recipe = Recipe(
            business_id=business_id,
            name=name,
            menu_item_id=menu_item_id,
            yield_quantity=yield_quantity,
            instructions=instructions,
        )
        self.db.add(recipe)
        self.db.commit()
        self.db.refresh(recipe)
        return recipe

    def add_ingredient(
        self,
        recipe_id: str,
        product_id: str,
        quantity: Decimal,
        unit: str,
        business_id: str,
    ) -> RecipeIngredient:
        """Add an ingredient to a recipe."""
        recipe = (
            self.db.query(Recipe)
            .filter(
                Recipe.id == recipe_id,
                Recipe.business_id == business_id,
                Recipe.deleted_at.is_(None),
            )
            .first()
        )
        if not recipe:
            raise ValueError("Recipe not found")

        ingredient = RecipeIngredient(
            recipe_id=recipe_id,
            product_id=product_id,
            quantity=quantity,
            unit=unit,
        )
        self.db.add(ingredient)
        self.db.commit()
        self.db.refresh(ingredient)
        return ingredient

    def calculate_recipe_cost(self, recipe_id: str, business_id: str) -> Decimal:
        """Sum ingredient costs for a recipe."""
        recipe = (
            self.db.query(Recipe)
            .filter(
                Recipe.id == recipe_id,
                Recipe.business_id == business_id,
                Recipe.deleted_at.is_(None),
            )
            .first()
        )
        if not recipe:
            raise ValueError("Recipe not found")

        ingredients = (
            self.db.query(RecipeIngredient)
            .filter(
                RecipeIngredient.recipe_id == recipe_id,
                RecipeIngredient.deleted_at.is_(None),
            )
            .all()
        )

        total = Decimal("0")
        for ing in ingredients:
            product = (
                self.db.query(Product)
                .filter(Product.id == ing.product_id)
                .first()
            )
            if product and product.cost_price:
                total += ing.quantity * product.cost_price
        return total

    # ── Menu Engineering Matrix ──────────────────────────────────

    def get_menu_engineering_matrix(
        self, business_id: str
    ) -> List[Dict[str, Any]]:
        """Return items classified by popularity and profitability.

        Classification (Boston matrix style):
        - Star:      high popularity, high profitability
        - Puzzle:    low popularity,  high profitability
        - Plowhorse: high popularity, low profitability
        - Dog:       low popularity,  low profitability
        """
        items = (
            self.db.query(MenuItem)
            .filter(
                MenuItem.business_id == business_id,
                MenuItem.deleted_at.is_(None),
            )
            .all()
        )
        if not items:
            return []

        # Build per-item profit margin
        records: List[Dict[str, Any]] = []
        for item in items:
            profit = (item.price or Decimal("0")) - (item.cost or Decimal("0"))
            records.append(
                {
                    "id": str(item.id),
                    "display_name": item.display_name,
                    "price": float(item.price or 0),
                    "cost": float(item.cost or 0),
                    "profit_margin": float(profit),
                    "is_available": item.is_available,
                    "is_featured": item.is_featured,
                    "course": item.course,
                    "category_id": str(item.category_id) if item.category_id else None,
                }
            )

        avg_profit = sum(r["profit_margin"] for r in records) / len(records)
        # Popularity proxy: featured / available items are "popular"
        avg_cost = sum(r["cost"] for r in records) / len(records)

        for r in records:
            high_profit = r["profit_margin"] >= avg_profit
            high_popularity = r["is_featured"] or r["cost"] >= avg_cost
            if high_profit and high_popularity:
                r["classification"] = "Star"
            elif high_profit and not high_popularity:
                r["classification"] = "Puzzle"
            elif not high_profit and high_popularity:
                r["classification"] = "Plowhorse"
            else:
                r["classification"] = "Dog"

        return records
