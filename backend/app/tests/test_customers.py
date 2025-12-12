"""Unit tests for Customer API endpoints."""

import pytest
from decimal import Decimal


class TestCustomerSchemas:
    """Tests for customer schema validation."""

    def test_customer_type_enum(self):
        """Test CustomerType enum values."""
        from app.models.customer import CustomerType
        
        assert CustomerType.INDIVIDUAL.value == "individual"
        assert CustomerType.BUSINESS.value == "business"

    def test_customer_create_schema_individual(self):
        """Test CustomerCreate schema for individual customer."""
        from app.schemas.customer import CustomerCreate
        from app.models.customer import CustomerType
        
        data = CustomerCreate(
            customer_type=CustomerType.INDIVIDUAL,
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
            phone="+1234567890",
        )
        
        assert data.first_name == "John"
        assert data.last_name == "Doe"
        assert data.email == "john.doe@example.com"
        assert data.customer_type == CustomerType.INDIVIDUAL

    def test_customer_create_schema_business(self):
        """Test CustomerCreate schema for business customer."""
        from app.schemas.customer import CustomerCreate
        from app.models.customer import CustomerType
        
        data = CustomerCreate(
            customer_type=CustomerType.BUSINESS,
            company_name="Acme Corp",
            tax_number="VAT123456",
            email="contact@acme.com",
            address_line1="123 Business St",
            city="New York",
            country="USA",
        )
        
        assert data.company_name == "Acme Corp"
        assert data.tax_number == "VAT123456"
        assert data.customer_type == CustomerType.BUSINESS

    def test_customer_create_with_tags(self):
        """Test CustomerCreate schema with tags."""
        from app.schemas.customer import CustomerCreate
        
        data = CustomerCreate(
            first_name="Jane",
            last_name="Smith",
            tags=["vip", "wholesale", "repeat"],
        )
        
        assert data.tags == ["vip", "wholesale", "repeat"]

    def test_customer_update_schema_partial(self):
        """Test CustomerUpdate schema for partial updates."""
        from app.schemas.customer import CustomerUpdate
        
        data = CustomerUpdate(first_name="Updated Name")
        
        assert data.first_name == "Updated Name"
        assert data.last_name is None
        assert data.email is None

    def test_customer_list_response_schema(self):
        """Test CustomerListResponse schema."""
        from app.schemas.customer import CustomerListResponse, CustomerResponse
        from app.models.customer import CustomerType
        from datetime import datetime
        
        item = CustomerResponse(
            id="123",
            business_id="456",
            customer_type=CustomerType.INDIVIDUAL,
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            phone=None,
            company_name=None,
            tax_number=None,
            address_line1=None,
            address_line2=None,
            city=None,
            state=None,
            postal_code=None,
            country=None,
            notes=None,
            tags=[],
            display_name="John Doe",
            full_address="",
            total_orders=5,
            total_spent=Decimal("500.00"),
            average_order_value=Decimal("100.00"),
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        
        response = CustomerListResponse(
            items=[item],
            total=1,
            page=1,
            per_page=20,
            pages=1,
        )
        
        assert len(response.items) == 1
        assert response.total == 1


class TestCustomerModel:
    """Tests for Customer model."""

    def test_customer_display_name_individual(self):
        """Test display_name for individual customer."""
        from app.models.customer import Customer, CustomerType
        
        customer = Customer(
            customer_type=CustomerType.INDIVIDUAL,
            first_name="John",
            last_name="Doe",
        )
        
        assert customer.display_name == "John Doe"

    def test_customer_display_name_business(self):
        """Test display_name for business customer."""
        from app.models.customer import Customer, CustomerType
        
        customer = Customer(
            customer_type=CustomerType.BUSINESS,
            company_name="Acme Corp",
            first_name="John",
            last_name="Doe",
        )
        
        assert customer.display_name == "Acme Corp"

    def test_customer_display_name_first_only(self):
        """Test display_name with only first name."""
        from app.models.customer import Customer
        
        customer = Customer(first_name="John")
        
        assert customer.display_name == "John"

    def test_customer_display_name_unknown(self):
        """Test display_name when no name provided."""
        from app.models.customer import Customer
        
        customer = Customer()
        
        assert customer.display_name == "Unknown"

    def test_customer_full_address(self):
        """Test full_address property."""
        from app.models.customer import Customer
        
        customer = Customer(
            address_line1="123 Main St",
            address_line2="Suite 100",
            city="New York",
            state="NY",
            postal_code="10001",
            country="USA",
        )
        
        address = customer.full_address
        assert "123 Main St" in address
        assert "Suite 100" in address
        assert "New York" in address
        assert "USA" in address


class TestCustomerService:
    """Tests for CustomerService business logic."""

    def test_customer_service_init(self):
        """Test CustomerService initialization."""
        from app.services.customer_service import CustomerService
        from unittest.mock import MagicMock
        
        mock_db = MagicMock()
        service = CustomerService(mock_db)
        
        assert service.db == mock_db


class TestCustomerAPI:
    """Tests for Customer API endpoints."""

    def test_customer_router_exists(self):
        """Test that customer router is properly configured."""
        from app.api.customers import router
        
        assert router.prefix == "/customers"
        assert "Customers" in router.tags

    def test_customer_endpoints_exist(self):
        """Test that all required endpoints exist."""
        from app.api.customers import router
        
        routes = [route.path for route in router.routes]
        
        assert "/customers" in routes  # list/create
        assert "/customers/{customer_id}" in routes  # get/update/delete
        assert "/customers/top" in routes  # top customers
        assert "/customers/{customer_id}/metrics" in routes  # metrics
        assert "/customers/bulk" in routes  # bulk create
        assert "/customers/bulk-delete" in routes  # bulk delete

    def test_customer_to_response_helper(self):
        """Test _customer_to_response helper function."""
        from app.api.customers import _customer_to_response
        from app.models.customer import Customer, CustomerType
        from datetime import datetime
        import uuid
        
        customer = Customer(
            id=uuid.uuid4(),
            business_id=uuid.uuid4(),
            customer_type=CustomerType.INDIVIDUAL,
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            total_orders=0,
            total_spent=Decimal("0.00"),
            average_order_value=Decimal("0.00"),
            tags=[],
        )
        customer.created_at = datetime.now()
        customer.updated_at = datetime.now()
        
        response = _customer_to_response(customer)
        
        assert response.first_name == "John"
        assert response.last_name == "Doe"
        assert response.display_name == "John Doe"


class TestCustomerMetrics:
    """Tests for customer metrics functionality."""

    def test_customer_metrics_schema(self):
        """Test CustomerMetrics schema."""
        from app.schemas.customer import CustomerMetrics
        
        metrics = CustomerMetrics(
            total_orders=10,
            total_spent=Decimal("1000.00"),
            average_order_value=Decimal("100.00"),
        )
        
        assert metrics.total_orders == 10
        assert metrics.total_spent == Decimal("1000.00")
        assert metrics.average_order_value == Decimal("100.00")
        assert metrics.first_order_date is None
        assert metrics.last_order_date is None


class TestCustomerTags:
    """Tests for customer tagging functionality."""

    def test_customer_with_empty_tags(self):
        """Test customer with no tags."""
        from app.schemas.customer import CustomerCreate
        
        data = CustomerCreate(first_name="John")
        
        assert data.tags == []

    def test_customer_with_multiple_tags(self):
        """Test customer with multiple tags."""
        from app.schemas.customer import CustomerCreate
        
        data = CustomerCreate(
            first_name="John",
            tags=["vip", "wholesale", "local"],
        )
        
        assert len(data.tags) == 3
        assert "vip" in data.tags
        assert "wholesale" in data.tags


class TestCustomerBulkOperations:
    """Tests for bulk customer operations."""

    def test_customer_bulk_create_schema(self):
        """Test CustomerBulkCreate schema."""
        from app.schemas.customer import CustomerBulkCreate, CustomerCreate
        
        customers = [
            CustomerCreate(first_name="John", last_name="Doe"),
            CustomerCreate(first_name="Jane", last_name="Smith"),
        ]
        
        data = CustomerBulkCreate(customers=customers)
        
        assert len(data.customers) == 2

    def test_customer_bulk_delete_schema(self):
        """Test CustomerBulkDelete schema."""
        from app.schemas.customer import CustomerBulkDelete
        
        data = CustomerBulkDelete(
            customer_ids=["id1", "id2", "id3"]
        )
        
        assert len(data.customer_ids) == 3
