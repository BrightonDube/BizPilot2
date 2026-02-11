"""Main FastAPI application entry point."""

import time
import uuid
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.sessions import SessionMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import traceback

from app.api import router as api_router
from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.redis import startup_redis, shutdown_redis
from app.scheduler.config import SchedulerConfig
from app.scheduler.manager import SchedulerManager
from app.scheduler.jobs.overdue_invoice_job import check_overdue_invoices_job
from app.scheduler.jobs.auto_clockout_job import auto_clock_out_job

# Configure logging for performance monitoring
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bizpilot.performance")

# Global scheduler instance
scheduler_manager = None


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add unique request ID for distributed tracing.
    
    - Generates UUID for each request if not provided
    - Adds X-Request-ID header to response
    - Stores request_id in request.state for logging
    """
    async def dispatch(self, request: Request, call_next):
        # Use provided request ID or generate new one
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id
        
        # Process request
        response = await call_next(request)
        
        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id
        
        return response


class TimingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log request timing for performance monitoring.
    Logs slow requests (>500ms) as warnings.
    Includes request ID in logs.
    """
    async def dispatch(self, request: Request, call_next):
        start_time = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start_time) * 1000
        
        # Add timing header for debugging
        response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"
        
        # Get request ID if available
        request_id = getattr(request.state, "request_id", "unknown")
        
        # Log slow requests
        if duration_ms > 500:
            logger.warning(
                f"[{request_id}] SLOW REQUEST: {request.method} {request.url.path} took {duration_ms:.2f}ms"
            )
        elif settings.DEBUG:
            logger.info(
                f"[{request_id}] Request: {request.method} {request.url.path} - {duration_ms:.2f}ms"
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
                # Log the error for debugging with full traceback
                logger.error(f"Error processing request {request.method} {request.url.path}: {e}", exc_info=True)
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

# Add rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add GZip compression middleware (compress responses > 500 bytes)
app.add_middleware(GZipMiddleware, minimum_size=500)

# Add CSRF protection for cookie-based authentication
# Note: This protects state-changing operations (POST, PUT, DELETE, PATCH)
# GET requests and endpoints with X-Client-Type: mobile are exempt

# Custom CSRF middleware that exempts mobile clients
class CSRFMiddleware(BaseHTTPMiddleware):
    """
    CSRF protection for cookie-based authentication.
    
    Protection:
    - Validates CSRF token on state-changing requests (POST, PUT, DELETE, PATCH)
    - Exempts mobile clients (X-Client-Type: mobile header)
    - Exempts safe methods (GET, HEAD, OPTIONS)
    - Exempts auth endpoints (login, register, etc.)
    - Exempts Bearer token authenticated requests (API clients)
    """
    SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
    EXEMPT_PATHS = {
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/refresh",
        "/api/v1/oauth/",
        "/health",
        "/api/health",
        "/api/v1/payments/webhook",  # Webhooks don't have CSRF
        "/api/v1/contact",  # Public contact form
        "/api/v1/ai/guest-chat",  # Guest AI chat
    }
    
    async def dispatch(self, request: Request, call_next):
        # Skip CSRF check for safe methods
        if request.method in self.SAFE_METHODS:
            return await call_next(request)
        
        # Skip CSRF check for exempt paths
        if any(request.url.path.startswith(path) for path in self.EXEMPT_PATHS):
            return await call_next(request)
        
        # Skip CSRF check for mobile clients
        client_type = request.headers.get("X-Client-Type", "").lower()
        if client_type == "mobile":
            return await call_next(request)
        
        # Skip CSRF check for Bearer token authenticated requests
        # These are API clients that don't use cookie-based auth
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            return await call_next(request)
        
        # Validate CSRF token for cookie-based web clients only
        csrf_token = request.headers.get("X-CSRF-Token")
        session_csrf = request.session.get("csrf_token")
        
        if not csrf_token or not session_csrf or csrf_token != session_csrf:
            return JSONResponse(
                status_code=403,
                content={"detail": "CSRF token missing or invalid"}
            )
        
        return await call_next(request)

app.add_middleware(CSRFMiddleware)

# Add session middleware for CSRF (must be added AFTER CSRFMiddleware so it processes first)
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SECRET_KEY,
    session_cookie="session",
    max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    same_site=settings.COOKIE_SAMESITE,
    https_only=settings.COOKIE_SECURE or settings.is_production,
)

# Add request ID middleware (before timing to include in timing logs)
app.add_middleware(RequestIDMiddleware)

# Add timing middleware (outermost - measures total request time)
app.add_middleware(TimingMiddleware)

# Add custom CORS middleware 
app.add_middleware(CORSDebugMiddleware)

# Configure standard CORS middleware with stricter settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],  # Specific methods only
    allow_headers=[
        "Content-Type",
        "Authorization", 
        "X-Request-ID",
        "X-Business-ID",
        "X-Client-Type",
        "X-Device-ID",
        "X-Device-Name",
        "X-CSRF-Token",  # For CSRF protection
    ],
    expose_headers=["X-Request-ID", "X-Response-Time"],
)


@app.get("/api/csrf-token")
async def get_csrf_token(request: Request):
    """
    Get or generate CSRF token for web clients.
    Mobile clients don't need this.
    """
    # Generate CSRF token if not exists
    if "csrf_token" not in request.session:
        import secrets
        request.session["csrf_token"] = secrets.token_urlsafe(32)
    
    return {
        "csrf_token": request.session["csrf_token"]
    }


@app.get("/health/liveness")
async def liveness_check():
    """
    Kubernetes liveness probe - is the app running?
    Returns 200 if the application process is alive.
    """
    return {"status": "alive", "version": "2.0.0"}


@app.get("/health")
@app.get("/api/health")
@app.get("/health/readiness")
async def readiness_check():
    """
    Kubernetes readiness probe - can the app serve traffic?
    Checks database, Redis, and scheduler health.
    Returns 503 if any critical component is unhealthy.
    """
    from sqlalchemy import text
    from app.core.database import SessionLocal
    
    checks = {
        "status": "ready",
        "version": "2.0.0",
        "database": "unknown",
        "redis": "unknown",
        "scheduler": "unknown",
    }
    
    # Check database connectivity
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        checks["database"] = "healthy"
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        checks["database"] = "unhealthy"
        checks["status"] = "not_ready"
    
    # Check Redis availability
    try:
        from app.core.redis import redis_manager
        if redis_manager.is_available():
            checks["redis"] = "healthy"
        else:
            checks["redis"] = "unavailable"
            # Redis unavailable doesn't make app not ready (fallback mode)
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        checks["redis"] = "error"
    
    # Check scheduler status
    try:
        if scheduler_manager and hasattr(scheduler_manager, '_scheduler'):
            if scheduler_manager._scheduler.running:
                checks["scheduler"] = "running"
            else:
                checks["scheduler"] = "stopped"
        else:
            checks["scheduler"] = "not_initialized"
    except Exception as e:
        logger.error(f"Scheduler health check failed: {e}")
        checks["scheduler"] = "error"
    
    status_code = 200 if checks["status"] == "ready" else 503
    return JSONResponse(content=checks, status_code=status_code)


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


@app.on_event("startup")
async def startup_event():
    """Initialize Redis and scheduler on application startup."""
    global scheduler_manager
    
    # Initialize Redis connection
    try:
        logger.info("Initializing Redis connection...")
        await startup_redis()
        logger.info("Redis initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Redis: {e}", exc_info=True)
        # Don't fail application startup if Redis fails (fallback mode)
    
    # Initialize scheduler
    try:
        logger.info("Initializing scheduler...")
        
        # Load scheduler configuration
        config = SchedulerConfig.from_env()
        
        # Create scheduler manager
        scheduler_manager = SchedulerManager(config)
        
        # Register overdue invoice job
        if config.schedule_type == "cron":
            scheduler_manager.add_job(
                check_overdue_invoices_job,
                trigger='cron',
                cron_expression=config.schedule_value,
                job_id='check_overdue_invoices',
                name='Check Overdue Invoices'
            )
        elif config.schedule_type == "interval":
            hours = int(config.schedule_value)
            scheduler_manager.add_job(
                check_overdue_invoices_job,
                trigger='interval',
                hours=hours,
                job_id='check_overdue_invoices',
                name='Check Overdue Invoices'
            )
        
        # Start scheduler
        scheduler_manager.start()
        
        logger.info("Scheduler started successfully")
    
    except Exception as e:
        logger.error(f"Failed to initialize scheduler: {e}", exc_info=True)
        # Don't fail application startup if scheduler fails
        scheduler_manager = None


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown Redis and scheduler on application shutdown."""
    global scheduler_manager
    
    # Shutdown Redis connection
    try:
        logger.info("Shutting down Redis connection...")
        await shutdown_redis()
        logger.info("Redis shutdown successfully")
    except Exception as e:
        logger.error(f"Error shutting down Redis: {e}", exc_info=True)
    
    # Shutdown scheduler
    if scheduler_manager:
        try:
            logger.info("Shutting down scheduler...")
            scheduler_manager.shutdown(wait=True)
            logger.info("Scheduler shutdown successfully")
        except Exception as e:
            logger.error(f"Error shutting down scheduler: {e}", exc_info=True)

    
    # Shutdown Redis connection
    try:
        logger.info("Shutting down Redis connection...")
        await shutdown_redis()
        logger.info("Redis shutdown successfully")
    except Exception as e:
        logger.error(f"Error shutting down Redis: {e}", exc_info=True)
    
    # Shutdown scheduler
    if scheduler_manager:
        try:
            logger.info("Shutting down scheduler...")
            scheduler_manager.shutdown(wait=True)
            logger.info("Scheduler shutdown successfully")
        except Exception as e:
            logger.error(f"Error shutting down scheduler: {e}", exc_info=True)

