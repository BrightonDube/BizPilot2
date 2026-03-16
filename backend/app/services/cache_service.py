import json
import logging
from typing import Callable, Optional, Type, TypeVar
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

T = TypeVar("T")

class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

async def get_cached_or_fetch(
    cache_key: str,
    fetch_fn: Callable,
    ttl_seconds: int,
    redis_client: Redis,
    response_model: Optional[Type[T]] = None
) -> T:
    """
    Generic cache-aside pattern: check cache, fetch if miss, store result.
    Performance: Cache hit under 5ms. Serializes as JSON.
    """
    if not redis_client:
        return await fetch_fn()

    try:
        cached_data = await redis_client.get(cache_key)
        if cached_data:
            data = json.loads(cached_data)
            if response_model:
                if isinstance(data, list):
                    return [response_model(**item) for item in data]
                return response_model(**data)
            return data
    except Exception as e:
        logger.warning(f"Cache hit failed for {cache_key}: {e}")

    # Cache miss
    data = await fetch_fn()
    
    try:
        # Serialize data
        if isinstance(data, BaseModel):
            serialized = data.model_dump_json()
        elif isinstance(data, list) and len(data) > 0 and isinstance(data[0], BaseModel):
            serialized = json.dumps([item.model_dump() for item in data], cls=DateTimeEncoder)
        else:
            serialized = json.dumps(data, cls=DateTimeEncoder)
            
        await redis_client.setex(cache_key, ttl_seconds, serialized)
    except Exception as e:
        logger.warning(f"Cache store failed for {cache_key}: {e}")
        
    return data

async def invalidate_business_cache(
    business_id: UUID, 
    cache_type: str, 
    redis_client: Redis
) -> None:
    """
    Invalidate all cache keys of a given type for a business.
    Called when data changes that would make cache stale.
    """
    if not redis_client:
        return

    pattern = f"bizpilot:{cache_type}:{business_id}:*"
    try:
        keys = []
        async for key in redis_client.scan_iter(match=pattern):
            keys.append(key)
        if keys:
            await redis_client.delete(*keys)
            
        # Also handle non-patterned keys
        await redis_client.delete(f"bizpilot:{cache_type}:{business_id}")
    except Exception as e:
        logger.error(f"Cache invalidation failed for {pattern}: {e}")

async def warm_dashboard_cache(
    business_id: UUID, 
    db: AsyncSession, 
    redis_client: Redis
) -> None:
    """
    Pre-populate dashboard cache for a business.
    """
    # This would call the dashboard fetch functions and store them
    # For now, we'll leave it as a placeholder or implement if needed
    pass
