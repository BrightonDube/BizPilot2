"""Conftest for unit tests with database fixtures."""

import pytest



@pytest.fixture(scope="function")
def db_session():
    """Create a test database session using the actual database."""
    # Use the sync database session for tests (works with both PostgreSQL and SQLite)
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        yield db
    finally:
        db.rollback()  # Rollback any changes made during the test
        db.close()
