"""Unit tests for Supplier API endpoints."""


class TestSupplierSchemas:
    """Tests for supplier schema validation."""

    def test_supplier_create_schema(self):
        from app.schemas.supplier import SupplierCreate

        data = SupplierCreate(
            name="Acme Supplies",
            contact_name="Jane Doe",
            email="contact@acme.com",
            phone="+123456789",
            tags=["wholesale"],
        )

        assert data.name == "Acme Supplies"
        assert data.contact_name == "Jane Doe"
        assert data.email == "contact@acme.com"
        assert data.tags == ["wholesale"]

    def test_supplier_update_schema_partial(self):
        from app.schemas.supplier import SupplierUpdate

        data = SupplierUpdate(name="Updated")
        assert data.name == "Updated"
        assert data.email is None


class TestSupplierModel:
    """Tests for Supplier model."""

    def test_supplier_display_name(self):
        from app.models.supplier import Supplier

        supplier = Supplier(name="Big Supplier")
        assert supplier.display_name == "Big Supplier"

    def test_supplier_full_address(self):
        from app.models.supplier import Supplier

        supplier = Supplier(
            name="X",
            address_line1="123 Main St",
            city="Cape Town",
            state="WC",
            postal_code="8001",
            country="South Africa",
        )

        addr = supplier.full_address
        assert "123 Main St" in addr
        assert "Cape Town" in addr
        assert "South Africa" in addr


class TestSupplierService:
    def test_supplier_service_init(self):
        from app.services.supplier_service import SupplierService
        from unittest.mock import MagicMock

        service = SupplierService(MagicMock())
        assert service.db is not None


class TestSupplierAPI:
    def test_supplier_router_exists(self):
        from app.api.suppliers import router

        assert router.prefix == "/suppliers"
        assert "Suppliers" in router.tags

    def test_supplier_endpoints_exist(self):
        from app.api.suppliers import router

        routes = [route.path for route in router.routes]

        assert "/suppliers" in routes
        assert "/suppliers/{supplier_id}" in routes
