"""Unit tests for MenuService.

Tests cover:
- Menu item CRUD (create, get, list, update, toggle availability)
- Modifier groups and modifiers
- Recipe management and cost calculation
- Menu engineering matrix classification
- Item sales and profitability reports
"""

import os
import uuid
from decimal import Decimal
from unittest.mock import MagicMock, patch

os.environ.setdefault("SECRET_KEY", "test-secret-key")


from app.services.menu_service import MenuService


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

BIZ = str(uuid.uuid4())


def _make_service():
    db = MagicMock()
    return MenuService(db), db


def _mock_item(**kwargs):
    """Mock MenuItem."""
    item = MagicMock()
    item.id = kwargs.get("id", uuid.uuid4())
    item.business_id = kwargs.get("business_id", BIZ)
    item.display_name = kwargs.get("display_name", "Burger")
    item.price = kwargs.get("price", Decimal("120.00"))
    item.cost = kwargs.get("cost", Decimal("45.00"))
    item.is_available = kwargs.get("is_available", True)
    item.is_featured = kwargs.get("is_featured", False)
    item.course = kwargs.get("course", "main")
    item.category_id = kwargs.get("category_id", None)
    item.deleted_at = None
    return item


def _mock_recipe(**kwargs):
    """Mock Recipe."""
    recipe = MagicMock()
    recipe.id = kwargs.get("id", uuid.uuid4())
    recipe.business_id = BIZ
    recipe.name = kwargs.get("name", "Classic Burger")
    recipe.yield_quantity = kwargs.get("yield_quantity", Decimal("1"))
    recipe.deleted_at = None
    return recipe


def _mock_ingredient(**kwargs):
    """Mock RecipeIngredient with product."""
    ing = MagicMock()
    ing.id = uuid.uuid4()
    ing.quantity = kwargs.get("quantity", Decimal("0.2"))
    ing.waste_factor = kwargs.get("waste_factor", Decimal("0"))
    product = MagicMock()
    product.cost_price = kwargs.get("cost_price", Decimal("50.00"))
    ing.product = product
    return ing


# ══════════════════════════════════════════════════════════════════════════════
# Menu Item Tests
# ══════════════════════════════════════════════════════════════════════════════

class TestMenuItems:
    """Test menu item CRUD."""

    def test_create_item(self):
        """create_item persists and returns the item."""
        svc, db = _make_service()
        svc.create_item(BIZ, product_id=str(uuid.uuid4()), display_name="Burger", price=Decimal("120"))
        db.add.assert_called_once()
        db.commit.assert_called_once()

    def test_get_item(self):
        """get_item filters by id + business_id + not deleted."""
        svc, db = _make_service()
        item = _mock_item()
        db.query.return_value.filter.return_value.first.return_value = item
        result = svc.get_item(str(item.id), BIZ)
        assert result == item

    def test_get_item_not_found(self):
        """get_item returns None for non-existent item."""
        svc, db = _make_service()
        db.query.return_value.filter.return_value.first.return_value = None
        assert svc.get_item("no-id", BIZ) is None

    def test_toggle_availability(self):
        """toggle_availability flips is_available."""
        svc, db = _make_service()
        item = _mock_item(is_available=True)
        db.query.return_value.filter.return_value.first.return_value = item
        svc.toggle_availability(str(item.id), BIZ)
        assert item.is_available is False
        db.commit.assert_called()


# ══════════════════════════════════════════════════════════════════════════════
# Recipe Tests
# ══════════════════════════════════════════════════════════════════════════════

class TestRecipes:
    """Test recipe management and cost calculation."""

    def test_create_recipe(self):
        """create_recipe persists a Recipe row."""
        svc, db = _make_service()
        svc.create_recipe(BIZ, name="Classic Burger", menu_item_id=str(uuid.uuid4()))
        db.add.assert_called_once()
        db.commit.assert_called_once()

    def test_calculate_recipe_cost(self):
        """Cost = sum(ingredient qty × product.cost_price)."""
        svc, db = _make_service()
        recipe = _mock_recipe()

        ing1 = MagicMock()
        ing1.product_id = uuid.uuid4()
        ing1.quantity = Decimal("0.5")
        ing1.deleted_at = None

        product1 = MagicMock()
        product1.cost_price = Decimal("100")

        # Use side_effect on db.query to differentiate models
        from app.models.menu import Recipe, RecipeIngredient
        from app.models.product import Product

        def query_router(model):
            chain = MagicMock()
            if model is Recipe:
                chain.filter.return_value.first.return_value = recipe
            elif model is RecipeIngredient:
                chain.filter.return_value.all.return_value = [ing1]
            elif model is Product:
                chain.filter.return_value.first.return_value = product1
            return chain

        db.query.side_effect = query_router

        cost = svc.calculate_recipe_cost(str(recipe.id), BIZ)
        # 0.5 * 100 = 50
        assert cost == Decimal("50")

    def test_get_recipe_food_cost_pct(self):
        """Food cost % = (recipe cost / selling price) × 100."""
        svc, db = _make_service()
        recipe = _mock_recipe()
        recipe.menu_item_id = uuid.uuid4()

        from app.models.menu import MenuItem

        def query_router(model):
            chain = MagicMock()
            if model is MenuItem:
                item = _mock_item(price=Decimal("100"))
                chain.filter.return_value.first.return_value = item
            else:
                chain.filter.return_value.first.return_value = recipe
            return chain

        db.query.side_effect = query_router

        with patch.object(svc, "get_recipe", return_value=recipe):
            with patch.object(svc, "calculate_recipe_cost", return_value=Decimal("30")):
                result = svc.get_recipe_food_cost_pct(str(recipe.id), BIZ)

        assert result["food_cost_pct"] == 30.0


# ══════════════════════════════════════════════════════════════════════════════
# Engineering Matrix
# ══════════════════════════════════════════════════════════════════════════════

class TestEngineeringMatrix:
    """Test menu engineering matrix classification."""

    def test_empty_menu_returns_empty(self):
        """No items returns empty list."""
        svc, db = _make_service()
        db.query.return_value.filter.return_value.all.return_value = []
        assert svc.get_menu_engineering_matrix(BIZ) == []

    def test_classification_labels(self):
        """Each item gets Star/Puzzle/Plowhorse/Dog classification."""
        svc, db = _make_service()
        items = [
            _mock_item(price=Decimal("150"), cost=Decimal("40"), is_featured=True),
            _mock_item(price=Decimal("80"), cost=Decimal("70"), is_featured=False),
        ]
        db.query.return_value.filter.return_value.all.return_value = items
        result = svc.get_menu_engineering_matrix(BIZ)
        assert len(result) == 2
        classifications = {r["classification"] for r in result}
        assert classifications.issubset({"Star", "Puzzle", "Plowhorse", "Dog"})


# ══════════════════════════════════════════════════════════════════════════════
# Menu Reports
# ══════════════════════════════════════════════════════════════════════════════

class TestMenuReports:
    """Test report aggregation methods."""

    def test_item_sales_report_structure(self):
        """Item sales report returns correct fields."""
        svc, db = _make_service()
        row = MagicMock()
        row.product_id = uuid.uuid4()
        row.name = "Burger"
        row.total_qty = 42
        row.total_revenue = Decimal("5040.00")
        row.order_count = 35

        db.query.return_value.join.return_value.filter.return_value.group_by.return_value.order_by.return_value.all.return_value = [row]

        result = svc.get_item_sales_report(BIZ, days=30)
        assert len(result) == 1
        assert result[0]["name"] == "Burger"
        assert result[0]["total_qty"] == 42
        assert result[0]["total_revenue"] == 5040.0
        assert result[0]["avg_price"] == 120.0

    def test_item_sales_empty(self):
        """Empty orders returns empty list."""
        svc, db = _make_service()
        db.query.return_value.join.return_value.filter.return_value.group_by.return_value.order_by.return_value.all.return_value = []
        assert svc.get_item_sales_report(BIZ) == []

    def test_profitability_report_calculates_margin(self):
        """Profitability report calculates profit and margin %."""
        svc, db = _make_service()

        # Sales data
        sale = MagicMock()
        sale.product_id = uuid.uuid4()
        sale.name = "Pizza"
        sale.qty = 20
        sale.revenue = Decimal("3000.00")

        # Menu items for cost lookup
        menu_item = _mock_item(cost=Decimal("60"))
        menu_item.product_id = sale.product_id

        # Configure mocks: first call = sales query, second = menu items query
        db.query.return_value.join.return_value.filter.return_value.group_by.return_value.all.return_value = [sale]
        db.query.return_value.filter.return_value.all.return_value = [menu_item]

        result = svc.get_profitability_report(BIZ)
        assert len(result) == 1
        assert result[0]["qty_sold"] == 20
        assert result[0]["revenue"] == 3000.0

    def test_modifier_popularity_report(self):
        """Modifier report lists groups with their modifiers."""
        svc, db = _make_service()

        group = MagicMock()
        group.id = uuid.uuid4()
        group.name = "Toppings"
        group.min_selections = 0
        group.max_selections = 3

        modifier = MagicMock()
        modifier.id = uuid.uuid4()
        modifier.name = "Extra Cheese"
        modifier.price_adjustment = Decimal("15.00")
        modifier.is_available = True

        from app.models.menu import ModifierGroup, Modifier

        def query_router(model):
            chain = MagicMock()
            if model is ModifierGroup:
                chain.filter.return_value.all.return_value = [group]
            elif model is Modifier:
                chain.filter.return_value.all.return_value = [modifier]
            return chain

        db.query.side_effect = query_router

        result = svc.get_modifier_popularity_report(BIZ)
        assert len(result) == 1
        assert result[0]["group_name"] == "Toppings"
        assert result[0]["modifier_count"] == 1
        assert result[0]["modifiers"][0]["name"] == "Extra Cheese"
