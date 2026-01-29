# Database Layer Improvements

## Summary of Changes

The database layer has been refactored to improve consistency, maintainability, and performance. Key improvements include:

1. **Proper async/sync separation** with clear naming
2. **URL normalization** to handle driver specifications correctly
3. **Consistent pool configuration** across engines
4. **Type hints** for better IDE support
5. **Connection monitoring** via SQLAlchemy events
6. **Transaction management** with automatic commit/rollback

## Breaking Changes

### Function Naming

- `get_async_db()` → `get_db()` (now returns AsyncSession for PostgreSQL)
- `get_db()` → `get_sync_db()` (for legacy sync code)

### For PostgreSQL (Production)

**Before:**
```python
from app.core.database import get_db

@router.get("/items")
async def get_items(db: Session = Depends(get_db)):  # Sync session
    return db.query(Item).all()  # Blocks event loop!
```

**After:**
```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db

@router.get("/items")
async def get_items(db: AsyncSession = Depends(get_db)):  # Async session
    result = await db.execute(select(Item))
    return result.scalars().all()  # Non-blocking!
```

### For SQLite (Tests)

No changes needed - `get_db()` still returns sync Session for SQLite.

## Migration Guide

### Step 1: Update Imports

```python
# Old
from sqlalchemy.orm import Session
from app.core.database import get_db

# New (for async endpoints)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db

# New (for legacy sync code)
from sqlalchemy.orm import Session
from app.core.database import get_sync_db
```

### Step 2: Convert Query Patterns

#### Simple Queries

**Before:**
```python
async def get_user(user_id: UUID, db: Session = Depends(get_db)):
    return db.query(User).filter(User.id == user_id).first()
```

**After:**
```python
async def get_user(user_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
```

#### List Queries

**Before:**
```python
async def list_users(db: Session = Depends(get_db)):
    return db.query(User).filter(User.is_active == True).all()
```

**After:**
```python
async def list_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.is_active == True)
    )
    return result.scalars().all()
```

#### Joins

**Before:**
```python
async def get_user_with_business(user_id: UUID, db: Session = Depends(get_db)):
    return db.query(User).join(Business).filter(User.id == user_id).first()
```

**After:**
```python
async def get_user_with_business(user_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User)
        .join(Business)
        .where(User.id == user_id)
    )
    return result.scalar_one_or_none()
```

#### Create/Update/Delete

**Before:**
```python
async def create_user(data: UserCreate, db: Session = Depends(get_db)):
    user = User(**data.dict())
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
```

**After:**
```python
async def create_user(data: UserCreate, db: AsyncSession = Depends(get_db)):
    user = User(**data.dict())
    db.add(user)
    await db.flush()  # Get ID without committing
    await db.refresh(user)  # Load relationships
    # Commit happens automatically in get_db()
    return user
```

### Step 3: Update Tests

Tests using SQLite don't need changes, but if you're testing with PostgreSQL:

```python
# conftest.py
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

@pytest.fixture
async def async_db_session():
    """Async database session for testing."""
    engine = create_async_engine("postgresql+asyncpg://...")
    SessionLocal = async_sessionmaker(engine, class_=AsyncSession)
    
    async with SessionLocal() as session:
        yield session
        await session.rollback()
```

## Performance Benefits

### Before (Sync)
- Each database query blocks the event loop
- Concurrent requests wait for database operations
- Limited scalability under load

### After (Async)
- Database queries don't block the event loop
- Concurrent requests can be processed while waiting for DB
- Better scalability and throughput

## Rollback Plan

If you need to rollback to sync sessions temporarily:

1. Use `get_sync_db()` instead of `get_db()`
2. Change type hints back to `Session`
3. Remove `await` from database operations

## Common Pitfalls

### 1. Forgetting `await`
```python
# ❌ Wrong
result = db.execute(select(User))

# ✅ Correct
result = await db.execute(select(User))
```

### 2. Using `.query()` with AsyncSession
```python
# ❌ Wrong (query() doesn't exist on AsyncSession)
users = await db.query(User).all()

# ✅ Correct
result = await db.execute(select(User))
users = result.scalars().all()
```

### 3. Manual commit/rollback
```python
# ❌ Wrong (get_db() handles this)
await db.commit()

# ✅ Correct (just let get_db() handle it)
# Commits automatically on success, rolls back on exception
```

## Testing the Changes

Run the test suite to ensure everything works:

```bash
# Backend tests
cd backend
pytest

# Check for any sync/async issues
pytest -v -k "test_database"
```

## Questions?

If you encounter issues during migration:
1. Check the error message for `await` keywords
2. Verify you're using `AsyncSession` type hints
3. Ensure you're using `select()` instead of `.query()`
4. Check that relationships are properly configured for async loading
