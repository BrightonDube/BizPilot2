"""Test async database connection."""
import asyncio
import pytest
from app.core.database import get_db, async_engine
from sqlalchemy import text

@pytest.mark.asyncio
async def test_async_db():
    """Test async database connection."""
    if not async_engine:
        print("❌ Async engine not initialized (SQLite mode)")
        return
    
    print("✅ Testing async database connection...")
    async for session in get_db():
        result = await session.execute(text("SELECT 1 as test"))
        row = result.fetchone()
        print(f"✅ Async query successful: {row}")
        break

if __name__ == "__main__":
    asyncio.run(test_async_db())
