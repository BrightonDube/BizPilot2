"""
test_user_activity_report.py
Tests for the extended reports endpoints (GET /api/v1/reports/user-activity,
GET /api/v1/reports/login-history, GET /api/v1/reports/export/excel).

Root cause fixed: all three handlers used ``Depends(get_db)`` which returns an
async ``AsyncSession``.  ``ExtendedReportService`` calls ``.query()`` (sync ORM)
which does not exist on an async session → ``AttributeError`` → 500.
Fix: replaced ``Depends(get_db)`` with ``Depends(get_sync_db)`` in all three
handlers.
"""



class TestExtendedReportsRoutes:
    """Verify extended report routes are registered on the correct router."""

    def test_user_activity_route_registered(self):
        """GET /reports/user-activity must be a registered GET route."""
        from app.api.extended_reports import router
        get_routes = [
            r for r in router.routes
            if hasattr(r, "methods") and "GET" in r.methods
            and "user-activity" in getattr(r, "path", "")
        ]
        assert get_routes, "GET /reports/user-activity not registered"

    def test_login_history_route_registered(self):
        """GET /reports/login-history must be a registered GET route."""
        from app.api.extended_reports import router
        get_routes = [
            r for r in router.routes
            if hasattr(r, "methods") and "GET" in r.methods
            and "login-history" in getattr(r, "path", "")
        ]
        assert get_routes, "GET /reports/login-history not registered"

    def test_excel_export_route_registered(self):
        """GET /reports/export/excel must be a registered GET route."""
        from app.api.extended_reports import router
        get_routes = [
            r for r in router.routes
            if hasattr(r, "methods") and "GET" in r.methods
            and "excel" in getattr(r, "path", "")
        ]
        assert get_routes, "GET /reports/export/excel not registered"


class TestExtendedReportsSessionDependency:
    """Verify extended reports handlers use the sync DB session (the root cause fix)."""

    def _get_handler_dep_names(self, handler):
        """Extract Depends() dependency class names from a handler's signature."""
        import inspect
        from fastapi import params as fastapi_params
        sig = inspect.signature(handler)
        dep_names = []
        for param in sig.parameters.values():
            if isinstance(param.default, fastapi_params.Depends):
                dep = param.default.dependency
                dep_names.append(dep.__name__ if hasattr(dep, "__name__") else str(dep))
        return dep_names

    def test_user_activity_uses_sync_db(self):
        """get_user_activity must depend on get_sync_db, not async get_db."""
        from app.api.extended_reports import get_user_activity
        dep_names = self._get_handler_dep_names(get_user_activity)
        assert "get_sync_db" in dep_names, (
            f"get_user_activity depends on {dep_names} — expected 'get_sync_db'. "
            "Using async get_db causes AttributeError when .query() is called."
        )

    def test_login_history_uses_sync_db(self):
        """get_login_history must depend on get_sync_db, not async get_db."""
        from app.api.extended_reports import get_login_history
        dep_names = self._get_handler_dep_names(get_login_history)
        assert "get_sync_db" in dep_names, (
            f"get_login_history depends on {dep_names} — expected 'get_sync_db'."
        )

    def test_excel_export_uses_sync_db(self):
        """export_excel must depend on get_sync_db, not async get_db."""
        from app.api.extended_reports import export_excel
        dep_names = self._get_handler_dep_names(export_excel)
        assert "get_sync_db" in dep_names, (
            f"export_excel depends on {dep_names} — expected 'get_sync_db'."
        )


class TestExtendedReportServiceSignature:
    """Verify the service method signatures expected by the updated handlers."""

    def test_get_user_activity_signature(self):
        """ExtendedReportService.get_user_activity must accept expected params."""
        import inspect
        from app.services.extended_report_service import ExtendedReportService
        sig = inspect.signature(ExtendedReportService.get_user_activity)
        for expected in ("business_id", "start_date", "end_date"):
            assert expected in sig.parameters, (
                f"get_user_activity() missing param '{expected}'"
            )

    def test_get_login_history_signature(self):
        """ExtendedReportService.get_login_history must accept expected params."""
        import inspect
        from app.services.extended_report_service import ExtendedReportService
        sig = inspect.signature(ExtendedReportService.get_login_history)
        for expected in ("business_id",):
            assert expected in sig.parameters, (
                f"get_login_history() missing param '{expected}'"
            )
