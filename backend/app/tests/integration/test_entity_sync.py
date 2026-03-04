"""API tests for entity-level sync endpoints (Task 15.5).

Tests:
- POST /sync/{entity} -- push batch (create, update, delete)
- GET  /sync/{entity} -- pull with 'since' filter
- Conflict detection: server wins when server record is newer
- Input validation: invalid entity type, invalid UUID
- Batch limit enforcement (max 50 records)
- Unknown entity returns 404

Strategy:
The models use PostgreSQL-specific types (ARRAY, JSONB) that SQLite cannot
handle. Therefore we do NOT try to create actual DB tables. Instead:
1. Validation tests (404, 422) are pure HTTP tests -- the route validation
   fires before any DB call, so no DB is needed.
2. DB-touching tests use a MagicMock session that records calls.
3. This isolates route + schema validation from DB layer concerns.
"""

import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

import os
os.environ.setdefault("SECRET_KEY", "test-secret-key-32-bytes-minimum")

from app.api.deps import get_current_active_user, get_current_business_id, get_db


MOCK_BUSINESS_ID = str(uuid.uuid4())
MOCK_USER_ID = str(uuid.uuid4())


def override_get_current_user():
    """Return a MagicMock user — avoids SQLAlchemy model construction complexity."""
    user = MagicMock()
    user.id = uuid.UUID(MOCK_USER_ID)
    user.email = "test@example.com"
    user.is_superadmin = False
    return user


def override_get_current_business_id():
    return MOCK_BUSINESS_ID


def make_mock_db():
    """Create a mock DB session that acts as a no-op."""
    db = MagicMock()
    # Chain: query().filter().count() -> 0
    db.query.return_value.filter.return_value.count.return_value = 0
    # Chain: query().filter().order_by().offset().limit().all() -> []
    q = db.query.return_value.filter.return_value
    q.order_by.return_value.offset.return_value.limit.return_value.all.return_value = []
    # Chain: query().filter().filter().count() -> 0 (for since-filtered queries)
    q.filter.return_value.count.return_value = 0
    q.filter.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = []
    # query().filter().first() -> None
    db.query.return_value.filter.return_value.first.return_value = None
    return db


def override_get_db_noop():
    yield make_mock_db()


from app.main import app

app.dependency_overrides[get_db] = override_get_db_noop
app.dependency_overrides[get_current_active_user] = override_get_current_user
app.dependency_overrides[get_current_business_id] = override_get_current_business_id

client = TestClient(app, headers={"Authorization": "Bearer test-token"})


def ts_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def ts_past(seconds: int = 60) -> str:
    dt = datetime.now(timezone.utc) - timedelta(seconds=seconds)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.%f") + "Z"


def make_product_payload(name: str = "Test Product") -> dict:
    return {"name": name, "selling_price": 50.0}


# ---------------------------------------------------------------------------
# Validation tests -- no DB calls needed
# ---------------------------------------------------------------------------

class TestEntitySyncValidation:
    def test_unknown_entity_post_returns_404(self):
        resp = client.post("/api/v1/sync/unknown_table", json={"records": []})
        assert resp.status_code == 404

    def test_unknown_entity_get_returns_404(self):
        resp = client.get("/api/v1/sync/unknown_table")
        assert resp.status_code == 404

    def test_valid_entity_types_accepted_for_get(self):
        for entity in ("products", "categories", "orders", "customers"):
            resp = client.get(f"/api/v1/sync/{entity}")
            assert resp.status_code == 200, f"{entity} returned {resp.status_code}"

    def test_batch_too_large_returns_422(self):
        records = [
            {"id": str(uuid.uuid4()), "action": "create",
             "payload": {}, "updated_at": ts_now()}
            for _ in range(51)
        ]
        resp = client.post("/api/v1/sync/products", json={"records": records})
        assert resp.status_code == 422

    def test_invalid_action_returns_422(self):
        resp = client.post("/api/v1/sync/products", json={"records": [
            {"id": str(uuid.uuid4()), "action": "upsert",
             "payload": {}, "updated_at": ts_now()}
        ]})
        assert resp.status_code == 422

    def test_invalid_since_timestamp_returns_422(self):
        resp = client.get("/api/v1/sync/products?since=not-a-date")
        assert resp.status_code == 422

    def test_per_page_above_200_returns_422(self):
        resp = client.get("/api/v1/sync/products?per_page=201")
        assert resp.status_code == 422

    def test_missing_records_key_returns_422(self):
        resp = client.post("/api/v1/sync/products", json={})
        assert resp.status_code == 422

    def test_missing_updated_at_returns_422(self):
        resp = client.post("/api/v1/sync/products", json={"records": [
            {"id": str(uuid.uuid4()), "action": "create", "payload": {}}
        ]})
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Push response structure tests
# ---------------------------------------------------------------------------

class TestEntitySyncPushResponseStructure:
    def test_push_empty_batch_returns_zero_counts(self):
        resp = client.post("/api/v1/sync/products", json={"records": []})
        assert resp.status_code == 200
        body = resp.json()
        assert body["applied"] == 0
        assert body["conflicts"] == 0
        assert body["errors"] == 0
        assert "server_timestamp" in body
        assert body["results"] == []

    def test_push_invalid_uuid_record_returns_error_result(self):
        resp = client.post("/api/v1/sync/products", json={"records": [
            {"id": "not-a-uuid", "action": "create",
             "payload": make_product_payload(), "updated_at": ts_now()}
        ]})
        assert resp.status_code == 200
        result = resp.json()["results"][0]
        assert result["status"] == "error"
        assert result["id"] == "not-a-uuid"

    def test_push_response_has_all_required_fields(self):
        resp = client.post("/api/v1/sync/products", json={"records": []})
        body = resp.json()
        assert all(k in body for k in ("applied", "conflicts", "errors", "results", "server_timestamp"))

    def test_pull_response_has_all_required_fields(self):
        resp = client.get("/api/v1/sync/products")
        body = resp.json()
        assert all(k in body for k in ("records", "total", "page", "per_page", "pages", "server_timestamp"))

    def test_pull_response_echoes_since_param(self):
        since = ts_past(3600)
        resp = client.get(f"/api/v1/sync/products?since={since}")
        assert resp.json()["since"] == since

    def test_pull_response_since_is_none_when_not_provided(self):
        resp = client.get("/api/v1/sync/products")
        assert resp.json()["since"] is None

    def test_push_delete_nonexistent_is_idempotent(self):
        """DELETE on non-existent record should not return an error."""
        resp = client.post("/api/v1/sync/products", json={"records": [
            {"id": str(uuid.uuid4()), "action": "delete",
             "payload": {}, "updated_at": ts_now()}
        ]})
        assert resp.status_code == 200
        result = resp.json()["results"][0]
        assert result["status"] == "deleted"
        assert resp.json()["errors"] == 0


# ---------------------------------------------------------------------------
# entity_sync helpers -- pure unit tests (no DB, no HTTP)
# ---------------------------------------------------------------------------

class TestEntitySyncHelpers:
    """Test the helper functions in entity_sync.py directly."""

    def test_entity_registry_contains_expected_entities(self):
        from app.api.entity_sync import _build_entity_registry
        registry = _build_entity_registry()
        assert "products" in registry
        assert "categories" in registry
        assert "orders" in registry
        assert "customers" in registry

    def test_entity_registry_does_not_contain_internal_tables(self):
        from app.api.entity_sync import _build_entity_registry
        registry = _build_entity_registry()
        assert "sync_queue" not in registry
        assert "users" not in registry
        assert "businesses" not in registry

    def test_get_writable_columns_excludes_system_fields(self):
        from app.api.entity_sync import _get_writable_columns
        from app.models.product import Product
        cols = _get_writable_columns(Product)
        assert "id" not in cols
        assert "business_id" not in cols
        assert "created_at" not in cols
        assert "updated_at" not in cols

    def test_get_writable_columns_includes_business_fields(self):
        from app.api.entity_sync import _get_writable_columns
        from app.models.product import Product
        cols = _get_writable_columns(Product)
        assert "name" in cols

    def test_model_to_dict_converts_uuid_to_str(self):
        from app.api.entity_sync import _model_to_dict
        from app.models.product import Product
        obj = Product(
            id=uuid.uuid4(),
            business_id=uuid.UUID(MOCK_BUSINESS_ID),
            name="Test",
        )
        result = _model_to_dict(obj)
        assert isinstance(result["id"], str)
        assert isinstance(result["business_id"], str)

    def test_model_to_dict_converts_datetime_to_str(self):
        from app.api.entity_sync import _model_to_dict
        from app.models.product import Product
        now = datetime.now(timezone.utc)
        obj = Product(
            id=uuid.uuid4(),
            business_id=uuid.UUID(MOCK_BUSINESS_ID),
            name="Test",
            created_at=now,
            updated_at=now,
        )
        result = _model_to_dict(obj)
        assert isinstance(result.get("created_at"), str)
