"""
test_purchase_status.py
Tests for purchase order status update via PATCH /api/v1/orders/{id}.

Root cause fixed: the frontend purchase-order status dropdown sends
``PATCH /orders/{id}`` but only ``PUT /orders/{id}`` was registered.
Sending PATCH returned 405 Method Not Allowed.
Fix: added ``@router.patch("/{order_id}")`` decorator to share the same
handler with ``@router.put("/{order_id}")``.

Also tests the dedicated ``PATCH /{order_id}/status`` route and the
``OrderStatusUpdate`` schema.
"""

import pytest
from app.models.order import OrderStatus


class TestPurchaseStatusDropdown:
    """PATCH routes the frontend status dropdown relies on."""

    def test_patch_order_id_route_registered(self):
        """PATCH /{order_id} must be registered (status dropdown sends this)."""
        from app.api.orders import router
        patch_routes = [
            r for r in router.routes
            if hasattr(r, "methods") and "PATCH" in r.methods
            and getattr(r, "path", "").endswith("/{order_id}")
            and "/status" not in getattr(r, "path", "")
        ]
        assert patch_routes, (
            "PATCH /{order_id} not registered — frontend dropdown gets 405. "
            "Add @router.patch('/{order_id}') decorator to the update_order handler."
        )

    def test_put_order_id_still_registered(self):
        """PUT /{order_id} must still be present after adding PATCH (no regression)."""
        from app.api.orders import router
        put_routes = [
            r for r in router.routes
            if hasattr(r, "methods") and "PUT" in r.methods
            and getattr(r, "path", "").endswith("/{order_id}")
        ]
        assert put_routes, "PUT /{order_id} was removed — regression"

    def test_patch_status_sub_path_registered(self):
        """PATCH /{order_id}/status must exist for status-only updates."""
        from app.api.orders import router
        routes = [
            r for r in router.routes
            if hasattr(r, "methods") and "PATCH" in r.methods
            and "/status" in getattr(r, "path", "")
        ]
        assert routes, "PATCH /{order_id}/status route missing"

    def test_order_status_update_schema_has_status_field(self):
        """OrderStatusUpdate schema must have a 'status' field."""
        from app.schemas.order import OrderStatusUpdate
        fields = OrderStatusUpdate.model_fields
        assert "status" in fields, "OrderStatusUpdate missing 'status' field"

    def test_dropdown_status_values_all_in_enum(self):
        """Every status value shown in the frontend dropdown must exist in OrderStatus."""
        # These match the STATUS_OPTIONS array in the purchase orders frontend page
        dropdown_values = [
            "draft",
            "pending",
            "confirmed",
            "processing",
            "shipped",
            "delivered",
            "received",
            "cancelled",
        ]
        enum_values = {s.value for s in OrderStatus}
        missing = [v for v in dropdown_values if v not in enum_values]
        assert not missing, (
            f"Status values used by frontend dropdown not in OrderStatus enum: {missing}. "
            "Add them to the OrderStatus enum and run the migration."
        )

    def test_received_status_value(self):
        """OrderStatus.RECEIVED ('received') must exist — needed after the migration."""
        assert hasattr(OrderStatus, "RECEIVED"), "OrderStatus missing RECEIVED"
        assert OrderStatus.RECEIVED.value == "received"

    def test_cancelled_status_value(self):
        """OrderStatus.CANCELLED ('cancelled') must exist."""
        assert hasattr(OrderStatus, "CANCELLED"), "OrderStatus missing CANCELLED"
        assert OrderStatus.CANCELLED.value == "cancelled"

    def test_both_methods_registered_for_order_id_path(self):
        """Both PATCH and PUT must be registered for /{order_id} (separate route objects is fine)."""
        from app.api.orders import router
        order_id_paths = [
            r for r in router.routes
            if hasattr(r, "methods")
            and getattr(r, "path", "").endswith("/{order_id}")
            and "/status" not in getattr(r, "path", "")
        ]
        methods = set()
        for r in order_id_paths:
            methods.update(r.methods)
        assert "PATCH" in methods, f"PATCH not found in /{'{order_id}'} routes — got: {methods}"
        assert "PUT" in methods, f"PUT not found in /{'{order_id}'} routes — got: {methods}"
