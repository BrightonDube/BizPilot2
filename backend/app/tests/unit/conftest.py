"""Conftest for unit tests with database fixtures."""

import pytest

from app.core.database import get_db


@pytest.fixture(scope="function")
def db_session():
    """Create a test database session using the actual database."""
    # Use the database from the application
    db = next(get_db())
    try:
        yield db
    finally:
        db.rollback()  # Rollback any changes made during the test
        db.close()
