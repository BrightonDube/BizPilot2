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
from app.api.payments import router as payments_router
from app.api.reports import router as reports_router
from app.api.ai import router as ai_router
from app.api.categories import router as categories_router

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
router.include_router(payments_router)
router.include_router(reports_router)
router.include_router(ai_router)
router.include_router(categories_router)


@router.get("/")
async def api_root():
    """API root endpoint."""
    return {"message": "BizPilot API v1", "status": "operational"}
