"""Main FastAPI application entry point."""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import traceback

from app.api import router as api_router
from app.core.config import settings


class CORSDebugMiddleware(BaseHTTPMiddleware):
    """
    Custom middleware to ensure CORS headers are added to ALL responses,
    including error responses (500, 422, etc.).
    """
    async def dispatch(self, request: Request, call_next):
        # Handle preflight OPTIONS requests
        if request.method == "OPTIONS":
            response = JSONResponse(content={"detail": "OK"}, status_code=200)
        else:
            try:
                response = await call_next(request)
            except Exception as e:
                # Log the error for debugging
                print(f"Error processing request: {e}")
                traceback.print_exc()
                response = JSONResponse(
                    content={"detail": "Internal server error"},
                    status_code=500
                )
        
        # Add CORS headers to all responses
        origin = request.headers.get("origin", "")
        if origin in settings.CORS_ORIGINS or "*" in settings.CORS_ORIGINS:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Client-Type, X-Requested-With"
        
        return response


app = FastAPI(
    title=settings.APP_NAME,
    description="BizPilot v2.0 - Modern Multi-Business Management Platform API",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Add custom CORS middleware FIRST (before FastAPI's CORSMiddleware)
app.add_middleware(CORSDebugMiddleware)

# Configure standard CORS middleware as backup
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": "2.0.0"}


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Welcome to BizPilot v2.0 API",
        "docs": "/api/docs",
        "health": "/health",
    }


# Include API routers
app.include_router(api_router, prefix="/api/v1")
