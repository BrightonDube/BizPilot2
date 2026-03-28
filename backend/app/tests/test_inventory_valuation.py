"""
test_inventory_valuation.py
Tests for inventory valuation endpoint (GET /api/v1/inventory-reports/valuation).

Root cause fixed: the endpoint did not accept a ``method`` query parameter,
so ``?method=average`` was silently discarded and the parameter was never
forwarded to InventoryReportService.get_valuation().  Added ``method`` param
with validation.
"""

import pytest


class TestInventoryValuationEndpoint:
    """Verify valuation endpoint registration and method parameter handling."""

    def test_valuation_route_registered(self):
        """GET /inventory-reports/valuation must be registered."""
        from app.api.inventory_reports import router
        get_routes = [
            r for r in router.routes
            if hasattr(r, "methods") and "GET" in r.methods
            and "/valuation" in getattr(r, "path", "")
        ]
        assert get_routes, "GET /inventory-reports/valuation route not found"

    def test_valuation_service_accepts_method_param(self):
        """InventoryReportService.get_valuation must accept a method parameter."""
        import inspect
        from app.services.inventory_report_service import InventoryReportService
        sig = inspect.signature(InventoryReportService.get_valuation)
        assert "method" in sig.parameters, (
            "get_valuation() does not accept 'method' parameter — "
            "frontend ?method=average will be silently ignored"
        )

    def test_valuation_method_default_is_average(self):
        """Default valuation method must be 'average'."""
        import inspect
        from app.services.inventory_report_service import InventoryReportService
        sig = inspect.signature(InventoryReportService.get_valuation)
        default = sig.parameters["method"].default
        assert default == "average", f"Expected default 'average', got {default!r}"

    def test_endpoint_handler_accepts_method_query_param(self):
        """The endpoint function itself must declare a ``method`` parameter."""
        import inspect
        from app.api.inventory_reports import get_valuation
        sig = inspect.signature(get_valuation)
        assert "method" in sig.parameters, (
            "Endpoint get_valuation() does not declare 'method' query param"
        )

    def test_invalid_method_raises_422(self):
        """Passing an invalid method like 'lifo' must raise HTTP 422."""
        from fastapi.testclient import TestClient
        from fastapi import FastAPI
        from unittest.mock import MagicMock, patch

        # Build minimal app to test the endpoint in isolation
        from app.api.inventory_reports import router as inv_router
        app = FastAPI()
        app.include_router(inv_router)

        TestClient(app, raise_server_exceptions=False)  # noqa: F841
        # Without auth this will 403/401, but we just want to confirm
        # the method validation path exists and the logic is correct
        # by unit-testing the validator directly
        import asyncio
        from app.api.inventory_reports import get_valuation

        async def _call():
            from fastapi import HTTPException
            with pytest.raises(HTTPException) as exc_info:
                # Simulate calling the handler with invalid method
                # We need to bypass the Depends() params
                with patch("app.api.inventory_reports.InventoryReportService"):
                    await get_valuation(
                        method="lifo",
                        category_id=None,
                        business_id=None,  # type: ignore
                        current_user=MagicMock(),
                        db=MagicMock(),
                    )
            assert exc_info.value.status_code == 422

        asyncio.run(_call())
