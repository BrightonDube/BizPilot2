"""Unit tests for Order API endpoints."""

from decimal import Decimal


class TestOrderSchemas:
    """Tests for order schema validation."""

    def test_order_status_enum(self):
        """Test OrderStatus enum values."""
        from app.models.order import OrderStatus
        
        assert OrderStatus.DRAFT.value == "draft"
        assert OrderStatus.PENDING.value == "pending"
        assert OrderStatus.CONFIRMED.value == "confirmed"
        assert OrderStatus.PROCESSING.value == "processing"
        assert OrderStatus.SHIPPED.value == "shipped"
        assert OrderStatus.DELIVERED.value == "delivered"
        assert OrderStatus.CANCELLED.value == "cancelled"
        assert OrderStatus.REFUNDED.value == "refunded"

    def test_payment_status_enum(self):
        """Test PaymentStatus enum values."""
        from app.models.order import PaymentStatus
        
        assert PaymentStatus.PENDING.value == "pending"
        assert PaymentStatus.PARTIAL.value == "partial"
        assert PaymentStatus.PAID.value == "paid"
        assert PaymentStatus.REFUNDED.value == "refunded"
        assert PaymentStatus.FAILED.value == "failed"

    def test_order_item_create_schema(self):
        """Test OrderItemCreate schema."""
        from app.schemas.order import OrderItemCreate
        
        data = OrderItemCreate(
            name="Test Product",
            unit_price=Decimal("29.99"),
            quantity=2,
            tax_rate=Decimal("15.0"),
        )
        
        assert data.name == "Test Product"
        assert data.unit_price == Decimal("29.99")
        assert data.quantity == 2

    def test_order_create_schema(self):
        """Test OrderCreate schema."""
        from app.schemas.order import OrderCreate, OrderItemCreate
        from app.models.order import OrderStatus
        
        items = [
            OrderItemCreate(name="Product 1", unit_price=Decimal("10.00")),
            OrderItemCreate(name="Product 2", unit_price=Decimal("20.00"), quantity=2),
        ]
        
        data = OrderCreate(
            status=OrderStatus.DRAFT,
            notes="Test order",
            items=items,
        )
        
        assert len(data.items) == 2
        assert data.status == OrderStatus.DRAFT

    def test_address_schema(self):
        """Test AddressSchema."""
        from app.schemas.order import AddressSchema
        
        address = AddressSchema(
            line1="123 Main St",
            city="New York",
            state="NY",
            postal_code="10001",
            country="USA",
        )
        
        assert address.line1 == "123 Main St"
        assert address.city == "New York"

    def test_order_update_schema(self):
        """Test OrderUpdate schema for partial updates."""
        from app.schemas.order import OrderUpdate
        from app.models.order import OrderStatus
        
        data = OrderUpdate(status=OrderStatus.CONFIRMED)
        
        assert data.status == OrderStatus.CONFIRMED
        assert data.notes is None

    def test_payment_record_schema(self):
        """Test PaymentRecord schema."""
        from app.schemas.order import PaymentRecord
        
        data = PaymentRecord(
            amount=Decimal("100.00"),
            payment_method="credit_card",
            reference="TXN123",
        )
        
        assert data.amount == Decimal("100.00")
        assert data.payment_method == "credit_card"


class TestOrderModel:
    """Tests for Order model."""

    def test_order_balance_due(self):
        """Test balance_due property."""
        from app.models.order import Order
        
        order = Order(
            total=Decimal("100.00"),
            amount_paid=Decimal("30.00"),
        )
        
        assert order.balance_due == 70.0

    def test_order_is_paid_false(self):
        """Test is_paid when not fully paid."""
        from app.models.order import Order
        
        order = Order(
            total=Decimal("100.00"),
            amount_paid=Decimal("50.00"),
        )
        
        assert order.is_paid is False

    def test_order_is_paid_true(self):
        """Test is_paid when fully paid."""
        from app.models.order import Order
        
        order = Order(
            total=Decimal("100.00"),
            amount_paid=Decimal("100.00"),
        )
        
        assert order.is_paid is True

    def test_order_is_paid_overpaid(self):
        """Test is_paid when overpaid."""
        from app.models.order import Order
        
        order = Order(
            total=Decimal("100.00"),
            amount_paid=Decimal("150.00"),
        )
        
        assert order.is_paid is True


class TestOrderItemModel:
    """Tests for OrderItem model."""

    def test_order_item_line_total(self):
        """Test line_total property."""
        from app.models.order import OrderItem
        
        item = OrderItem(
            unit_price=Decimal("25.00"),
            quantity=4,
            discount_amount=Decimal("10.00"),
        )
        
        assert item.line_total == 90.0  # 25 * 4 - 10


class TestOrderService:
    """Tests for OrderService business logic."""

    def test_order_service_init(self):
        """Test OrderService initialization."""
        from app.services.order_service import OrderService
        from unittest.mock import MagicMock
        
        mock_db = MagicMock()
        service = OrderService(mock_db)
        
        assert service.db == mock_db

    def test_generate_order_number_format(self):
        """Test order number format."""
        from app.services.order_service import OrderService
        from unittest.mock import MagicMock
        
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.count.return_value = 0
        
        service = OrderService(mock_db)
        order_number = service.generate_order_number("test-business-id")
        
        # Should be ORD-YYYYMMDD-XXXXX format
        assert order_number.startswith("ORD-")
        parts = order_number.split("-")
        assert len(parts) == 3
        assert len(parts[1]) == 8  # YYYYMMDD


class TestOrderAPI:
    """Tests for Order API endpoints."""

    def test_order_router_exists(self):
        """Test that order router is properly configured."""
        from app.api.orders import router
        
        assert router.prefix == "/orders"
        assert "Orders" in router.tags

    def test_order_endpoints_exist(self):
        """Test that all required endpoints exist."""
        from app.api.orders import router
        
        routes = [route.path for route in router.routes]
        
        assert "/orders" in routes  # list/create
        assert "/orders/{order_id}" in routes  # get/update/delete
        assert "/orders/stats" in routes  # stats
        assert "/orders/{order_id}/status" in routes  # status update
        assert "/orders/{order_id}/payment" in routes  # payment
        assert "/orders/{order_id}/items" in routes  # items
        assert "/orders/{order_id}/items/{item_id}" in routes  # delete item


class TestOrderSummary:
    """Tests for order summary functionality."""

    def test_order_summary_schema(self):
        """Test OrderSummary schema."""
        from app.schemas.order import OrderSummary
        
        summary = OrderSummary(
            total_orders=100,
            total_revenue=Decimal("50000.00"),
            average_order_value=Decimal("500.00"),
            pending_orders=10,
            completed_orders=85,
        )
        
        assert summary.total_orders == 100
        assert summary.total_revenue == Decimal("50000.00")
        assert summary.pending_orders == 10


class TestOrderItemOperations:
    """Tests for order item operations."""

    def test_order_item_create_with_discount(self):
        """Test order item with discount."""
        from app.schemas.order import OrderItemCreate
        
        item = OrderItemCreate(
            name="Discounted Product",
            unit_price=Decimal("100.00"),
            quantity=1,
            discount_percent=Decimal("20.0"),
        )
        
        assert item.discount_percent == Decimal("20.0")

    def test_order_item_create_with_tax(self):
        """Test order item with tax."""
        from app.schemas.order import OrderItemCreate
        
        item = OrderItemCreate(
            name="Taxed Product",
            unit_price=Decimal("100.00"),
            quantity=1,
            tax_rate=Decimal("15.0"),
        )
        
        assert item.tax_rate == Decimal("15.0")


class TestOrderListResponse:
    """Tests for order list response."""

    def test_order_list_response_schema(self):
        """Test OrderListResponse schema."""
        from app.schemas.order import OrderListResponse, OrderResponse
        from app.models.order import OrderStatus, PaymentStatus
        from datetime import datetime
        
        item = OrderResponse(
            id="123",
            business_id="456",
            order_number="ORD-20241212-00001",
            status=OrderStatus.PENDING,
            payment_status=PaymentStatus.PENDING,
            payment_method=None,
            shipping_address=None,
            billing_address=None,
            notes=None,
            internal_notes=None,
            tags=[],
            source="manual",
            subtotal=Decimal("100.00"),
            tax_amount=Decimal("15.00"),
            discount_amount=Decimal("0"),
            shipping_amount=Decimal("10.00"),
            total=Decimal("125.00"),
            amount_paid=Decimal("0"),
            balance_due=125.0,
            is_paid=False,
            order_date=datetime.now(),
            created_at=datetime.now(),
            updated_at=datetime.now(),
            items=[],
        )
        
        response = OrderListResponse(
            items=[item],
            total=1,
            page=1,
            per_page=20,
            pages=1,
        )
        
        assert len(response.items) == 1
        assert response.total == 1
