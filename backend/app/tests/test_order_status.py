"""
test_order_status.py
Tests for order status update endpoint (PATCH /api/v1/orders/{id}).

Root cause fixed: the backend only registered PUT /{order_id}.  The frontend
purchase-order status dropdown sends PATCH /{order_id}, so it received 405.
Fix: both PUT and PATCH decorators now share the same handler.
"""

import pytest
from app.models.order import OrderStatus


class TestOrderStatusEndpoint:
    """Verify PATCH method is accepted and status values are valid."""

    def test_patch_route_registered_on_orders_router(self):
        """PATCH /{order_id} must be a registered route on the orders router."""
        from app.api.orders import router
        patch_routes = [
            r for r in router.routes
            if hasattr(r, "methods") and "PATCH" in r.methods
        ]
        base_patch = [
            r for r in patch_routes
            if getattr(r, "path", "").endswith("/{order_id}")
            and "/status" not in getattr(r, "path", "")
        ]
        assert base_patch, (
            "No PATCH /{order_id} route. "
            f"Existing PATCH routes: {[r.path for r in patch_routes]}"
        )

    def test_put_route_still_registered(self):
        """PUT /{order_id} must still work after adding PATCH."""
        from app.api.orders import router
        put_routes = [
            r for r in router.routes
            if hasattr(r, "methods") and "PUT" in r.methods
            and getattr(r, "path", "").endswith("/{order_id}")
        ]
        assert put_routes, "PUT /{order_id} route missing — regression"

    def test_status_route_patch_on_status_sub_path(self):
        """PATCH /{order_id}/status must also exist for status-only updates."""
        from app.api.orders import router
        routes = [
            r for r in router.routes
            if hasattr(r, "methods") and "PATCH" in r.methods
            and "/status" in getattr(r, "path", "")
        ]
        assert routes, "PATCH /{order_id}/status route missing"

    def test_all_status_transitions_reachable(self):
        """Every target status value used by the frontend dropdown must exist."""
        frontend_options = [
            "draft", "pending", "confirmed", "processing",
            "shipped", "delivered", "received", "cancelled",
        ]
        enum_values = [s.value for s in OrderStatus]
        missing = [s for s in frontend_options if s not in enum_values]
        assert not missing, f"Status values not in enum: {missing}"
