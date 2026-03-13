"""Unit tests for StockTakeService."""
import os
os.environ.setdefault("SECRET_KEY", "test-secret-key")

from decimal import Decimal
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.models.inventory import InventoryItem
from app.models.stock_take import (
    StockCount,
    StockTakeSession,
    StockTakeStatus,
)
from app.services.stock_take_service import StockTakeService


BIZ = str(uuid4())
USER = str(uuid4())
SESS_ID = str(uuid4())
PROD_ID = str(uuid4())


def _svc():
    db = MagicMock()
    return StockTakeService(db), db


def _chain(first=None, rows=None, count=0, scalar=None):
    c = MagicMock()
    c.filter.return_value = c
    c.join.return_value = c
    c.order_by.return_value = c
    c.offset.return_value = c
    c.limit.return_value = c
    c.all.return_value = rows if rows is not None else []
    c.first.return_value = first
    c.count.return_value = count
    c.scalar.return_value = scalar
    return c


def _mock_session(**kw):
    s = MagicMock(spec=StockTakeSession)
    s.id = kw.get("id", SESS_ID)
    s.business_id = kw.get("business_id", BIZ)
    s.reference = kw.get("reference", "STK-20250101-ABCD")
    s.status = kw.get("status", StockTakeStatus.DRAFT)
    s.started_by_id = kw.get("started_by_id", USER)
    s.completed_by_id = kw.get("completed_by_id", None)
    s.notes = kw.get("notes", None)
    s.started_at = kw.get("started_at", None)
    s.completed_at = kw.get("completed_at", None)
    s.deleted_at = None
    return s


def _mock_count(**kw):
    c = MagicMock(spec=StockCount)
    c.id = kw.get("id", uuid4())
    c.session_id = kw.get("session_id", SESS_ID)
    c.product_id = kw.get("product_id", PROD_ID)
    c.business_id = kw.get("business_id", BIZ)
    c.system_quantity = kw.get("system_quantity", 100)
    c.counted_quantity = kw.get("counted_quantity", None)
    c.variance = kw.get("variance", None)
    c.unit_cost = kw.get("unit_cost", Decimal("10.00"))
    c.variance_value = kw.get("variance_value", None)
    c.counted_by_id = kw.get("counted_by_id", None)
    c.notes = kw.get("notes", None)
    c.deleted_at = None
    return c


def _mock_inv_item(**kw):
    i = MagicMock(spec=InventoryItem)
    i.id = kw.get("id", uuid4())
    i.product_id = kw.get("product_id", PROD_ID)
    i.business_id = kw.get("business_id", BIZ)
    i.quantity_on_hand = kw.get("quantity_on_hand", 100)
    i.average_cost = kw.get("average_cost", Decimal("10.00"))
    i.deleted_at = None
    return i


# ── generate_reference ────────────────────────────────────────────

class TestGenerateReference:
    def test_format(self):
        svc, _ = _svc()
        ref = svc._generate_reference()
        assert ref.startswith("STK-")
        parts = ref.split("-")
        assert len(parts) == 3
        assert len(parts[1]) == 8  # YYYYMMDD
        assert len(parts[2]) == 4  # random alphanumeric


# ── create_session ────────────────────────────────────────────────

class TestCreateSession:
    def test_creates_draft_session(self):
        svc, db = _svc()
        svc.create_session(BIZ, USER, notes="test notes")

        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        added = db.add.call_args[0][0]
        assert added.business_id == BIZ
        assert added.status == StockTakeStatus.DRAFT
        assert added.started_by_id == USER
        assert added.notes == "test notes"

    def test_creates_session_without_notes(self):
        svc, db = _svc()
        svc.create_session(BIZ, USER)

        added = db.add.call_args[0][0]
        assert added.notes is None


# ── get_session ───────────────────────────────────────────────────

class TestGetSession:
    def test_returns_session(self):
        svc, db = _svc()
        mock_sess = _mock_session()
        db.query.return_value = _chain(first=mock_sess)

        result = svc.get_session(SESS_ID, BIZ)
        assert result == mock_sess

    def test_returns_none_when_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.get_session(SESS_ID, BIZ)
        assert result is None


# ── list_sessions ─────────────────────────────────────────────────

class TestListSessions:
    def test_returns_items_and_total(self):
        svc, db = _svc()
        sessions = [_mock_session(), _mock_session()]
        db.query.return_value = _chain(rows=sessions, count=2)

        items, total = svc.list_sessions(BIZ)
        assert items == sessions
        assert total == 2

    def test_with_status_filter(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.list_sessions(BIZ, status=StockTakeStatus.DRAFT)
        # filter called twice: once for base filters, once for status
        assert chain.filter.call_count == 2

    def test_pagination(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=5)
        db.query.return_value = chain

        svc.list_sessions(BIZ, page=2, per_page=2)
        chain.offset.assert_called_once_with(2)  # (2-1)*2
        chain.limit.assert_called_once_with(2)


# ── start_session ─────────────────────────────────────────────────

class TestStartSession:
    def test_starts_draft_session(self):
        svc, db = _svc()
        mock_sess = _mock_session(status=StockTakeStatus.DRAFT)
        inv_item = _mock_inv_item()

        # First query: get_session -> StockTakeSession
        # Second query: inventory items -> InventoryItem
        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(first=mock_sess)
            return _chain(rows=[inv_item])
        db.query.side_effect = side_effect

        result = svc.start_session(SESS_ID, BIZ)
        assert result == mock_sess
        assert mock_sess.status == StockTakeStatus.IN_PROGRESS
        assert mock_sess.started_at is not None
        # add called for each inventory item's StockCount
        assert db.add.call_count >= 1
        db.commit.assert_called_once()

    def test_raises_if_session_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        with pytest.raises(ValueError, match="Stock take session not found"):
            svc.start_session(SESS_ID, BIZ)

    def test_raises_if_not_draft(self):
        svc, db = _svc()
        mock_sess = _mock_session(status=StockTakeStatus.IN_PROGRESS)
        db.query.return_value = _chain(first=mock_sess)

        with pytest.raises(ValueError, match="DRAFT"):
            svc.start_session(SESS_ID, BIZ)

    def test_populates_stock_counts_for_all_items(self):
        svc, db = _svc()
        mock_sess = _mock_session(status=StockTakeStatus.DRAFT)
        items = [_mock_inv_item(product_id=str(uuid4())) for _ in range(3)]

        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(first=mock_sess)
            return _chain(rows=items)
        db.query.side_effect = side_effect

        svc.start_session(SESS_ID, BIZ)
        # One db.add per inventory item (StockCount rows)
        assert db.add.call_count == 3


# ── record_count ──────────────────────────────────────────────────

class TestRecordCount:
    def test_records_count_successfully(self):
        svc, db = _svc()
        mock_sess = _mock_session(status=StockTakeStatus.IN_PROGRESS)
        mock_cnt = _mock_count(system_quantity=100, unit_cost=Decimal("10.00"))

        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(first=mock_sess)
            return _chain(first=mock_cnt)
        db.query.side_effect = side_effect

        result = svc.record_count(SESS_ID, PROD_ID, BIZ, 95, USER, notes="shelf B")
        assert result == mock_cnt
        assert mock_cnt.counted_quantity == 95
        assert mock_cnt.variance == -5
        assert mock_cnt.counted_by_id == USER
        assert mock_cnt.notes == "shelf B"
        assert mock_cnt.variance_value == Decimal("-5") * Decimal("10.00")
        db.commit.assert_called_once()

    def test_raises_if_session_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        with pytest.raises(ValueError, match="Stock take session not found"):
            svc.record_count(SESS_ID, PROD_ID, BIZ, 10, USER)

    def test_raises_if_not_in_progress(self):
        svc, db = _svc()
        mock_sess = _mock_session(status=StockTakeStatus.DRAFT)
        db.query.return_value = _chain(first=mock_sess)

        with pytest.raises(ValueError, match="IN_PROGRESS"):
            svc.record_count(SESS_ID, PROD_ID, BIZ, 10, USER)

    def test_raises_if_count_not_found(self):
        svc, db = _svc()
        mock_sess = _mock_session(status=StockTakeStatus.IN_PROGRESS)

        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(first=mock_sess)
            return _chain(first=None)
        db.query.side_effect = side_effect

        with pytest.raises(ValueError, match="Stock count entry not found"):
            svc.record_count(SESS_ID, PROD_ID, BIZ, 10, USER)

    def test_no_variance_value_when_unit_cost_none(self):
        svc, db = _svc()
        mock_sess = _mock_session(status=StockTakeStatus.IN_PROGRESS)
        mock_cnt = _mock_count(system_quantity=50, unit_cost=None)

        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(first=mock_sess)
            return _chain(first=mock_cnt)
        db.query.side_effect = side_effect

        svc.record_count(SESS_ID, PROD_ID, BIZ, 55, USER)
        assert mock_cnt.counted_quantity == 55
        assert mock_cnt.variance == 5
        # variance_value not set when unit_cost is None
        assert mock_cnt.variance_value is None


# ── get_counts ────────────────────────────────────────────────────

class TestGetCounts:
    def test_returns_all_counts(self):
        svc, db = _svc()
        counts = [_mock_count(), _mock_count()]
        db.query.return_value = _chain(rows=counts)

        result = svc.get_counts(SESS_ID, BIZ)
        assert result == counts

    def test_variance_only_filter(self):
        svc, db = _svc()
        chain = _chain(rows=[])
        db.query.return_value = chain

        svc.get_counts(SESS_ID, BIZ, variance_only=True)
        # Extra filter call for variance_only
        assert chain.filter.call_count == 2


# ── complete_session ──────────────────────────────────────────────

class TestCompleteSession:
    def test_completes_session_with_variances(self):
        svc, db = _svc()
        mock_sess = _mock_session(status=StockTakeStatus.IN_PROGRESS)
        mock_cnt = _mock_count(
            variance=5, system_quantity=100, counted_quantity=105,
            unit_cost=Decimal("10.00"),
        )
        mock_inv = _mock_inv_item(quantity_on_hand=100)

        # Queries: 1) get_session, 2) get_counts->base filter, 3) get_counts->variance filter,
        # 4) inv_item lookup
        # However get_session and get_counts both call db.query
        # get_session: 1 query
        # get_counts: 1 query (returns variance counts)
        # complete loop: 1 query per count (InventoryItem lookup)
        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(first=mock_sess)  # get_session
            if call_count[0] == 2:
                return _chain(rows=[mock_cnt])  # get_counts
            return _chain(first=mock_inv)  # inventory item lookup
        db.query.side_effect = side_effect

        result = svc.complete_session(SESS_ID, BIZ, USER)
        assert result == mock_sess
        assert mock_sess.status == StockTakeStatus.COMPLETED
        assert mock_sess.completed_by_id == USER
        assert mock_sess.completed_at is not None
        # adjustment + transaction added
        assert db.add.call_count == 2
        db.commit.assert_called_once()

    def test_raises_if_session_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        with pytest.raises(ValueError, match="Stock take session not found"):
            svc.complete_session(SESS_ID, BIZ, USER)

    def test_raises_if_not_in_progress(self):
        svc, db = _svc()
        mock_sess = _mock_session(status=StockTakeStatus.DRAFT)
        db.query.return_value = _chain(first=mock_sess)

        with pytest.raises(ValueError, match="IN_PROGRESS"):
            svc.complete_session(SESS_ID, BIZ, USER)

    def test_updates_inventory_quantity(self):
        svc, db = _svc()
        mock_sess = _mock_session(status=StockTakeStatus.IN_PROGRESS)
        mock_cnt = _mock_count(
            variance=-3, system_quantity=50, counted_quantity=47,
            unit_cost=Decimal("5.00"),
        )
        mock_inv = _mock_inv_item(quantity_on_hand=50)

        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(first=mock_sess)
            if call_count[0] == 2:
                return _chain(rows=[mock_cnt])
            return _chain(first=mock_inv)
        db.query.side_effect = side_effect

        svc.complete_session(SESS_ID, BIZ, USER)
        assert mock_inv.quantity_on_hand == 47  # 50 + (-3)
        assert mock_inv.last_counted_at is not None

    def test_skips_zero_variance(self):
        svc, db = _svc()
        mock_sess = _mock_session(status=StockTakeStatus.IN_PROGRESS)
        mock_cnt = _mock_count(variance=0, system_quantity=50, counted_quantity=50)

        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(first=mock_sess)
            return _chain(rows=[mock_cnt])
        db.query.side_effect = side_effect

        svc.complete_session(SESS_ID, BIZ, USER)
        # No adjustment or transaction added for zero variance
        db.add.assert_not_called()

    def test_no_inv_item_still_adds_adjustment(self):
        """If inventory item is missing, adjustment is added but no transaction."""
        svc, db = _svc()
        mock_sess = _mock_session(status=StockTakeStatus.IN_PROGRESS)
        mock_cnt = _mock_count(
            variance=2, system_quantity=10, counted_quantity=12,
            unit_cost=Decimal("5.00"),
        )

        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(first=mock_sess)
            if call_count[0] == 2:
                return _chain(rows=[mock_cnt])
            return _chain(first=None)  # inventory item not found
        db.query.side_effect = side_effect

        svc.complete_session(SESS_ID, BIZ, USER)
        # Only adjustment added, no transaction (inv_item was None)
        assert db.add.call_count == 1


# ── get_variance_summary ──────────────────────────────────────────

class TestGetVarianceSummary:
    def test_returns_summary_dict(self):
        svc, db = _svc()
        mock_sess = _mock_session(status=StockTakeStatus.IN_PROGRESS)

        # Queries: 1) get_session, 2) total_items, 3) items_with_variance, 4) total_variance_value
        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(first=mock_sess)
            if call_count[0] == 2:
                return _chain(scalar=10)
            if call_count[0] == 3:
                return _chain(scalar=3)
            return _chain(scalar=Decimal("-50.00"))
        db.query.side_effect = side_effect

        result = svc.get_variance_summary(SESS_ID, BIZ)
        assert result["session_id"] == str(mock_sess.id)
        assert result["reference"] == mock_sess.reference
        assert result["total_items"] == 10
        assert result["items_with_variance"] == 3
        assert result["total_variance_value"] == Decimal("-50.00")

    def test_raises_if_session_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        with pytest.raises(ValueError, match="Stock take session not found"):
            svc.get_variance_summary(SESS_ID, BIZ)

    def test_returns_zero_when_no_items(self):
        svc, db = _svc()
        mock_sess = _mock_session()

        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(first=mock_sess)
            if call_count[0] == 2:
                return _chain(scalar=None)
            if call_count[0] == 3:
                return _chain(scalar=None)
            return _chain(scalar=0)
        db.query.side_effect = side_effect

        result = svc.get_variance_summary(SESS_ID, BIZ)
        assert result["total_items"] == 0
        assert result["items_with_variance"] == 0


# ── cancel_session ────────────────────────────────────────────────

class TestCancelSession:
    def test_cancels_draft_session(self):
        svc, db = _svc()
        mock_sess = _mock_session(status=StockTakeStatus.DRAFT)
        db.query.return_value = _chain(first=mock_sess)

        result = svc.cancel_session(SESS_ID, BIZ)
        assert result == mock_sess
        assert mock_sess.status == StockTakeStatus.CANCELLED
        db.commit.assert_called_once()

    def test_cancels_in_progress_session(self):
        svc, db = _svc()
        mock_sess = _mock_session(status=StockTakeStatus.IN_PROGRESS)
        db.query.return_value = _chain(first=mock_sess)

        svc.cancel_session(SESS_ID, BIZ)
        assert mock_sess.status == StockTakeStatus.CANCELLED

    def test_raises_if_session_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        with pytest.raises(ValueError, match="Stock take session not found"):
            svc.cancel_session(SESS_ID, BIZ)

    def test_raises_if_completed(self):
        svc, db = _svc()
        mock_sess = _mock_session(status=StockTakeStatus.COMPLETED)
        db.query.return_value = _chain(first=mock_sess)

        with pytest.raises(ValueError, match="Cannot cancel a completed session"):
            svc.cancel_session(SESS_ID, BIZ)
