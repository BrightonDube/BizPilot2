"""Simple in-memory cache for dashboard statistics."""

from datetime import datetime, timedelta
from typing import Any, Dict, Optional
from functools import wraps
import hashlib
import json


class SimpleCache:
    """Thread-safe in-memory cache with TTL support."""
    
    def __init__(self):
        self._cache: Dict[str, tuple[Any, datetime]] = {}
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired."""
        if key in self._cache:
            value, expires_at = self._cache[key]
            if datetime.now() < expires_at:
                return value
            # Expired - remove it
            del self._cache[key]
        return None
    
    def set(self, key: str, value: Any, ttl_seconds: int = 60) -> None:
        """Set value in cache with TTL."""
        expires_at = datetime.now() + timedelta(seconds=ttl_seconds)
        self._cache[key] = (value, expires_at)
    
    def delete(self, key: str) -> None:
        """Delete key from cache."""
        self._cache.pop(key, None)
    
    def clear_prefix(self, prefix: str) -> None:
        """Clear all keys starting with prefix."""
        keys_to_delete = [k for k in self._cache.keys() if k.startswith(prefix)]
        for key in keys_to_delete:
            del self._cache[key]
    
    def clear_all(self) -> None:
        """Clear entire cache."""
        self._cache.clear()


# Global cache instance
dashboard_cache = SimpleCache()


def cache_key(prefix: str, *args) -> str:
    """Generate a cache key from prefix and arguments."""
    key_data = json.dumps(args, sort_keys=True, default=str)
    hash_part = hashlib.md5(key_data.encode()).hexdigest()[:12]
    return f"{prefix}:{hash_part}"


def cached_response(prefix: str, ttl_seconds: int = 30):
    """
    Decorator to cache endpoint responses.
    
    Usage:
        @cached_response("dashboard_stats", ttl_seconds=60)
        async def get_dashboard_stats(business_id: str, ...):
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract business_id from kwargs for cache key
            business_id = kwargs.get('business_id') or (
                kwargs.get('current_user').id if 'current_user' in kwargs else None
            )
            key = cache_key(prefix, business_id)
            
            # Check cache
            cached = dashboard_cache.get(key)
            if cached is not None:
                return cached
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Cache result
            dashboard_cache.set(key, result, ttl_seconds)
            
            return result
        return wrapper
    return decorator
