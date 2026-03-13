"""Integration tests for mobile sync endpoint (Task 10.2).

Tests:
- Device registration on sync (Requirement 7.3)
- Permissions included in sync response (Requirement 7.3)
- Device limit rejection (Requirements 7.4, 7.5)
- Missing device headers return 400
- SuperAdmin bypasses device limits

Strategy:
Override FastAPI dependencies (auth, db, device limit, permissions) with
mock implementations. This isolates the endpoint's request/response
contract from the database layer.
"""

import uuid
from unittest.mock import MagicMock
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException, status

import os
os.environ.setdefault("SECRET_KEY", "test-secret-key-32-bytes-minimum")

from app.api.deps import (
    get_current_active_user,
    get_current_business_id,
    get_db,
    check_device_limit,
    get_permission_service,
)
from app.main import app

# ---------------------------------------------------------------------------
# Test data
# ---------------------------------------------------------------------------

MOCK_BUSINESS_ID = str(uuid.uuid4())
MOCK_USER_ID = str(uuid.uuid4())
MOCK_DEVICE_ID = "test-device-001"
MOCK_DEVICE_NAME = "iPad POS Terminal 1"


# ---------------------------------------------------------------------------
# Dependency overrides
# ---------------------------------------------------------------------------

def make_mock_user(is_superadmin: bool = False):
    """Create a mock user for dependency injection."""
    user = MagicMock()
    user.id = uuid.UUID(MOCK_USER_ID)
    user.email = "staff@hotel.com"
    user.is_superadmin = is_superadmin
    return user


def make_mock_permissions():
    """Standard business permissions with device limit."""
    return {
        "device_limit": 5,
        "features": ["pos", "pms", "reports"],
        "max_users": 10,
        "tier": "professional",
    }


def make_mock_device_record(device_id: str = MOCK_DEVICE_ID,
                             device_name: str = MOCK_DEVICE_NAME):
    """Device record returned by check_device_limit on success."""
    return {
        "device_id": device_id,
        "device_name": device_name,
        "is_active": True,
        "is_superadmin": False,
        "last_sync_time": None,
    }


def override_user():
    return make_mock_user()


def override_superadmin():
    return make_mock_user(is_superadmin=True)


def override_business_id():
    return MOCK_BUSINESS_ID


def override_db():
    yield MagicMock()


def override_device_ok():
    """Device limit check passes — returns device record."""
    return make_mock_device_record()


def override_device_limit_exceeded():
    """Device limit check fails — raises 403."""
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Device limit reached (5/5 devices). Contact support to increase your limit.",
    )


def override_device_missing_headers():
    """Device headers missing — raises 400."""
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Device ID and Device Name headers are required (X-Device-ID, X-Device-Name)",
    )


class MockPermissionService:
    """Mock permission service that returns test permissions."""

    async def get_business_permissions(self, business_id: str) -> dict:
        return make_mock_permissions()


def override_permission_service():
    return MockPermissionService()


# ---------------------------------------------------------------------------
# Test setup
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def setup_common_overrides():
    """Set common dependency overrides for all tests."""
    app.dependency_overrides[get_current_active_user] = override_user
    app.dependency_overrides[get_current_business_id] = override_business_id
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_permission_service] = override_permission_service
    yield
    app.dependency_overrides.clear()


client = TestClient(app, headers={"Authorization": "Bearer test-token"})

SYNC_ENDPOINT = "/api/v1/mobile/sync"


# ---------------------------------------------------------------------------
# Test: Device registration on sync (Requirement 7.3)
# ---------------------------------------------------------------------------

class TestDeviceRegistrationOnSync:
    """Tests that device registration works during sync."""

    def test_sync_returns_device_info(self):
        """Sync response includes device registration info."""
        app.dependency_overrides[check_device_limit] = override_device_ok

        response = client.post(
            SYNC_ENDPOINT,
            json={"last_sync_at": None},
            headers={
                "X-Device-ID": MOCK_DEVICE_ID,
                "X-Device-Name": MOCK_DEVICE_NAME,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "device" in data
        assert data["device"]["device_id"] == MOCK_DEVICE_ID
        assert data["device"]["device_name"] == MOCK_DEVICE_NAME
        assert data["device"]["is_active"] is True

    def test_sync_returns_sync_timestamp(self):
        """Sync response includes a valid ISO timestamp."""
        app.dependency_overrides[check_device_limit] = override_device_ok

        response = client.post(
            SYNC_ENDPOINT,
            json={"last_sync_at": None},
            headers={
                "X-Device-ID": MOCK_DEVICE_ID,
                "X-Device-Name": MOCK_DEVICE_NAME,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "sync_timestamp" in data
        # Verify it's a valid ISO 8601 timestamp
        datetime.fromisoformat(data["sync_timestamp"])


# ---------------------------------------------------------------------------
# Test: Permissions included in response (Requirement 7.3)
# ---------------------------------------------------------------------------

class TestPermissionsInSyncResponse:
    """Tests that permissions are included in the sync response."""

    def test_sync_includes_permissions(self):
        """Sync response includes business permissions."""
        app.dependency_overrides[check_device_limit] = override_device_ok

        response = client.post(
            SYNC_ENDPOINT,
            json={"last_sync_at": None},
            headers={
                "X-Device-ID": MOCK_DEVICE_ID,
                "X-Device-Name": MOCK_DEVICE_NAME,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "permissions" in data
        perms = data["permissions"]
        assert perms["device_limit"] == 5
        assert "features" in perms
        assert "pos" in perms["features"]

    def test_sync_permissions_include_tier(self):
        """Permissions include subscription tier information."""
        app.dependency_overrides[check_device_limit] = override_device_ok

        response = client.post(
            SYNC_ENDPOINT,
            json={"last_sync_at": None},
            headers={
                "X-Device-ID": MOCK_DEVICE_ID,
                "X-Device-Name": MOCK_DEVICE_NAME,
            },
        )

        assert response.status_code == 200
        perms = response.json()["permissions"]
        assert perms["tier"] == "professional"


# ---------------------------------------------------------------------------
# Test: Device limit rejection (Requirements 7.4, 7.5)
# ---------------------------------------------------------------------------

class TestDeviceLimitRejection:
    """Tests that device limit is enforced during sync."""

    def test_device_limit_returns_403(self):
        """Sync returns 403 when device limit is exceeded (Requirement 7.5)."""
        app.dependency_overrides[check_device_limit] = override_device_limit_exceeded

        response = client.post(
            SYNC_ENDPOINT,
            json={"last_sync_at": None},
            headers={
                "X-Device-ID": "new-device-006",
                "X-Device-Name": "Overflow Device",
            },
        )

        assert response.status_code == 403
        assert "device limit" in response.json()["detail"].lower()

    def test_missing_device_headers_returns_400(self):
        """Sync returns 400 when device headers are missing."""
        app.dependency_overrides[check_device_limit] = override_device_missing_headers

        response = client.post(
            SYNC_ENDPOINT,
            json={"last_sync_at": None},
        )

        assert response.status_code == 400
        assert "required" in response.json()["detail"].lower()

    def test_superadmin_bypasses_device_limit(self):
        """SuperAdmin can sync without device limit enforcement."""
        app.dependency_overrides[get_current_active_user] = override_superadmin
        # SuperAdmin override returns a device record directly
        app.dependency_overrides[check_device_limit] = lambda: {
            "device_id": "superadmin-device",
            "device_name": "SuperAdmin Device",
            "is_superadmin": True,
        }

        response = client.post(
            SYNC_ENDPOINT,
            json={"last_sync_at": None},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["device"]["is_superadmin"] is True
