"""API routers module."""

from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.oauth import router as oauth_router
from app.api.products import router as products_router

router = APIRouter()

# Include auth routes
router.include_router(auth_router)
router.include_router(oauth_router)
router.include_router(products_router)


@router.get("/")
async def api_root():
    """API root endpoint."""
    return {"message": "BizPilot API v1", "status": "operational"}
