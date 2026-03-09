"""Unit tests for TableService.

Tests cover CRUD operations, status management, duplicate detection,
soft-delete, and table-with-order queries.
"""

import os
os.environ.setdefault("SECRET_KEY", "test-secret-key")

import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch, PropertyMock

import pytest
from fastapi import HTTPException

from app.models.restaurant_table import RestaurantTable, TableStatus
from app.models.order import Order, OrderStatus
from app.services.table_service import TableService


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def db():
    """Create a mock database session."""
    return MagicMock()


@pytest.fixture
def service(db):
    """Create a TableService with mocked DB."""
    return TableService(db)


@pytest.fixture
def sample_table():
    """Create a mock RestaurantTable."""
    t = MagicMock(spec=RestaurantTable)
    t.id = uuid.uuid4()
    t.business_id = uuid.uuid4()
    t.table_number = "T1"
    t.capacity = 4
    t.section = "Main"
    t.status = TableStatus.AVAILABLE
    t.position_x = 10.0
    t.position_y = 20.0
    t.is_active = True
    t.deleted_at = None
    return t


BIZ_ID = uuid.uuid4()


# ---------------------------------------------------------------------------
# create_table
# ---------------------------------------------------------------------------

class TestCreateTable:
    """Tests for TableService.create_table."""

    def test_create_table_success(self, service, db):
        """Creating a table when no duplicate exists."""
        db.query.return_value.filter.return_value.first.return_value = None
        result = service.create_table(BIZ_ID, "T5", capacity=6, section="Patio")

        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        added = db.add.call_args[0][0]
        assert added.table_number == "T5"
        assert added.capacity == 6
        assert added.section == "Patio"

    def test_create_table_duplicate_raises(self, service, db):
        """Creating a table with existing number raises 400."""
        existing = MagicMock(spec=RestaurantTable)
        db.query.return_value.filter.return_value.first.return_value = existing

        with pytest.raises(HTTPException) as exc:
            service.create_table(BIZ_ID, "T1")
        assert exc.value.status_code == 400
        assert "already exists" in str(exc.value.detail)

    def test_create_table_default_position(self, service, db):
        """Default position is (0, 0)."""
        db.query.return_value.filter.return_value.first.return_value = None
        service.create_table(BIZ_ID, "T9")
        added = db.add.call_args[0][0]
        assert added.position_x == 0
        assert added.position_y == 0


# ---------------------------------------------------------------------------
# get_table
# ---------------------------------------------------------------------------

class TestGetTable:
    """Tests for TableService.get_table."""

    def test_get_table_found(self, service, db, sample_table):
        """Returns the table when found."""
        db.query.return_value.filter.return_value.first.return_value = sample_table
        result = service.get_table(sample_table.id, sample_table.business_id)
        assert result == sample_table

    def test_get_table_not_found(self, service, db):
        """Raises 404 when table doesn't exist."""
        db.query.return_value.filter.return_value.first.return_value = None
        with pytest.raises(HTTPException) as exc:
            service.get_table(uuid.uuid4(), BIZ_ID)
        assert exc.value.status_code == 404


# ---------------------------------------------------------------------------
# list_tables
# ---------------------------------------------------------------------------

class TestListTables:
    """Tests for TableService.list_tables."""

    def test_list_tables_returns_tuple(self, service, db, sample_table):
        """Returns (list, total) tuple."""
        chain = db.query.return_value.filter.return_value
        chain.count.return_value = 1
        chain.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [sample_table]

        tables, total = service.list_tables(BIZ_ID)
        assert total == 1
        assert tables == [sample_table]

    def test_list_tables_with_section_filter(self, service, db):
        """Filters by section when provided."""
        chain = db.query.return_value.filter.return_value
        chain.filter.return_value = chain  # chained filter
        chain.count.return_value = 0
        chain.order_by.return_value.offset.return_value.limit.return_value.all.return_value = []

        tables, total = service.list_tables(BIZ_ID, section="Patio")
        assert total == 0

    def test_list_tables_with_status_filter(self, service, db):
        """Filters by status when provided."""
        chain = db.query.return_value.filter.return_value
        chain.filter.return_value = chain
        chain.count.return_value = 0
        chain.order_by.return_value.offset.return_value.limit.return_value.all.return_value = []

        tables, total = service.list_tables(BIZ_ID, status_filter=TableStatus.AVAILABLE)
        assert total == 0


# ---------------------------------------------------------------------------
# update_table
# ---------------------------------------------------------------------------

class TestUpdateTable:
    """Tests for TableService.update_table."""

    def test_update_table_changes_fields(self, service, db, sample_table):
        """Updates specified fields."""
        db.query.return_value.filter.return_value.first.return_value = sample_table
        result = service.update_table(
            sample_table.id, sample_table.business_id,
            capacity=8, section="VIP",
        )
        assert sample_table.capacity == 8
        assert sample_table.section == "VIP"
        db.commit.assert_called()

    def test_update_table_ignores_none(self, service, db, sample_table):
        """None values are not applied."""
        db.query.return_value.filter.return_value.first.return_value = sample_table
        original_section = sample_table.section
        service.update_table(
            sample_table.id, sample_table.business_id,
            section=None,
        )
        assert sample_table.section == original_section


# ---------------------------------------------------------------------------
# update_status
# ---------------------------------------------------------------------------

class TestUpdateStatus:
    """Tests for TableService.update_status."""

    def test_update_status(self, service, db, sample_table):
        """Changes table status to new value."""
        db.query.return_value.filter.return_value.first.return_value = sample_table
        service.update_status(sample_table.id, sample_table.business_id, TableStatus.OCCUPIED)
        assert sample_table.status == TableStatus.OCCUPIED
        db.commit.assert_called()


# ---------------------------------------------------------------------------
# delete_table (soft delete)
# ---------------------------------------------------------------------------

class TestDeleteTable:
    """Tests for TableService.delete_table."""

    def test_soft_delete_sets_deleted_at(self, service, db, sample_table):
        """Soft delete sets deleted_at timestamp."""
        db.query.return_value.filter.return_value.first.return_value = sample_table
        service.delete_table(sample_table.id, sample_table.business_id)
        assert sample_table.deleted_at is not None
        db.commit.assert_called()


# ---------------------------------------------------------------------------
# get_table_order
# ---------------------------------------------------------------------------

class TestGetTableOrder:
    """Tests for TableService.get_table_order."""

    def test_returns_active_order(self, service, db):
        """Returns the active (unpaid) order for a table."""
        mock_order = MagicMock(spec=Order)
        db.query.return_value.filter.return_value.first.return_value = mock_order
        result = service.get_table_order(uuid.uuid4(), BIZ_ID)
        assert result == mock_order

    def test_returns_none_when_no_active_order(self, service, db):
        """Returns None if no active order."""
        db.query.return_value.filter.return_value.first.return_value = None
        result = service.get_table_order(uuid.uuid4(), BIZ_ID)
        assert result is None


# ---------------------------------------------------------------------------
# get_tables_with_orders
# ---------------------------------------------------------------------------

class TestGetTablesWithOrders:
    """Tests for TableService.get_tables_with_orders."""

    def test_returns_list_of_dicts(self, service, db, sample_table):
        """Returns dicts with table, order, and flag."""
        # list_tables mock
        chain = db.query.return_value.filter.return_value
        chain.count.return_value = 1
        chain.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [sample_table]

        # get_table_order returns None (no active order)
        with patch.object(service, "get_table_order", return_value=None):
            result = service.get_tables_with_orders(BIZ_ID)

        assert len(result) == 1
        assert result[0]["table"] == sample_table
        assert result[0]["has_active_order"] is False

    def test_with_active_order(self, service, db, sample_table):
        """Sets has_active_order=True when an order is linked."""
        chain = db.query.return_value.filter.return_value
        chain.count.return_value = 1
        chain.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [sample_table]

        mock_order = MagicMock(spec=Order)
        with patch.object(service, "get_table_order", return_value=mock_order):
            result = service.get_tables_with_orders(BIZ_ID)

        assert result[0]["has_active_order"] is True
        assert result[0]["current_order"] == mock_order
