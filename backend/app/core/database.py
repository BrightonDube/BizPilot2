"""Database configuration and session management."""

import logging
from typing import AsyncGenerator, Generator
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker, declarative_base
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import Pool

from app.core.config import settings

logger = logging.getLogger(__name__)

# Determine if we're using SQLite or PostgreSQL
is_sqlite = settings.DATABASE_URL.startswith("sqlite")
is_async_supported = not is_sqlite  # SQLite in tests uses sync


def _normalize_db_url(url: str, driver: str) -> str:
    """
    Normalize database URL to use the specified driver.
    
    Args:
        url: Original database URL
        driver: Target driver (e.g., 'asyncpg', 'psycopg')
    
    Returns:
        Normalized URL with correct driver
    """
    # Remove existing driver specifications
    url = url.replace("postgresql+asyncpg://", "postgresql://")
    url = url.replace("postgresql+psycopg://", "postgresql://")
    
    # Add new driver
    return url.replace("postgresql://", f"postgresql+{driver}://")


@event.listens_for(Pool, "connect")
def _on_connect(dbapi_conn, connection_record):
    """Log successful database connections."""
    logger.debug("Database connection established")


@event.listens_for(Pool, "checkout")
def _on_checkout(dbapi_conn, connection_record, connection_proxy):
    """Log connection checkout from pool."""
    logger.debug("Connection checked out from pool")


if is_async_supported:
    # PostgreSQL with async support
    async_db_url = _normalize_db_url(settings.DATABASE_URL, "asyncpg")
    sync_db_url = _normalize_db_url(settings.DATABASE_URL, "psycopg")
    
    # Shared pool configuration
    POOL_CONFIG = {
        "pool_pre_ping": True,
        "pool_size": 10,
        "max_overflow": 20,
        "pool_recycle": 3600,  # Recycle connections after 1 hour
        "pool_timeout": 30,    # Wait 30s for connection
    }
    
    # Create async engine for PostgreSQL (primary for API endpoints)
    async_engine = create_async_engine(
        async_db_url,
        **POOL_CONFIG,
        echo=settings.DEBUG,
    )
    
    # Create async session factory
    AsyncSessionLocal = async_sessionmaker(
        async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    
    # Create sync engine for migrations and legacy code
    sync_engine = create_engine(
        sync_db_url,
        **POOL_CONFIG,
        echo=settings.DEBUG,
    )
    
    SessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=sync_engine
    )
    
    # Alembic uses sync engine
    engine = sync_engine
    
    async def get_db() -> AsyncGenerator[AsyncSession, None]:
        """
        Async dependency to get database session for API endpoints.
        
        Usage:
            @router.get("/items")
            async def get_items(db: AsyncSession = Depends(get_db)):
                result = await db.execute(select(Item))
                return result.scalars().all()
        """
        async with AsyncSessionLocal() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()
    
    def get_sync_db() -> Generator[Session, None, None]:
        """
        Sync dependency for legacy code and migrations.
        
        Note: Prefer get_db() for new code to avoid blocking the event loop.
        """
        db = SessionLocal()
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

else:
    # SQLite fallback for tests (sync only)
    connect_args = {"check_same_thread": False}
    
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args=connect_args,
        pool_pre_ping=True,
        echo=settings.DEBUG,
    )
    
    SessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine
    )
    
    def get_db() -> Generator[Session, None, None]:
        """
        Sync dependency for SQLite (tests only).
        
        Usage:
            @router.get("/items")
            def get_items(db: Session = Depends(get_db)):
                return db.query(Item).all()
        """
        db = SessionLocal()
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()
    
    # No async support for SQLite - use sync get_db for both
    async_engine = None
    AsyncSessionLocal = None
    get_sync_db = get_db  # For SQLite, sync db works for both

# Base class for models
Base = declarative_base()
