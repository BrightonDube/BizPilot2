"""Test configuration and fixtures."""

import os
import pytest
from fastapi.testclient import TestClient

# Set test environment variables BEFORE importing app modules
os.environ.setdefault("SECRET_KEY", "test-secret-key-32-bytes-minimum")
# Use PostgreSQL for tests - requires DATABASE_URL to be set in environment
# Tests will use the same database as development (ensure it exists)

from app.main import app


@pytest.fixture
def client():
    """Create a test client for the FastAPI application."""
    return TestClient(app)


@pytest.fixture
def api_prefix():
    """Return the API prefix."""
    return "/api/v1"
