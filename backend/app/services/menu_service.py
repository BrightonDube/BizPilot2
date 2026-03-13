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

    def list_recipes(self, business_id: str) -> List[Recipe]:
        """List all recipes for a business."""
        return (
            self.db.query(Recipe)
            .filter(Recipe.business_id == business_id, Recipe.deleted_at.is_(None))
            .order_by(Recipe.name)
            .all()
        )

    def get_recipe(self, recipe_id: str, business_id: str) -> Recipe:
        """Get a single recipe by ID."""
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
        return recipe

    def update_recipe(
        self,
        recipe_id: str,
        business_id: str,
        name: Optional[str] = None,
        yield_quantity: Optional[Decimal] = None,
        instructions: Optional[str] = None,
    ) -> Recipe:
        """Update a recipe."""
        recipe = self.get_recipe(recipe_id, business_id)
        if name is not None:
            recipe.name = name
        if yield_quantity is not None:
            recipe.yield_quantity = yield_quantity
        if instructions is not None:
            recipe.instructions = instructions
        self.db.commit()
        self.db.refresh(recipe)
        return recipe

    def delete_recipe(self, recipe_id: str, business_id: str) -> None:
        """Soft-delete a recipe."""
        from datetime import datetime, timezone
        recipe = self.get_recipe(recipe_id, business_id)
        recipe.deleted_at = datetime.now(timezone.utc)
        self.db.commit()

    def get_recipe_food_cost_pct(
        self, recipe_id: str, business_id: str
    ) -> Dict[str, Any]:
        """Calculate food cost percentage for a recipe.

        Food cost % = (recipe cost / selling price) * 100
        """
        recipe = self.get_recipe(recipe_id, business_id)
        total_cost = self.calculate_recipe_cost(recipe_id, business_id)

        selling_price = Decimal("0")
        if recipe.menu_item_id:
            item = (
                self.db.query(MenuItem)
                .filter(MenuItem.id == recipe.menu_item_id)
                .first()
            )
            if item and item.price:
                selling_price = item.price

        food_cost_pct = (
            (total_cost / selling_price * 100) if selling_price > 0 else Decimal("0")
        )
        cost_per_portion = (
            (total_cost / recipe.yield_quantity)
            if recipe.yield_quantity and recipe.yield_quantity > 0
            else total_cost
        )

        return {
            "recipe_id": str(recipe.id),
            "name": recipe.name,
            "total_cost": float(total_cost),
            "selling_price": float(selling_price),
            "food_cost_pct": round(float(food_cost_pct), 2),
            "cost_per_portion": round(float(cost_per_portion), 2),
            "yield_quantity": float(recipe.yield_quantity or 1),
        }

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

    # ── Menu Reports ─────────────────────────────────────────────

    def get_item_sales_report(
        self, business_id: str, days: int = 30
    ) -> List[Dict[str, Any]]:
        """Aggregate sales per menu item over a rolling period.

        Joins order_items → products → menu_items to produce
        quantity sold, revenue, and average price per item.
        """
        from datetime import datetime, timedelta, timezone
        from sqlalchemy import func
        from app.models.order import OrderItem, Order

        cutoff = datetime.now(timezone.utc) - timedelta(days=days)

        rows = (
            self.db.query(
                OrderItem.product_id,
                OrderItem.name,
                func.sum(OrderItem.quantity).label("total_qty"),
                func.sum(OrderItem.total).label("total_revenue"),
                func.count(OrderItem.id).label("order_count"),
            )
            .join(Order, OrderItem.order_id == Order.id)
            .filter(
                Order.business_id == business_id,
                Order.created_at >= cutoff,
                Order.deleted_at.is_(None),
            )
            .group_by(OrderItem.product_id, OrderItem.name)
            .order_by(func.sum(OrderItem.total).desc())
            .all()
        )

        return [
            {
                "product_id": str(r.product_id) if r.product_id else None,
                "name": r.name,
                "total_qty": int(r.total_qty or 0),
                "total_revenue": float(r.total_revenue or 0),
                "order_count": int(r.order_count or 0),
                "avg_price": round(float(r.total_revenue or 0) / max(int(r.total_qty or 1), 1), 2),
            }
            for r in rows
        ]

    def get_profitability_report(
        self, business_id: str, days: int = 30
    ) -> List[Dict[str, Any]]:
        """Per-item profitability combining sales revenue and cost data.

        Matches menu items to their cost (from MenuItem.cost or recipe cost)
        and calculates profit = revenue - (cost × qty sold).
        """
        from datetime import datetime, timedelta, timezone
        from sqlalchemy import func
        from app.models.order import OrderItem, Order

        cutoff = datetime.now(timezone.utc) - timedelta(days=days)

        # Sales aggregation
        sales = (
            self.db.query(
                OrderItem.product_id,
                OrderItem.name,
                func.sum(OrderItem.quantity).label("qty"),
                func.sum(OrderItem.total).label("revenue"),
            )
            .join(Order, OrderItem.order_id == Order.id)
            .filter(
                Order.business_id == business_id,
                Order.created_at >= cutoff,
                Order.deleted_at.is_(None),
            )
            .group_by(OrderItem.product_id, OrderItem.name)
            .all()
        )

        # Build cost lookup from menu items
        items = (
            self.db.query(MenuItem)
            .filter(
                MenuItem.business_id == business_id,
                MenuItem.deleted_at.is_(None),
            )
            .all()
        )
        cost_map: Dict[str, float] = {}
        for it in items:
            # MenuItem may reference a product_id via its relationship
            pid = str(it.product_id) if hasattr(it, "product_id") and it.product_id else str(it.id)
            cost_map[pid] = float(it.cost or 0)

        results = []
        for row in sales:
            pid = str(row.product_id) if row.product_id else ""
            unit_cost = cost_map.get(pid, 0)
            qty = int(row.qty or 0)
            revenue = float(row.revenue or 0)
            total_cost = unit_cost * qty
            profit = revenue - total_cost
            margin = (profit / revenue * 100) if revenue > 0 else 0

            results.append({
                "product_id": pid,
                "name": row.name,
                "qty_sold": qty,
                "revenue": round(revenue, 2),
                "total_cost": round(total_cost, 2),
                "profit": round(profit, 2),
                "margin_pct": round(margin, 1),
            })

        results.sort(key=lambda x: x["profit"], reverse=True)
        return results

    def get_modifier_popularity_report(
        self, business_id: str
    ) -> List[Dict[str, Any]]:
        """Rank modifier groups and individual modifiers by usage.

        Since order_items don't track applied modifiers directly,
        this returns modifier configuration data: groups, modifiers,
        min/max rules, and price adjustments — useful for menu planning.
        """
        groups = (
            self.db.query(ModifierGroup)
            .filter(
                ModifierGroup.business_id == business_id,
                ModifierGroup.deleted_at.is_(None),
            )
            .all()
        )

        results = []
        for g in groups:
            modifiers = (
                self.db.query(Modifier)
                .filter(
                    Modifier.group_id == g.id,
                    Modifier.deleted_at.is_(None),
                )
                .all()
            )
            results.append({
                "group_id": str(g.id),
                "group_name": g.name,
                "min_selections": g.min_selections,
                "max_selections": g.max_selections,
                "modifier_count": len(modifiers),
                "modifiers": [
                    {
                        "id": str(m.id),
                        "name": m.name,
                        "price_adjustment": float(m.price_adjustment or 0),
                        "is_available": m.is_available,
                    }
                    for m in modifiers
                ],
            })

        results.sort(key=lambda x: x["modifier_count"], reverse=True)
        return results
