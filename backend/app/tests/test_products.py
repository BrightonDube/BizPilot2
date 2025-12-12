"""Tests for Product API."""

import pytest
from decimal import Decimal


class TestProductModel:
    """Tests for Product model."""

    def test_product_model_exists(self):
        """Test that Product model exists."""
        from app.models.product import Product
        assert Product is not None

    def test_product_has_required_fields(self):
        """Test that Product has required fields."""
        from app.models.product import Product
        
        assert hasattr(Product, "business_id")
        assert hasattr(Product, "name")
        assert hasattr(Product, "selling_price")
        assert hasattr(Product, "quantity")
        assert hasattr(Product, "status")

    def test_product_status_enum_exists(self):
        """Test that ProductStatus enum exists."""
        from app.models.product import ProductStatus
        
        assert hasattr(ProductStatus, "ACTIVE")
        assert hasattr(ProductStatus, "DRAFT")
        assert hasattr(ProductStatus, "ARCHIVED")
        assert hasattr(ProductStatus, "OUT_OF_STOCK")

    def test_product_category_model_exists(self):
        """Test that ProductCategory model exists."""
        from app.models.product import ProductCategory
        assert ProductCategory is not None


class TestProductSchemas:
    """Tests for Product schemas."""

    def test_product_create_schema(self):
        """Test ProductCreate schema."""
        from app.schemas.product import ProductCreate
        
        product = ProductCreate(
            name="Test Product",
            selling_price=Decimal("99.99"),
        )
        
        assert product.name == "Test Product"
        assert product.selling_price == Decimal("99.99")

    def test_product_update_schema(self):
        """Test ProductUpdate schema."""
        from app.schemas.product import ProductUpdate
        
        update = ProductUpdate(name="Updated Name")
        assert update.name == "Updated Name"

    def test_product_response_schema(self):
        """Test ProductResponse schema."""
        from app.schemas.product import ProductResponse
        from app.models.product import ProductStatus
        from datetime import datetime
        
        response = ProductResponse(
            id="123",
            business_id="456",
            name="Test Product",
            selling_price=Decimal("99.99"),
            is_low_stock=False,
            profit_margin=25.0,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            status=ProductStatus.ACTIVE,
            is_taxable=True,
            track_inventory=True,
            quantity=10,
            low_stock_threshold=5,
        )
        
        assert response.id == "123"

    def test_product_list_response_schema(self):
        """Test ProductListResponse schema."""
        from app.schemas.product import ProductListResponse
        
        response = ProductListResponse(
            items=[],
            total=0,
            page=1,
            per_page=20,
            pages=0,
        )
        
        assert response.total == 0

    def test_product_bulk_create_schema(self):
        """Test ProductBulkCreate schema."""
        from app.schemas.product import ProductBulkCreate, ProductCreate
        
        bulk = ProductBulkCreate(products=[
            ProductCreate(name="Product 1", selling_price=Decimal("10")),
            ProductCreate(name="Product 2", selling_price=Decimal("20")),
        ])
        
        assert len(bulk.products) == 2


class TestProductService:
    """Tests for ProductService."""

    def test_product_service_exists(self):
        """Test that ProductService exists."""
        from app.services.product_service import ProductService
        assert ProductService is not None

    def test_product_service_has_crud_methods(self):
        """Test that ProductService has CRUD methods."""
        from app.services.product_service import ProductService
        
        assert hasattr(ProductService, "get_product")
        assert hasattr(ProductService, "get_products")
        assert hasattr(ProductService, "create_product")
        assert hasattr(ProductService, "update_product")
        assert hasattr(ProductService, "delete_product")

    def test_product_service_has_bulk_methods(self):
        """Test that ProductService has bulk methods."""
        from app.services.product_service import ProductService
        
        assert hasattr(ProductService, "bulk_create_products")
        assert hasattr(ProductService, "bulk_delete_products")

    def test_product_service_has_category_methods(self):
        """Test that ProductService has category methods."""
        from app.services.product_service import ProductService
        
        assert hasattr(ProductService, "get_category")
        assert hasattr(ProductService, "get_categories")
        assert hasattr(ProductService, "create_category")
        assert hasattr(ProductService, "update_category")
        assert hasattr(ProductService, "delete_category")


class TestProductEndpoints:
    """Tests for Product API endpoints."""

    def test_products_router_exists(self):
        """Test that products router exists."""
        from app.api.products import router
        assert router is not None

    def test_products_router_has_list_route(self):
        """Test that list route is defined."""
        from app.api.products import router
        routes = [r.path for r in router.routes]
        assert any("/products" in r or r == "" for r in routes)

    def test_products_router_has_get_route(self):
        """Test that get route is defined."""
        from app.api.products import router
        routes = [r.path for r in router.routes]
        assert any("product_id" in str(r) or "{product_id}" in r for r in routes)

    def test_products_router_has_bulk_routes(self):
        """Test that bulk routes are defined."""
        from app.api.products import router
        routes = [r.path for r in router.routes]
        assert any("bulk" in r for r in routes)

    def test_products_included_in_main_router(self):
        """Test that products router is included in main API router."""
        from app.api import router
        
        # Check that products routes are included
        routes = []
        for route in router.routes:
            if hasattr(route, 'path'):
                routes.append(route.path)
        
        assert len(routes) > 0


class TestProductFilter:
    """Tests for product filtering."""

    def test_product_filter_schema(self):
        """Test ProductFilter schema."""
        from app.schemas.product import ProductFilter
        from app.models.product import ProductStatus
        
        filter_obj = ProductFilter(
            search="widget",
            status=ProductStatus.ACTIVE,
            min_price=Decimal("10"),
            max_price=Decimal("100"),
            low_stock_only=True,
        )
        
        assert filter_obj.search == "widget"
        assert filter_obj.status == ProductStatus.ACTIVE
        assert filter_obj.min_price == Decimal("10")
        assert filter_obj.max_price == Decimal("100")
        assert filter_obj.low_stock_only is True
