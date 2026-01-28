"""Synchronous database session for scripts and migrations.

This module provides a synchronous database connection using psycopg
for use in scripts, seeders, and other synchronous operations.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get the async DATABASE_URL and convert to sync
database_url = os.getenv("DATABASE_URL", "")

# Convert asyncpg to psycopg for synchronous operations
if "postgresql+asyncpg://" in database_url:
    sync_database_url = database_url.replace("postgresql+asyncpg://", "postgresql+psycopg://")
elif "postgresql://" in database_url:
    sync_database_url = database_url.replace("postgresql://", "postgresql+psycopg://")
else:
    # Fallback to original URL (might be SQLite for tests)
    sync_database_url = database_url

# Create synchronous engine
sync_engine = create_engine(
    sync_database_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=False,
)

# Create synchronous session factory
SyncSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=sync_engine,
)


def get_sync_db():
    """Get a synchronous database session."""
    db = SyncSessionLocal()
    try:
        yield db
    finally:
        db.close()
