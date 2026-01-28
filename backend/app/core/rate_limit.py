"""Rate limiting configuration for API endpoints."""

import os
from starlette.requests import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


# Trusted proxy IPs (configure based on your infrastructure)
# In production, set TRUSTED_PROXY_IPS environment variable
TRUSTED_PROXIES = set(
    os.getenv("TRUSTED_PROXY_IPS", "127.0.0.1,10.0.0.0/8").split(",")
)


def get_client_ip(request: Request) -> str:
    """Get the client IP address from the request.
    
    Handles X-Forwarded-For header for reverse proxy setups ONLY if request
    comes from a trusted proxy to prevent IP spoofing attacks.
    
    Security:
    - Only trusts X-Forwarded-For from known proxy IPs
    - Prevents attackers from bypassing rate limits by spoofing headers
    - In production, configure TRUSTED_PROXY_IPS environment variable
    
    Note: Ensure your reverse proxy (nginx, traefik, etc.) is configured to:
    1. Set X-Forwarded-For header correctly
    2. Strip any client-provided X-Forwarded-For headers
    """
    real_ip = get_remote_address(request)
    
    # Only trust X-Forwarded-For if request is from a known proxy
    if real_ip in TRUSTED_PROXIES:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            # Take the first IP (client IP) from the chain
            client_ip = forwarded.split(",")[0].strip()
            return client_ip
    
    # Return direct connection IP if not from trusted proxy
    return real_ip


# Create limiter instance
limiter = Limiter(key_func=get_client_ip)

# Rate limit configurations (stricter limits for security)
AUTH_RATE_LIMIT = "5/minute"           # 5 login attempts per minute
REGISTER_RATE_LIMIT = "3/minute"       # 3 registration attempts per minute
PASSWORD_RESET_RATE_LIMIT = "3/hour"   # 3 password reset requests per hour (stricter)
EMAIL_VERIFY_RATE_LIMIT = "10/hour"    # 10 email verification attempts per hour
API_RATE_LIMIT = "100/minute"          # General API rate limit
OAUTH_RATE_LIMIT = "10/minute"         # OAuth callback rate limit
