"""Initialize test database with all tables."""

import os

# Set test database URL before importing anything else
os.environ["DATABASE_URL"] = "sqlite:///./test.db"

from app.core.database import engine, Base
from app.models import *  # Import all models to register them with Base

def init_test_db():
    """Create all tables in the test database."""
    print("Creating all tables in test database...")
    Base.metadata.create_all(bind=engine)
    print("Test database initialized successfully!")

if __name__ == "__main__":
    init_test_db()
