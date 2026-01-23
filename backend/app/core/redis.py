"""Redis connection and caching utilities.

Feature: granular-permissions-subscription
Task: 4.1 Add Redis connection setup
Requirements: 17.1, 17.4
"""

import os
import logging
from typing import Optional
from redis import asyncio as aioredis
from redis.asyncio import Redis
from redis.exceptions import RedisError, ConnectionError as RedisConnectionError

logger = logging.getLogger(__name__)


class RedisManager:
    """
    Redis connection manager with fallback support.
    
    Provides:
    - Connection pooling
    - Automatic reconnection
    - Graceful fallback when Redis is unavailable
    - Dependency injection for FastAPI
    
    Validates: Requirements 17.1, 17.4
    """
    
    def __init__(self):
        self._redis: Optional[Redis] = None
        self._available = False
    
    async def connect(self) -> None:
        """
        Initialize Redis connection pool.
        
        Attempts to connect to Redis. If connection fails, logs warning
        and sets _available to False for fallback mode.
        """
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        
        try:
            self._redis = await aioredis.from_url(
                redis_url,
                encoding="utf-8",
                decode_responses=True,
                max_connections=10,
                socket_connect_timeout=5,
                socket_timeout=5,
            )
            
            # Test connection
            await self._redis.ping()
            self._available = True
            logger.info(f"Redis connected successfully: {redis_url}")
            
        except (RedisError, RedisConnectionError, Exception) as e:
            logger.warning(
                f"Redis connection failed: {e}. "
                "Falling back to direct database queries."
            )
            self._redis = None
            self._available = False
    
    async def disconnect(self) -> None:
        """Close Redis connection pool."""
        if self._redis:
            await self._redis.close()
            self._redis = None
            self._available = False
            logger.info("Redis disconnected")
    
    def is_available(self) -> bool:
        """Check if Redis is available."""
        return self._available
    
    async def get(self, key: str) -> Optional[str]:
        """
        Get value from Redis.
        
        Returns None if Redis is unavailable or key doesn't exist.
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None
        """
        if not self._available or not self._redis:
            return None
        
        try:
            return await self._redis.get(key)
        except (RedisError, Exception) as e:
            logger.warning(f"Redis GET failed for key {key}: {e}")
            return None
    
    async def set(
        self,
        key: str,
        value: str,
        ttl_seconds: Optional[int] = None
    ) -> bool:
        """
        Set value in Redis with optional TTL.
        
        Args:
            key: Cache key
            value: Value to cache (as string)
            ttl_seconds: Time-to-live in seconds (None = no expiry)
            
        Returns:
            True if successful, False otherwise
        """
        if not self._available or not self._redis:
            return False
        
        try:
            if ttl_seconds:
                await self._redis.setex(key, ttl_seconds, value)
            else:
                await self._redis.set(key, value)
            return True
        except (RedisError, Exception) as e:
            logger.warning(f"Redis SET failed for key {key}: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        """
        Delete key from Redis.
        
        Args:
            key: Cache key to delete
            
        Returns:
            True if successful, False otherwise
        """
        if not self._available or not self._redis:
            return False
        
        try:
            await self._redis.delete(key)
            return True
        except (RedisError, Exception) as e:
            logger.warning(f"Redis DELETE failed for key {key}: {e}")
            return False
    
    async def delete_pattern(self, pattern: str) -> int:
        """
        Delete all keys matching a pattern.
        
        Args:
            pattern: Key pattern (e.g., "permissions:*")
            
        Returns:
            Number of keys deleted
        """
        if not self._available or not self._redis:
            return 0
        
        try:
            keys = []
            async for key in self._redis.scan_iter(match=pattern):
                keys.append(key)
            
            if keys:
                return await self._redis.delete(*keys)
            return 0
        except (RedisError, Exception) as e:
            logger.warning(f"Redis DELETE_PATTERN failed for pattern {pattern}: {e}")
            return 0
    
    def get_client(self) -> Optional[Redis]:
        """
        Get raw Redis client.
        
        Returns None if Redis is unavailable.
        Use this for advanced operations not covered by helper methods.
        """
        return self._redis if self._available else None


# Global Redis manager instance
redis_manager = RedisManager()


async def get_redis() -> Optional[Redis]:
    """
    FastAPI dependency to get Redis client.
    
    Returns None if Redis is unavailable (fallback mode).
    
    Usage:
        @router.get("/endpoint")
        async def endpoint(redis: Optional[Redis] = Depends(get_redis)):
            if redis:
                # Use Redis
                cached = await redis.get("key")
            else:
                # Fallback to database
                ...
    """
    return redis_manager.get_client()


async def startup_redis() -> None:
    """
    Startup event handler for Redis connection.
    
    Call this in FastAPI lifespan or startup event.
    """
    await redis_manager.connect()


async def shutdown_redis() -> None:
    """
    Shutdown event handler for Redis connection.
    
    Call this in FastAPI lifespan or shutdown event.
    """
    await redis_manager.disconnect()
