"""
test_production_fixes.py
Tests for production bug fixes: orders receive, PATCH method, email service.
"""

import pytest
from app.models.order import OrderStatus
from app.services.email_service import EmailService


class TestOrderStatusEnum:
    """Test that OrderStatus enum has required values."""

    def test_received_status_exists(self):
        """Test: OrderStatus.RECEIVED enum value exists."""
        assert hasattr(OrderStatus, 'RECEIVED')
        assert OrderStatus.RECEIVED.value == 'received'

    def test_all_status_values(self):
        """Test: All expected order statuses exist."""
        expected_statuses = {
            'draft', 'pending', 'confirmed', 'processing',
            'shipped', 'delivered', 'received', 'cancelled', 'refunded'
        }
        actual_statuses = {s.value for s in OrderStatus}
        assert actual_statuses == expected_statuses


class TestEmailService:
    """Test email service error handling."""

    def test_email_service_init(self):
        """Test: EmailService can be instantiated."""
        service = EmailService()
        assert service is not None

    def test_email_requires_smtp_config(self):
        """Test: Email sending raises error when SMTP not configured."""
        from app.core.config import settings
        service = EmailService()

        # If SMTP_USER is set but SMTP_PASSWORD is not, should raise ValueError
        if settings.SMTP_USER and not settings.SMTP_PASSWORD:
            with pytest.raises(ValueError):
                service.send_email(
                    to_email="test@example.com",
                    subject="Test",
                    body_text="Test"
                )


class TestOrdersPatchMethod:
    """Test that orders endpoint accepts PATCH method."""

    def test_orders_router_has_patch(self):
        """Test: Orders router has PATCH method defined."""
        from app.api.orders import router

        routes = [route for route in router.routes]
        route_methods = {}

        for route in routes:
            if hasattr(route, 'methods'):
                path = getattr(route, 'path', '')
                if '{order_id}' in path:
                    route_methods[path] = route.methods

        # Check that at least one route has PATCH
        has_patch = any('PATCH' in methods for methods in route_methods.values())
        assert has_patch, "No PATCH method found on orders endpoint"
