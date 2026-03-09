"""Unit tests for InventoryPeriodService."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-32-bytes-minimum")
os.environ.setdefault("DATABASE_URL", "sqlite:///test.db")

import uuid
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from app.models.stock_take import (
    InventoryPeriod,
    PeriodSnapshot,
    ProductABCClassification,
    StockCountHistory,
)
from app.services.inventory_period_service import InventoryPeriodService

BIZ_ID = str(uuid.uuid4())
USER_ID = str(uuid.uuid4())
PERIOD_ID = str(uuid.uuid4())
PRODUCT_ID = str(uuid.uuid4())
COUNT_ID = str(uuid.uuid4())


def _chain(first=None, rows=None, count=0):
    """Reusable mock that supports the common SQLAlchemy chained-call pattern."""
    c = MagicMock()
    c.filter.return_value = c
    c.join.return_value = c
    c.order_by.return_value = c
    c.offset.return_value = c
    c.limit.return_value = c
    c.all.return_value = rows if rows is not None else []
    c.first.return_value = first
    c.count.return_value = count
    c.scalar.return_value = count
    return c


@pytest.fixture
def db():
    return MagicMock()


@pytest.fixture
def svc(db):
    return InventoryPeriodService(db)


# ==================================================================
# list_periods
# ==================================================================

class TestListPeriods:
    def test_returns_items_and_total(self, svc, db):
        p1 = MagicMock(spec=InventoryPeriod)
        db.query.return_value = _chain(rows=[p1], count=1)

        items, total = svc.list_periods(BIZ_ID)
        assert items == [p1]
        assert total == 1

    def test_empty_list(self, svc, db):
        db.query.return_value = _chain(rows=[], count=0)

        items, total = svc.list_periods(BIZ_ID)
        assert items == []
        assert total == 0

    def test_pagination_offset(self, svc, db):
        chain = _chain(rows=[], count=25)
        db.query.return_value = chain

        svc.list_periods(BIZ_ID, page=3, per_page=10)
        chain.offset.assert_called_once_with(20)
        chain.limit.assert_called_once_with(10)


# ==================================================================
# get_or_create_period
# ==================================================================

class TestGetOrCreatePeriod:
    def test_returns_existing_period(self, svc, db):
        existing = MagicMock(spec=InventoryPeriod)
        db.query.return_value = _chain(first=existing)

        result = svc.get_or_create_period(BIZ_ID, 2025, 1)
        assert result is existing
        db.add.assert_not_called()

    def test_creates_new_period(self, svc, db):
        db.query.return_value = _chain(first=None)

        result = svc.get_or_create_period(BIZ_ID, 2025, 6)
        assert isinstance(result, InventoryPeriod)
        assert result.business_id == BIZ_ID
        assert result.period_year == 2025
        assert result.period_month == 6
        assert result.status == "open"
        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()


# ==================================================================
# close_period
# ==================================================================

class TestClosePeriod:
    def test_closes_open_period(self, svc, db):
        period = MagicMock(spec=InventoryPeriod)
        period.status = "open"
        db.query.return_value = _chain(first=period)

        result = svc.close_period(
            PERIOD_ID, BIZ_ID, Decimal("5000.00"), Decimal("1200.50"), USER_ID
        )
        assert result is period
        assert period.status == "closed"
        assert period.closing_value == Decimal("5000.00")
        assert period.cogs == Decimal("1200.50")
        assert period.closed_by == USER_ID
        assert period.closed_at is not None
        db.commit.assert_called_once()

    def test_idempotent_on_already_closed(self, svc, db):
        period = MagicMock(spec=InventoryPeriod)
        period.status = "closed"
        db.query.return_value = _chain(first=period)

        result = svc.close_period(
            PERIOD_ID, BIZ_ID, Decimal("5000.00"), Decimal("1200.50"), USER_ID
        )
        assert result is period
        db.commit.assert_not_called()

    def test_returns_none_when_not_found(self, svc, db):
        db.query.return_value = _chain(first=None)

        result = svc.close_period(
            PERIOD_ID, BIZ_ID, Decimal("5000.00"), Decimal("1200.50"), USER_ID
        )
        assert result is None
        db.commit.assert_not_called()

    def test_closes_reopened_period(self, svc, db):
        period = MagicMock(spec=InventoryPeriod)
        period.status = "reopened"
        db.query.return_value = _chain(first=period)

        result = svc.close_period(
            PERIOD_ID, BIZ_ID, Decimal("3000.00"), Decimal("800.00"), USER_ID
        )
        assert result is period
        assert period.status == "closed"
        db.commit.assert_called_once()


# ==================================================================
# reopen_period
# ==================================================================

class TestReopenPeriod:
    def test_reopens_closed_period(self, svc, db):
        period = MagicMock(spec=InventoryPeriod)
        db.query.return_value = _chain(first=period)

        result = svc.reopen_period(PERIOD_ID, BIZ_ID, USER_ID)
        assert result is period
        assert period.status == "reopened"
        assert period.reopened_by == USER_ID
        assert period.reopened_at is not None
        db.commit.assert_called_once()

    def test_returns_none_when_not_found(self, svc, db):
        db.query.return_value = _chain(first=None)

        result = svc.reopen_period(PERIOD_ID, BIZ_ID, USER_ID)
        assert result is None
        db.commit.assert_not_called()

    def test_returns_none_when_not_closed(self, svc, db):
        """Filter includes status=='closed', so open periods won't match."""
        db.query.return_value = _chain(first=None)

        result = svc.reopen_period(PERIOD_ID, BIZ_ID, USER_ID)
        assert result is None


# ==================================================================
# create_snapshot
# ==================================================================

class TestCreateSnapshot:
    def test_creates_snapshot_with_computed_total(self, svc, db):
        result = svc.create_snapshot(PERIOD_ID, PRODUCT_ID, 10, Decimal("25.00"))
        assert isinstance(result, PeriodSnapshot)
        assert result.period_id == PERIOD_ID
        assert result.product_id == PRODUCT_ID
        assert result.quantity == 10
        assert result.unit_cost == Decimal("25.00")
        assert result.total_value == Decimal("250.00")
        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    def test_zero_quantity_gives_zero_total(self, svc, db):
        result = svc.create_snapshot(PERIOD_ID, PRODUCT_ID, 0, Decimal("50.00"))
        assert result.total_value == Decimal("0.00")

    def test_large_values(self, svc, db):
        result = svc.create_snapshot(
            PERIOD_ID, PRODUCT_ID, 99999, Decimal("999.99")
        )
        expected = Decimal("99999") * Decimal("999.99")
        assert result.total_value == expected


# ==================================================================
# list_snapshots
# ==================================================================

class TestListSnapshots:
    def test_returns_snapshots_and_total(self, svc, db):
        s1 = MagicMock(spec=PeriodSnapshot)
        db.query.return_value = _chain(rows=[s1], count=1)

        items, total = svc.list_snapshots(PERIOD_ID)
        assert items == [s1]
        assert total == 1

    def test_pagination(self, svc, db):
        chain = _chain(rows=[], count=100)
        db.query.return_value = chain

        svc.list_snapshots(PERIOD_ID, page=2, per_page=25)
        chain.offset.assert_called_once_with(25)
        chain.limit.assert_called_once_with(25)


# ==================================================================
# set_classification
# ==================================================================

class TestSetClassification:
    def test_creates_new_classification(self, svc, db):
        db.query.return_value = _chain(first=None)

        result = svc.set_classification(
            BIZ_ID, PRODUCT_ID, "A", Decimal("100000.00"), 30
        )
        assert isinstance(result, ProductABCClassification)
        assert result.business_id == BIZ_ID
        assert result.product_id == PRODUCT_ID
        assert result.classification == "A"
        assert result.annual_value == Decimal("100000.00")
        assert result.count_frequency_days == 30
        db.add.assert_called_once()
        db.commit.assert_called_once()

    def test_updates_existing_classification(self, svc, db):
        existing = MagicMock(spec=ProductABCClassification)
        db.query.return_value = _chain(first=existing)

        result = svc.set_classification(
            BIZ_ID, PRODUCT_ID, "B", Decimal("50000.00"), 60
        )
        assert result is existing
        assert existing.classification == "B"
        assert existing.annual_value == Decimal("50000.00")
        assert existing.count_frequency_days == 60
        db.add.assert_not_called()
        db.commit.assert_called_once()

    def test_default_count_frequency(self, svc, db):
        db.query.return_value = _chain(first=None)

        result = svc.set_classification(
            BIZ_ID, PRODUCT_ID, "C", Decimal("5000.00")
        )
        assert result.count_frequency_days == 90


# ==================================================================
# list_classifications
# ==================================================================

class TestListClassifications:
    def test_returns_all_classifications(self, svc, db):
        c1 = MagicMock(spec=ProductABCClassification)
        db.query.return_value = _chain(rows=[c1], count=1)

        items, total = svc.list_classifications(BIZ_ID)
        assert items == [c1]
        assert total == 1

    def test_filters_by_classification(self, svc, db):
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.list_classifications(BIZ_ID, classification="A")
        # filter called twice: once for business_id, once for classification
        assert chain.filter.call_count == 2

    def test_no_extra_filter_without_classification(self, svc, db):
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.list_classifications(BIZ_ID)
        # filter called once: only for business_id
        assert chain.filter.call_count == 1

    def test_pagination(self, svc, db):
        chain = _chain(rows=[], count=50)
        db.query.return_value = chain

        svc.list_classifications(BIZ_ID, page=3, per_page=20)
        chain.offset.assert_called_once_with(40)
        chain.limit.assert_called_once_with(20)


# ==================================================================
# add_count_history
# ==================================================================

class TestAddCountHistory:
    def test_creates_history_record(self, svc, db):
        result = svc.add_count_history(COUNT_ID, 42, USER_ID, "recount")
        assert isinstance(result, StockCountHistory)
        assert result.count_id == COUNT_ID
        assert result.counted_quantity == 42
        assert result.counted_by == USER_ID
        assert result.notes == "recount"
        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    def test_optional_fields_default_none(self, svc, db):
        result = svc.add_count_history(COUNT_ID, 10)
        assert result.counted_by is None
        assert result.notes is None


# ==================================================================
# get_count_history
# ==================================================================

class TestGetCountHistory:
    def test_returns_ordered_history(self, svc, db):
        h1 = MagicMock(spec=StockCountHistory)
        h2 = MagicMock(spec=StockCountHistory)
        db.query.return_value = _chain(rows=[h1, h2])

        result = svc.get_count_history(COUNT_ID)
        assert result == [h1, h2]

    def test_returns_empty_list(self, svc, db):
        db.query.return_value = _chain(rows=[])

        result = svc.get_count_history(COUNT_ID)
        assert result == []
