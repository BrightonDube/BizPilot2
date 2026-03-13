"""Unit tests for ProductService.

Tests cover:
- Product CRUD (get, list, create, update, delete)
- Filtering and pagination
- Ingredients (list, add, delete)
- Bulk operations (create, delete)
- Inventory updates and auto-status
- Category CRUD (get, list, create, update, delete)
"""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

import uuid
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from app.models.product import Product, ProductCategory, ProductStatus
from app.models.product_ingredient import ProductIngredient
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductCategoryCreate,
    ProductCategoryUpdate,
    ProductIngredientCreate,
)
from app.services.product_service import ProductService


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

BIZ = str(uuid.uuid4())


def _svc():
    db = MagicMock()
    return ProductService(db), db


def _chain(first=None, rows=None, count=0):
    """Return a chainable mock that mimics a SQLAlchemy query."""
    c = MagicMock()
    c.filter.return_value = c
    c.join.return_value = c
    c.order_by.return_value = c
    c.offset.return_value = c
    c.limit.return_value = c
    c.all.return_value = rows if rows is not None else []
    c.first.return_value = first
    c.count.return_value = count
    c.scalar.return_value = None
    c.update.return_value = count
    return c


def _mock_product(**kwargs):
    """Create a mock Product."""
    p = MagicMock(spec=Product)
    p.id = kwargs.get("id", uuid.uuid4())
    p.business_id = kwargs.get("business_id", BIZ)
    p.name = kwargs.get("name", "Test Product")
    p.selling_price = kwargs.get("selling_price", Decimal("100.00"))
    p.cost_price = kwargs.get("cost_price", Decimal("50.00"))
    p.quantity = kwargs.get("quantity", 10)
    p.track_inventory = kwargs.get("track_inventory", True)
    p.low_stock_threshold = kwargs.get("low_stock_threshold", 5)
    p.status = kwargs.get("status", ProductStatus.ACTIVE)
    p.category_id = kwargs.get("category_id", None)
    p.deleted_at = kwargs.get("deleted_at", None)
    p.ingredients = kwargs.get("ingredients", [])
    return p


def _mock_category(**kwargs):
    """Create a mock ProductCategory."""
    c = MagicMock(spec=ProductCategory)
    c.id = kwargs.get("id", uuid.uuid4())
    c.business_id = kwargs.get("business_id", BIZ)
    c.name = kwargs.get("name", "Test Category")
    c.sort_order = kwargs.get("sort_order", 0)
    return c


def _mock_ingredient(**kwargs):
    """Create a mock ProductIngredient."""
    ing = MagicMock(spec=ProductIngredient)
    ing.id = kwargs.get("id", uuid.uuid4())
    ing.product_id = kwargs.get("product_id", uuid.uuid4())
    ing.business_id = kwargs.get("business_id", BIZ)
    ing.name = kwargs.get("name", "Flour")
    ing.unit = kwargs.get("unit", "kg")
    ing.quantity = kwargs.get("quantity", Decimal("1"))
    ing.cost = kwargs.get("cost", Decimal("10.00"))
    ing.sort_order = kwargs.get("sort_order", 0)
    ing.deleted_at = None
    return ing


# ══════════════════════════════════════════════════════════════════════════════
# Product CRUD
# ══════════════════════════════════════════════════════════════════════════════


class TestGetProduct:
    def test_get_product_found(self):
        svc, db = _svc()
        product = _mock_product()
        chain = _chain(first=product)
        db.query.return_value = chain

        result = svc.get_product(str(product.id), BIZ)

        assert result is product
        db.query.assert_called_once_with(Product)

    def test_get_product_not_found(self):
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        result = svc.get_product(str(uuid.uuid4()), BIZ)

        assert result is None


class TestGetProducts:
    def test_basic_pagination(self):
        svc, db = _svc()
        rows = [_mock_product(), _mock_product()]
        chain = _chain(rows=rows, count=2)
        db.query.return_value = chain

        products, total = svc.get_products(BIZ, page=1, per_page=20)

        assert products == rows
        assert total == 2
        chain.offset.assert_called_once_with(0)
        chain.limit.assert_called_once_with(20)

    def test_pagination_page_two(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=25)
        db.query.return_value = chain

        _, total = svc.get_products(BIZ, page=2, per_page=10)

        assert total == 25
        chain.offset.assert_called_once_with(10)
        chain.limit.assert_called_once_with(10)

    def test_search_filter(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.get_products(BIZ, search="burger")

        # search triggers an additional .filter() call (base + search)
        assert chain.filter.call_count >= 2

    def test_category_filter(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        cat_id = str(uuid.uuid4())

        svc.get_products(BIZ, category_id=cat_id)

        assert chain.filter.call_count >= 2

    def test_status_filter(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.get_products(BIZ, status=ProductStatus.ACTIVE)

        assert chain.filter.call_count >= 2

    def test_price_range_filter(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.get_products(BIZ, min_price=Decimal("10"), max_price=Decimal("100"))

        # base filter + min_price + max_price
        assert chain.filter.call_count >= 3

    def test_low_stock_filter(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.get_products(BIZ, low_stock_only=True)

        assert chain.filter.call_count >= 2

    def test_empty_results(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        products, total = svc.get_products(BIZ)

        assert products == []
        assert total == 0


class TestCreateProduct:
    def test_create_product_basic(self):
        svc, db = _svc()
        data = ProductCreate(
            name="New Product",
            selling_price=Decimal("99.99"),
            track_inventory=False,
        )

        svc.create_product(BIZ, data)

        db.add.assert_called()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    def test_create_product_auto_inventory(self):
        """When track_inventory=True, an InventoryItem should be created."""
        svc, db = _svc()
        data = ProductCreate(
            name="Tracked Product",
            selling_price=Decimal("50.00"),
            cost_price=Decimal("25.00"),
            track_inventory=True,
            quantity=20,
            low_stock_threshold=5,
        )

        svc.create_product(BIZ, data)

        # Product + InventoryItem = at least 2 db.add calls
        assert db.add.call_count >= 2
        added_types = [type(c.args[0]).__name__ for c in db.add.call_args_list]
        assert "Product" in added_types
        assert "InventoryItem" in added_types

    def test_create_product_no_inventory_when_not_tracked(self):
        svc, db = _svc()
        data = ProductCreate(
            name="Untracked",
            selling_price=Decimal("10.00"),
            track_inventory=False,
        )

        svc.create_product(BIZ, data)

        added_types = [type(c.args[0]).__name__ for c in db.add.call_args_list]
        assert "InventoryItem" not in added_types

    def test_create_product_with_ingredients(self):
        """Creating a product with ingredients calls replace_product_ingredients."""
        svc, db = _svc()
        # Mock the replace call to avoid complex DB interactions
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        ing = ProductIngredientCreate(
            name="Sugar",
            unit="kg",
            quantity=Decimal("2"),
            cost=Decimal("5.00"),
        )
        data = ProductCreate(
            name="Sweet Product",
            selling_price=Decimal("30.00"),
            track_inventory=False,
            ingredients=[ing],
        )

        svc.create_product(BIZ, data)

        # Product added + ingredients added via replace
        assert db.add.call_count >= 2
        db.commit.assert_called_once()


class TestUpdateProduct:
    def test_update_product_basic(self):
        svc, db = _svc()
        product = _mock_product()
        data = ProductUpdate(name="Updated Name")

        svc.update_product(product, data)

        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(product)

    def test_update_product_with_ingredients(self):
        svc, db = _svc()
        product = _mock_product()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        ing = ProductIngredientCreate(
            name="Milk",
            unit="L",
            quantity=Decimal("1"),
            cost=Decimal("15.00"),
        )
        data = ProductUpdate(ingredients=[ing])

        svc.update_product(product, data)

        db.commit.assert_called_once()
        # replace_product_ingredients queries existing + adds new
        assert db.add.call_count >= 1


class TestDeleteProduct:
    def test_delete_product_soft(self):
        svc, db = _svc()
        product = _mock_product()

        result = svc.delete_product(product)

        assert result is True
        product.soft_delete.assert_called_once()
        db.commit.assert_called_once()


# ══════════════════════════════════════════════════════════════════════════════
# Ingredients
# ══════════════════════════════════════════════════════════════════════════════


class TestListProductIngredients:
    def test_list_ingredients_ordered(self):
        svc, db = _svc()
        ings = [_mock_ingredient(sort_order=0), _mock_ingredient(sort_order=1)]
        chain = _chain(rows=ings)
        db.query.return_value = chain

        result = svc.list_product_ingredients(str(uuid.uuid4()), BIZ)

        assert result == ings
        db.query.assert_called_once_with(ProductIngredient)
        chain.order_by.assert_called_once()


class TestAddProductIngredient:
    def test_add_ingredient(self):
        svc, db = _svc()
        data = ProductIngredientCreate(
            name="Butter",
            unit="g",
            quantity=Decimal("100"),
            cost=Decimal("8.00"),
        )
        product_id = str(uuid.uuid4())

        svc.add_product_ingredient(product_id, BIZ, data)

        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        added = db.add.call_args[0][0]
        assert isinstance(added, ProductIngredient)
        assert added.name == "Butter"


class TestDeleteProductIngredient:
    def test_delete_ingredient_soft(self):
        svc, db = _svc()
        ingredient = _mock_ingredient()

        svc.delete_product_ingredient(ingredient)

        ingredient.soft_delete.assert_called_once()
        db.commit.assert_called_once()


# ══════════════════════════════════════════════════════════════════════════════
# Bulk Operations
# ══════════════════════════════════════════════════════════════════════════════


class TestBulkCreateProducts:
    def test_bulk_create(self):
        svc, db = _svc()
        items = [
            ProductCreate(name="P1", selling_price=Decimal("10"), track_inventory=False),
            ProductCreate(name="P2", selling_price=Decimal("20"), track_inventory=False),
        ]

        result = svc.bulk_create_products(BIZ, items)

        assert len(result) == 2
        assert db.add.call_count == 2
        db.commit.assert_called_once()
        assert db.refresh.call_count == 2


class TestBulkDeleteProducts:
    def test_bulk_delete_success(self):
        svc, db = _svc()
        ids = [str(uuid.uuid4()) for _ in range(3)]
        chain = _chain(count=3)
        db.query.return_value = chain

        result = svc.bulk_delete_products(BIZ, ids)

        assert result == 3
        db.commit.assert_called_once()

    def test_bulk_delete_exceeds_max(self):
        svc, db = _svc()
        ids = [str(uuid.uuid4()) for _ in range(5)]

        with pytest.raises(ValueError, match="Cannot delete more than 3"):
            svc.bulk_delete_products(BIZ, ids, max_ids=3)

    def test_bulk_delete_default_max(self):
        svc, db = _svc()
        ids = [str(uuid.uuid4()) for _ in range(101)]

        with pytest.raises(ValueError, match="Cannot delete more than 100"):
            svc.bulk_delete_products(BIZ, ids)


# ══════════════════════════════════════════════════════════════════════════════
# Inventory
# ══════════════════════════════════════════════════════════════════════════════


class TestUpdateInventory:
    def test_increase_quantity(self):
        svc, db = _svc()
        product = _mock_product(quantity=10, track_inventory=True, status=ProductStatus.ACTIVE)

        svc.update_inventory(product, 5)

        assert product.quantity == 15
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(product)

    def test_decrease_quantity_floor_zero(self):
        svc, db = _svc()
        product = _mock_product(quantity=3, track_inventory=True, status=ProductStatus.ACTIVE)

        svc.update_inventory(product, -10)

        assert product.quantity == 0

    def test_auto_out_of_stock(self):
        svc, db = _svc()
        product = _mock_product(quantity=5, track_inventory=True, status=ProductStatus.ACTIVE)

        svc.update_inventory(product, -5)

        assert product.quantity == 0
        assert product.status == ProductStatus.OUT_OF_STOCK

    def test_auto_reactivate_from_out_of_stock(self):
        svc, db = _svc()
        product = _mock_product(quantity=0, track_inventory=True, status=ProductStatus.OUT_OF_STOCK)

        svc.update_inventory(product, 10)

        assert product.quantity == 10
        assert product.status == ProductStatus.ACTIVE

    def test_no_auto_status_when_not_tracking(self):
        """Products not tracking inventory don't auto-change to OUT_OF_STOCK."""
        svc, db = _svc()
        product = _mock_product(quantity=5, track_inventory=False, status=ProductStatus.ACTIVE)

        svc.update_inventory(product, -5)

        assert product.quantity == 0
        # Status stays ACTIVE because track_inventory is False
        assert product.status == ProductStatus.ACTIVE


# ══════════════════════════════════════════════════════════════════════════════
# Category CRUD
# ══════════════════════════════════════════════════════════════════════════════


class TestGetCategory:
    def test_get_category_found(self):
        svc, db = _svc()
        cat = _mock_category()
        chain = _chain(first=cat)
        db.query.return_value = chain

        result = svc.get_category(str(cat.id), BIZ)

        assert result is cat
        db.query.assert_called_once_with(ProductCategory)

    def test_get_category_not_found(self):
        svc, db = _svc()
        chain = _chain(first=None)
        db.query.return_value = chain

        result = svc.get_category(str(uuid.uuid4()), BIZ)

        assert result is None


class TestGetCategories:
    def test_list_categories(self):
        svc, db = _svc()
        cats = [_mock_category(name="A"), _mock_category(name="B")]
        chain = _chain(rows=cats)
        db.query.return_value = chain

        result = svc.get_categories(BIZ)

        assert result == cats
        chain.order_by.assert_called_once()

    def test_list_categories_with_parent(self):
        svc, db = _svc()
        chain = _chain(rows=[])
        db.query.return_value = chain
        parent_id = str(uuid.uuid4())

        svc.get_categories(BIZ, parent_id=parent_id)

        # base filter + parent_id filter
        assert chain.filter.call_count >= 2


class TestCreateCategory:
    def test_create_category(self):
        svc, db = _svc()
        data = ProductCategoryCreate(name="Beverages")

        svc.create_category(BIZ, data)

        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        added = db.add.call_args[0][0]
        assert isinstance(added, ProductCategory)
        assert added.name == "Beverages"


class TestUpdateCategory:
    def test_update_category(self):
        svc, db = _svc()
        cat = _mock_category(name="Old Name")
        data = ProductCategoryUpdate(name="New Name")

        svc.update_category(cat, data)

        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(cat)


class TestDeleteCategory:
    def test_delete_moves_products_to_uncategorized(self):
        """Deleting a category moves its products to uncategorized first."""
        svc, db = _svc()
        cat = _mock_category()

        # Two db.query calls: one for Product.update, one implicit via delete
        product_chain = _chain()
        call_count = 0

        def query_side_effect(model):
            nonlocal call_count
            call_count += 1
            return product_chain

        db.query.side_effect = query_side_effect

        result = svc.delete_category(cat)

        assert result is True
        db.delete.assert_called_once_with(cat)
        db.commit.assert_called_once()
        # Products should be moved to uncategorized (update called on chain)
        product_chain.update.assert_called_once()
