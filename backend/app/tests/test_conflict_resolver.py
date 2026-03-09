import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

from datetime import datetime

import pytest

from app.services.conflict_resolver import (
    ConflictStrategy,
    DEFAULT_STRATEGIES,
    _parse_timestamp,
    resolve_conflict,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def server_data():
    return {"id": "s1", "name": "Server Item", "updated_at": "2025-01-10T12:00:00"}


@pytest.fixture
def client_data():
    return {"id": "c1", "name": "Client Item", "updated_at": "2025-01-10T14:00:00"}


# ---------------------------------------------------------------------------
# DEFAULT_STRATEGIES
# ---------------------------------------------------------------------------

class TestDefaultStrategies:
    """Verify the built-in strategy mapping."""

    @pytest.mark.parametrize("entity", ["orders", "products", "inventory", "invoices"])
    def test_server_wins_entities(self, entity):
        assert DEFAULT_STRATEGIES[entity] == ConflictStrategy.SERVER_WINS

    @pytest.mark.parametrize("entity", ["customers", "suppliers", "drafts"])
    def test_client_wins_entities(self, entity):
        assert DEFAULT_STRATEGIES[entity] == ConflictStrategy.CLIENT_WINS


# ---------------------------------------------------------------------------
# resolve_conflict – explicit strategies
# ---------------------------------------------------------------------------

class TestResolveConflictExplicit:
    """Tests where the strategy is passed explicitly."""

    def test_server_wins_returns_server_data(self, server_data, client_data):
        result = resolve_conflict(
            "any", server_data, client_data, strategy=ConflictStrategy.SERVER_WINS
        )
        assert result is server_data

    def test_client_wins_returns_client_data(self, server_data, client_data):
        result = resolve_conflict(
            "any", server_data, client_data, strategy=ConflictStrategy.CLIENT_WINS
        )
        assert result is client_data

    def test_unknown_strategy_falls_back_to_server_wins(self, server_data, client_data):
        result = resolve_conflict(
            "any", server_data, client_data, strategy="bogus_strategy"
        )
        assert result is server_data


# ---------------------------------------------------------------------------
# resolve_conflict – default strategies (no explicit override)
# ---------------------------------------------------------------------------

class TestResolveConflictDefaults:
    """Tests that use the DEFAULT_STRATEGIES mapping."""

    def test_orders_default_server_wins(self, server_data, client_data):
        result = resolve_conflict("orders", server_data, client_data)
        assert result is server_data

    def test_customers_default_client_wins(self, server_data, client_data):
        result = resolve_conflict("customers", server_data, client_data)
        assert result is client_data

    def test_unknown_entity_defaults_to_server_wins(self, server_data, client_data):
        result = resolve_conflict("unknown_entity", server_data, client_data)
        assert result is server_data


# ---------------------------------------------------------------------------
# resolve_conflict – last_write_wins
# ---------------------------------------------------------------------------

class TestResolveConflictLastWriteWins:
    """Tests for the last_write_wins timestamp comparison."""

    def test_client_newer_returns_client(self):
        server = {"updated_at": "2025-01-10T10:00:00"}
        client = {"updated_at": "2025-01-10T12:00:00"}
        result = resolve_conflict(
            "x", server, client, strategy=ConflictStrategy.LAST_WRITE_WINS
        )
        assert result is client

    def test_server_newer_returns_server(self):
        server = {"updated_at": "2025-01-10T14:00:00"}
        client = {"updated_at": "2025-01-10T12:00:00"}
        result = resolve_conflict(
            "x", server, client, strategy=ConflictStrategy.LAST_WRITE_WINS
        )
        assert result is server

    def test_equal_timestamps_server_wins(self):
        ts = "2025-01-10T12:00:00"
        server = {"updated_at": ts}
        client = {"updated_at": ts}
        result = resolve_conflict(
            "x", server, client, strategy=ConflictStrategy.LAST_WRITE_WINS
        )
        assert result is server

    def test_both_timestamps_none_server_wins(self):
        server = {"updated_at": None}
        client = {"updated_at": None}
        result = resolve_conflict(
            "x", server, client, strategy=ConflictStrategy.LAST_WRITE_WINS
        )
        assert result is server

    def test_server_timestamp_none_client_wins(self):
        server = {"updated_at": None}
        client = {"updated_at": "2025-01-10T12:00:00"}
        result = resolve_conflict(
            "x", server, client, strategy=ConflictStrategy.LAST_WRITE_WINS
        )
        assert result is client

    def test_client_timestamp_none_server_wins(self):
        server = {"updated_at": "2025-01-10T12:00:00"}
        client = {"updated_at": None}
        result = resolve_conflict(
            "x", server, client, strategy=ConflictStrategy.LAST_WRITE_WINS
        )
        assert result is server

    def test_datetime_objects_compared_correctly(self):
        server = {"updated_at": datetime(2025, 1, 10, 10, 0, 0)}
        client = {"updated_at": datetime(2025, 1, 10, 15, 0, 0)}
        result = resolve_conflict(
            "x", server, client, strategy=ConflictStrategy.LAST_WRITE_WINS
        )
        assert result is client

    def test_missing_updated_at_key_treated_as_none(self):
        server = {}
        client = {}
        result = resolve_conflict(
            "x", server, client, strategy=ConflictStrategy.LAST_WRITE_WINS
        )
        assert result is server


# ---------------------------------------------------------------------------
# _parse_timestamp
# ---------------------------------------------------------------------------

class TestParseTimestamp:
    """Tests for the internal timestamp parser."""

    def test_none_returns_none(self):
        assert _parse_timestamp(None) is None

    def test_datetime_returns_same_object(self):
        dt = datetime(2025, 6, 15, 8, 30, 0)
        assert _parse_timestamp(dt) is dt

    def test_valid_iso_string(self):
        result = _parse_timestamp("2025-01-10T12:00:00")
        assert result == datetime(2025, 1, 10, 12, 0, 0)

    def test_invalid_string_returns_none(self):
        assert _parse_timestamp("not-a-date") is None

    def test_non_string_non_datetime_returns_none(self):
        assert _parse_timestamp(12345) is None
        assert _parse_timestamp(3.14) is None
        assert _parse_timestamp(["2025-01-01"]) is None
