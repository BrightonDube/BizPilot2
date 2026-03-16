import pytest
from unittest.mock import MagicMock, AsyncMock
from fastapi import Request, HTTPException

from app.middleware.rate_limiting import (
    check_rate_limit,
    rate_limit_auth_endpoint
)

@pytest.mark.asyncio
async def test_rate_limit_allows_requests_within_limit():
    mock_redis = AsyncMock()
    # First request: get returns None, pipeline execute returns [1]
    mock_redis.get.return_value = None
    
    # Make pipeline a regular MagicMock so it's not a coroutine
    mock_redis.pipeline = MagicMock()
    mock_pipeline = MagicMock()
    mock_pipeline.execute = AsyncMock(return_value=[1])
    mock_redis.pipeline.return_value = mock_pipeline
    
    allowed, remaining = await check_rate_limit("test_key", 5, 60, mock_redis)
    assert allowed is True
    assert remaining == 4

@pytest.mark.asyncio
async def test_rate_limit_blocks_requests_exceeding_limit():
    mock_redis = AsyncMock()
    # Limit exceeded: get returns "5"
    mock_redis.get.return_value = "5"
    mock_redis.ttl.return_value = 30
    
    allowed, retry_after = await check_rate_limit("test_key", 5, 60, mock_redis)
    assert allowed is False
    assert retry_after == 30

@pytest.mark.asyncio
async def test_auth_endpoint_rate_limit_by_ip():
    request = MagicMock(spec=Request)
    request.client.host = "1.2.3.4"
    mock_redis = AsyncMock()
    
    # Simulate blocked request
    mock_redis.get.return_value = "5"
    mock_redis.ttl.return_value = 45
    
    with pytest.raises(HTTPException) as exc_info:
        await rate_limit_auth_endpoint(request, redis=mock_redis)
    
    assert exc_info.value.status_code == 429
    assert exc_info.value.headers["Retry-After"] == "45"

@pytest.mark.asyncio
async def test_rate_limit_uses_redis_not_memory():
    # This is implicitly tested by the fact that we mock redis and expect calls to it
    mock_redis = AsyncMock()
    mock_redis.pipeline = MagicMock()
    mock_pipeline = MagicMock()
    mock_pipeline.execute = AsyncMock(return_value=[1])
    mock_redis.pipeline.return_value = mock_pipeline

    await check_rate_limit("test_key", 5, 60, mock_redis)
    assert mock_redis.get.called
    assert mock_redis.pipeline.called

@pytest.mark.asyncio
async def test_rate_limit_window_resets_after_expiry():
    mock_redis = AsyncMock()
    # First time, get returns "5", so blocked
    mock_redis.get.return_value = "5"
    mock_redis.ttl.return_value = 0 # Should have expired
    
    mock_redis.pipeline = MagicMock()
    mock_pipeline = MagicMock()
    mock_pipeline.execute = AsyncMock(return_value=[1])
    mock_redis.pipeline.return_value = mock_pipeline

    # If we simulate expiry by making get return None next time
    mock_redis.get.side_effect = ["5", None]
    
    # First call: blocked
    allowed, _ = await check_rate_limit("test_key", 5, 60, mock_redis)
    assert allowed is False
    
    # Second call: allowed (simulated reset)
    allowed, _ = await check_rate_limit("test_key", 5, 60, mock_redis)
    assert allowed is True
