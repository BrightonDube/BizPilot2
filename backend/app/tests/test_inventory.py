"""Unit tests for Inventory API endpoints."""

from decimal import Decimal


class TestInventorySchemas:
    """Tests for inventory schema validation."""

    def test_transaction_type_enum(self):
        """Test TransactionType enum values."""
        from app.models.inventory import TransactionType
        
        assert TransactionType.ADJUSTMENT.value == "adjustment"
        assert TransactionType.PURCHASE.value == "purchase"
        assert TransactionType.SALE.value == "sale"
        assert TransactionType.TRANSFER.value == "transfer"
        assert TransactionType.RETURN.value == "return"
        assert TransactionType.WRITE_OFF.value == "write_off"
        assert TransactionType.COUNT.value == "count"

    def test_inventory_item_create_schema(self):
        """Test InventoryItemCreate schema."""
        from app.schemas.inventory import InventoryItemCreate
        
        data = InventoryItemCreate(
            product_id="test-product-id",
            quantity_on_hand=100,
            reorder_point=10,
            reorder_quantity=50,
            location="Warehouse A",
        )
        
        assert data.product_id == "test-product-id"
        assert data.quantity_on_hand == 100
        assert data.reorder_point == 10

    def test_inventory_adjustment_schema(self):
        """Test InventoryAdjustment schema."""
        from app.schemas.inventory import InventoryAdjustment
        
        data = InventoryAdjustment(
            quantity_change=10,
            reason="Stock count correction",
            notes="Found extra items in storage",
        )
        
        assert data.quantity_change == 10
        assert data.reason == "Stock count correction"

    def test_inventory_adjustment_negative(self):
        """Test negative adjustment."""
        from app.schemas.inventory import InventoryAdjustment
        
        data = InventoryAdjustment(
            quantity_change=-5,
            reason="Damaged items",
        )
        
        assert data.quantity_change == -5


class TestInventoryModel:
    """Tests for Inventory model."""

    def test_inventory_item_quantity_available(self):
        """Test quantity_available property."""
        from app.models.inventory import InventoryItem
        
        item = InventoryItem(
            quantity_on_hand=100,
            quantity_reserved=20,
        )
        
        assert item.quantity_available == 80

    def test_inventory_item_quantity_available_no_negative(self):
        """Test quantity_available doesn't go negative."""
        from app.models.inventory import InventoryItem
        
        item = InventoryItem(
            quantity_on_hand=10,
            quantity_reserved=20,
        )
        
        assert item.quantity_available == 0

    def test_inventory_item_is_low_stock_true(self):
        """Test is_low_stock when below reorder point."""
        from app.models.inventory import InventoryItem
        
        item = InventoryItem(
            quantity_on_hand=5,
            reorder_point=10,
        )
        
        assert item.is_low_stock is True

    def test_inventory_item_is_low_stock_false(self):
        """Test is_low_stock when above reorder point."""
        from app.models.inventory import InventoryItem
        
        item = InventoryItem(
            quantity_on_hand=50,
            reorder_point=10,
        )
        
        assert item.is_low_stock is False

    def test_inventory_item_stock_value(self):
        """Test stock_value calculation."""
        from app.models.inventory import InventoryItem
        
        item = InventoryItem(
            quantity_on_hand=100,
            average_cost=Decimal("25.50"),
        )
        
        assert item.stock_value == 2550.0


class TestInventoryService:
    """Tests for InventoryService business logic."""

    def test_inventory_service_init(self):
        """Test InventoryService initialization."""
        from app.services.inventory_service import InventoryService
        from unittest.mock import MagicMock
        
        mock_db = MagicMock()
        service = InventoryService(mock_db)
        
        assert service.db == mock_db


class TestInventoryAPI:
    """Tests for Inventory API endpoints."""

    def test_inventory_router_exists(self):
        """Test that inventory router is properly configured."""
        from app.api.inventory import router
        
        assert router.prefix == "/inventory"
        assert "Inventory" in router.tags

    def test_inventory_endpoints_exist(self):
        """Test that all required endpoints exist."""
        from app.api.inventory import router
        
        routes = [route.path for route in router.routes]
        
        assert "/inventory" in routes  # list/create
        assert "/inventory/summary" in routes  # summary
        assert "/inventory/low-stock" in routes  # low stock alerts
        assert "/inventory/transactions" in routes  # transaction history
        assert "/inventory/{item_id}" in routes  # get/update
        assert "/inventory/{item_id}/adjust" in routes  # adjust


class TestInventorySummary:
    """Tests for inventory summary functionality."""

    def test_inventory_summary_schema(self):
        """Test InventorySummary schema."""
        from app.schemas.inventory import InventorySummary
        
        summary = InventorySummary(
            total_items=500,
            total_value=Decimal("125000.00"),
            low_stock_count=15,
            out_of_stock_count=3,
        )
        
        assert summary.total_items == 500
        assert summary.total_value == Decimal("125000.00")
        assert summary.low_stock_count == 15
        assert summary.out_of_stock_count == 3


class TestInventoryTransactions:
    """Tests for inventory transactions."""

    def test_transaction_response_schema(self):
        """Test InventoryTransactionResponse schema."""
        from app.schemas.inventory import InventoryTransactionResponse
        from app.models.inventory import TransactionType
        from datetime import datetime
        
        response = InventoryTransactionResponse(
            id="123",
            business_id="456",
            product_id="789",
            transaction_type=TransactionType.ADJUSTMENT,
            quantity_change=10,
            quantity_before=90,
            quantity_after=100,
            created_at=datetime.now(),
        )
        
        assert response.quantity_change == 10
        assert response.transaction_type == TransactionType.ADJUSTMENT
