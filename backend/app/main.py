"""Main FastAPI application entry point."""

import time
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import traceback

from app.api import router as api_router
from app.core.config import settings

# Configure logging for performance monitoring
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bizpilot.performance")


class TimingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log request timing for performance monitoring.
    Logs slow requests (>500ms) as warnings.
    """
    async def dispatch(self, request: Request, call_next):
        start_time = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start_time) * 1000
        
        # Add timing header for debugging
        response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"
        
        # Log slow requests
        if duration_ms > 500:
            logger.warning(
                f"SLOW REQUEST: {request.method} {request.url.path} took {duration_ms:.2f}ms"
            )
        elif settings.DEBUG:
            logger.info(
                f"Request: {request.method} {request.url.path} - {duration_ms:.2f}ms"
            )
        
        return response


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

# Add timing middleware FIRST (outermost - measures total request time)
app.add_middleware(TimingMiddleware)

# Add custom CORS middleware 
app.add_middleware(CORSDebugMiddleware)

# Configure standard CORS middleware as backup
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.get("/health")
@app.get("/api/health")
async def health_check():
    """Health check endpoint (available at both /health and /api/health for DO routing)."""
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
