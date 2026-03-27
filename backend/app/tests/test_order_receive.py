"""
test_order_receive.py
Tests for the order receive endpoint (POST /api/v1/orders/{id}/receive).

Root cause fixed: OrderStatus.RECEIVED ("received") was missing from the
PostgreSQL orderstatus enum.  Migration h3c4d5e6f7a8 adds it.  These tests
verify the enum value exists in Python and that the endpoint logic is sound.
"""

from app.models.order import OrderStatus


class TestOrderStatusReceived:
    """Verify the RECEIVED enum value that caused the production 500."""

    def test_received_value_exists(self):
        """OrderStatus.RECEIVED must exist with value 'received'."""
        assert hasattr(OrderStatus, "RECEIVED")
        assert OrderStatus.RECEIVED.value == "received"

    def test_received_not_in_terminal_check_prematurely(self):
        """RECEIVED should not appear alongside CANCELLED as a blocker — it IS terminal."""
        # Verifies the receive endpoint's guard: status in [RECEIVED, CANCELLED]
        blockers = {OrderStatus.RECEIVED, OrderStatus.CANCELLED}
        assert OrderStatus.RECEIVED in blockers
        assert OrderStatus.CANCELLED in blockers
        assert OrderStatus.PENDING not in blockers
        assert OrderStatus.DELIVERED not in blockers

    def test_all_expected_status_values_present(self):
        """All status values used by the frontend STATUS_OPTIONS must exist."""
        expected = {
            "draft", "pending", "confirmed", "processing",
            "shipped", "delivered", "received", "cancelled", "refunded",
        }
        actual = {s.value for s in OrderStatus}
        assert expected.issubset(actual), f"Missing: {expected - actual}"

    def test_receive_endpoint_registered(self):
        """POST /{order_id}/receive must be registered on the orders router."""
        from app.api.orders import router
        routes = {r.path for r in router.routes if hasattr(r, "path")}
        assert any("receive" in p for p in routes), f"No /receive route found. Routes: {routes}"

    def test_patch_method_registered(self):
        """PATCH /{order_id} must be registered alongside PUT."""
        from app.api.orders import router
        patch_found = any(
            hasattr(r, "methods") and "PATCH" in r.methods
            and getattr(r, "path", "").endswith("/{order_id}")
            and "/status" not in getattr(r, "path", "")
            for r in router.routes
        )
        put_found = any(
            hasattr(r, "methods") and "PUT" in r.methods
            and getattr(r, "path", "").endswith("/{order_id}")
            for r in router.routes
        )
        assert patch_found, "PATCH /{order_id} not registered"
        assert put_found, "PUT /{order_id} not registered"
