"""Test configuration and fixtures."""

import os
import pytest
from fastapi.testclient import TestClient

# Set test environment variables BEFORE importing app modules
os.environ.setdefault("SECRET_KEY", "test-secret-key-32-bytes-minimum")
# Use the production database URL for tests that need database access
# Property tests that don't need database will not use this
os.environ.setdefault("DATABASE_URL", os.getenv("DATABASE_URL", "sqlite:///./test.db"))

from app.main import app


@pytest.fixture
def client():
    """Create a test client for the FastAPI application."""
    return TestClient(app)


@pytest.fixture
def api_prefix():
    """Return the API prefix."""
    return "/api/v1"
