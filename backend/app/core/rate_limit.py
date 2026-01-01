"""Rate limiting configuration for API endpoints."""

from starlette.requests import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def get_client_ip(request: Request) -> str:
    """Get the client IP address from the request.
    
    Handles X-Forwarded-For header for reverse proxy setups.
    Note: In production, ensure this is only used behind a trusted reverse proxy
    to prevent IP spoofing. The proxy should be configured to set X-Forwarded-For.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # Take the first IP (client IP) from the chain
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)


# Create limiter instance
limiter = Limiter(key_func=get_client_ip)

# Rate limit configurations
AUTH_RATE_LIMIT = "5/minute"  # 5 login attempts per minute
REGISTER_RATE_LIMIT = "3/minute"  # 3 registration attempts per minute
PASSWORD_RESET_RATE_LIMIT = "3/minute"  # 3 password reset requests per minute
API_RATE_LIMIT = "100/minute"  # General API rate limit
