"""API routers module."""

from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.oauth import router as oauth_router
from app.api.business import router as business_router
from app.api.users import router as users_router
from app.api.products import router as products_router
from app.api.customers import router as customers_router
from app.api.suppliers import router as suppliers_router
from app.api.orders import router as orders_router
from app.api.invoices import router as invoices_router
from app.api.inventory import router as inventory_router
from app.api.dashboard import router as dashboard_router
from app.api.reports import router as reports_router
from app.api.ai import router as ai_router
from app.api.categories import router as categories_router
from app.api.admin import router as admin_router
from app.api.subscriptions import router as subscriptions_router
from app.api.payments_subscription import router as payments_subscription_router
from app.api.production import router as production_router
from app.api.time_entries import router as time_entries_router
from app.api.pos_connections import router as pos_connections_router
from app.api.roles import router as roles_router
from app.api.sessions import router as sessions_router
from app.api.notifications import router as notifications_router
from app.api.favorites import router as favorites_router
from app.api.scheduler import router as scheduler_router
from app.api.departments import router as departments_router
from app.api.contact import router as contact_router
from app.api.permissions import router as permissions_router
from app.api.admin_subscriptions import router as admin_subscriptions_router
from app.api.admin_audit_logs import router as admin_audit_logs_router
from app.api.mobile_sync import router as mobile_sync_router
from app.api.laybys import router as laybys_router

router = APIRouter()

# Include auth routes
router.include_router(auth_router)
router.include_router(oauth_router)
router.include_router(business_router)
router.include_router(users_router)
router.include_router(dashboard_router)
router.include_router(products_router)
router.include_router(customers_router)
router.include_router(suppliers_router)
router.include_router(orders_router)
router.include_router(invoices_router)
router.include_router(inventory_router)
router.include_router(reports_router)
router.include_router(ai_router)
router.include_router(categories_router)
router.include_router(admin_router)
router.include_router(subscriptions_router)
router.include_router(payments_subscription_router)
router.include_router(production_router)
router.include_router(time_entries_router)
router.include_router(pos_connections_router)
router.include_router(roles_router)
router.include_router(sessions_router)
router.include_router(notifications_router)
router.include_router(favorites_router)
router.include_router(departments_router)
router.include_router(contact_router)
router.include_router(permissions_router)
router.include_router(admin_subscriptions_router)
router.include_router(admin_audit_logs_router)
router.include_router(mobile_sync_router)
router.include_router(laybys_router)
router.include_router(scheduler_router, prefix="/scheduler", tags=["scheduler"])


@router.get("/")
async def api_root():
    """API root endpoint."""
    return {"message": "BizPilot API v1", "status": "operational"}
