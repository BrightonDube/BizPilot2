"""API routers module."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def api_root():
    """API root endpoint."""
    return {"message": "BizPilot API v1", "status": "operational"}
