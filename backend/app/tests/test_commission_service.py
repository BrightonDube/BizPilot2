"""Tests for CommissionService."""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock


from app.models.commission import CommissionRecord, CommissionStatus
from app.services.commission_service import CommissionService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _svc():
    """Create a mocked service with mocked database."""
    db = MagicMock()
    return CommissionService(db), db


def _chain(db, rows=None, first=None, count=0, scalar=None, update_count=0):
    """Mock SQLAlchemy query chain."""
    chain = MagicMock()
    chain.filter.return_value = chain
    chain.join.return_value = chain
    chain.order_by.return_value = chain
    chain.offset.return_value = chain
    chain.limit.return_value = chain
    chain.group_by.return_value = chain

    chain.all.return_value = rows or []
    chain.first.return_value = first
    chain.count.return_value = count
    chain.scalar.return_value = scalar
    chain.update.return_value = update_count

    db.query.return_value = chain
    return chain


def _make_record(**overrides):
    """Build a mock CommissionRecord."""
    rec = MagicMock(spec=CommissionRecord)
    defaults = dict(
        id=uuid.uuid4(),
        business_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        period_start=date(2025, 1, 1),
        period_end=date(2025, 1, 31),
        order_count=10,
        total_sales=Decimal("5000.00"),
        total_discounts=Decimal("200.00"),
        commission_rate=Decimal("5.00"),
        commission_amount=Decimal("240.00"),
        status=CommissionStatus.PENDING,
        approved_by=None,
        approved_at=None,
        rejection_reason=None,
        notes=None,
        created_at=datetime(2025, 1, 15, tzinfo=timezone.utc),
        staff=None,
        approver=None,
    )
    defaults.update(overrides)
    for k, v in defaults.items():
        setattr(rec, k, v)
    return rec


def _make_staff(first_name="Jane", last_name="Doe", email="jane@example.com"):
    staff = MagicMock()
    staff.first_name = first_name
    staff.last_name = last_name
    staff.email = email
    return staff


BIZ_ID = uuid.uuid4()
USER_ID = uuid.uuid4()
APPROVER_ID = uuid.uuid4()


# ---------------------------------------------------------------------------
# generate_records
# ---------------------------------------------------------------------------

class TestGenerateRecords:
    def test_creates_records_from_staff_data(self):
        svc, db = _svc()
        staff_data = [
            {
                "user_id": USER_ID,
                "order_count": 5,
                "total_sales": 1000,
                "total_discounts": 50,
                "commission_amount": 47.5,
            },
        ]

        result = svc.generate_records(
            business_id=BIZ_ID,
            period_start=date(2025, 1, 1),
            period_end=date(2025, 1, 31),
            commission_rate=5.0,
            staff_data=staff_data,
        )

        assert len(result) == 1
        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()

    def test_empty_staff_data_returns_empty_list(self):
        svc, db = _svc()
        result = svc.generate_records(
            business_id=BIZ_ID,
            period_start=date(2025, 1, 1),
            period_end=date(2025, 1, 31),
            commission_rate=5.0,
            staff_data=[],
        )

        assert result == []
        db.add.assert_not_called()
        db.commit.assert_called_once()

    def test_defaults_for_missing_optional_fields(self):
        svc, db = _svc()
        staff_data = [{"user_id": USER_ID}]

        result = svc.generate_records(
            business_id=BIZ_ID,
            period_start=date(2025, 1, 1),
            period_end=date(2025, 1, 31),
            commission_rate=3.0,
            staff_data=staff_data,
        )

        rec = result[0]
        assert rec.order_count == 0
        assert rec.total_sales == Decimal("0")
        assert rec.total_discounts == Decimal("0")
        assert rec.commission_amount == Decimal("0")

    def test_multiple_staff_creates_multiple_records(self):
        svc, db = _svc()
        staff_data = [
            {"user_id": uuid.uuid4(), "total_sales": 100, "commission_amount": 5},
            {"user_id": uuid.uuid4(), "total_sales": 200, "commission_amount": 10},
            {"user_id": uuid.uuid4(), "total_sales": 300, "commission_amount": 15},
        ]

        result = svc.generate_records(
            business_id=BIZ_ID,
            period_start=date(2025, 2, 1),
            period_end=date(2025, 2, 28),
            commission_rate=5.0,
            staff_data=staff_data,
        )

        assert len(result) == 3
        assert db.add.call_count == 3
        assert db.refresh.call_count == 3

    def test_record_status_is_pending(self):
        svc, db = _svc()
        result = svc.generate_records(
            business_id=BIZ_ID,
            period_start=date(2025, 1, 1),
            period_end=date(2025, 1, 31),
            commission_rate=5.0,
            staff_data=[{"user_id": USER_ID, "commission_amount": 100}],
        )

        assert result[0].status == CommissionStatus.PENDING


# ---------------------------------------------------------------------------
# list_records
# ---------------------------------------------------------------------------

class TestListRecords:
    def test_returns_items_and_total(self):
        svc, db = _svc()
        staff = _make_staff()
        rec = _make_record(staff=staff, approver=None)
        _chain(db, rows=[rec], count=1)

        items, total = svc.list_records(BIZ_ID)

        assert total == 1
        assert len(items) == 1
        assert items[0]["staff_name"] == "Jane Doe"
        assert items[0]["email"] == "jane@example.com"

    def test_status_filter_applied(self):
        svc, db = _svc()
        chain = _chain(db, rows=[], count=0)

        svc.list_records(BIZ_ID, status="approved")

        # filter called twice: once for business_id, once for status
        assert chain.filter.call_count == 2

    def test_pagination_offset_and_limit(self):
        svc, db = _svc()
        chain = _chain(db, rows=[], count=0)

        svc.list_records(BIZ_ID, page=3, per_page=10)

        chain.offset.assert_called_once_with(20)  # (3-1)*10
        chain.limit.assert_called_once_with(10)

    def test_unknown_staff_when_no_relationship(self):
        svc, db = _svc()
        rec = _make_record(staff=None, approver=None)
        _chain(db, rows=[rec], count=1)

        items, _ = svc.list_records(BIZ_ID)

        assert items[0]["staff_name"] == "Unknown"
        assert items[0]["email"] is None

    def test_approver_name_populated(self):
        svc, db = _svc()
        staff = _make_staff()
        approver = _make_staff(first_name="Admin", last_name="User", email="admin@example.com")
        rec = _make_record(staff=staff, approver=approver)
        _chain(db, rows=[rec], count=1)

        items, _ = svc.list_records(BIZ_ID)

        assert items[0]["approved_by_name"] == "Admin User"

    def test_status_enum_value_serialized(self):
        svc, db = _svc()
        rec = _make_record(staff=None, status=CommissionStatus.APPROVED)
        _chain(db, rows=[rec], count=1)

        items, _ = svc.list_records(BIZ_ID)

        assert items[0]["status"] == "approved"


# ---------------------------------------------------------------------------
# approve_records
# ---------------------------------------------------------------------------

class TestApproveRecords:
    def test_returns_updated_count(self):
        svc, db = _svc()
        _chain(db, update_count=3)

        record_ids = [uuid.uuid4() for _ in range(3)]
        result = svc.approve_records(BIZ_ID, record_ids, APPROVER_ID)

        assert result == 3
        db.commit.assert_called_once()

    def test_zero_matching_records(self):
        svc, db = _svc()
        _chain(db, update_count=0)

        result = svc.approve_records(BIZ_ID, [uuid.uuid4()], APPROVER_ID)

        assert result == 0
        db.commit.assert_called_once()


# ---------------------------------------------------------------------------
# reject_records
# ---------------------------------------------------------------------------

class TestRejectRecords:
    def test_returns_updated_count(self):
        svc, db = _svc()
        _chain(db, update_count=2)

        record_ids = [uuid.uuid4() for _ in range(2)]
        result = svc.reject_records(BIZ_ID, record_ids, APPROVER_ID, reason="Too high")

        assert result == 2
        db.commit.assert_called_once()

    def test_without_reason(self):
        svc, db = _svc()
        _chain(db, update_count=1)

        result = svc.reject_records(BIZ_ID, [uuid.uuid4()], APPROVER_ID)

        assert result == 1
        db.commit.assert_called_once()

    def test_zero_matching_records(self):
        svc, db = _svc()
        _chain(db, update_count=0)

        result = svc.reject_records(BIZ_ID, [uuid.uuid4()], APPROVER_ID)

        assert result == 0


# ---------------------------------------------------------------------------
# get_payroll_export
# ---------------------------------------------------------------------------

class TestGetPayrollExport:
    def _make_payroll_row(self, **overrides):
        row = MagicMock()
        defaults = dict(
            user_id=USER_ID,
            first_name="Jane",
            last_name="Doe",
            email="jane@example.com",
            total_commission=Decimal("500.00"),
            total_sales=Decimal("10000.00"),
            total_orders=20,
        )
        defaults.update(overrides)
        for k, v in defaults.items():
            setattr(row, k, v)
        return row

    def test_returns_grouped_data(self):
        svc, db = _svc()
        row = self._make_payroll_row()
        _chain(db, rows=[row])

        result = svc.get_payroll_export(BIZ_ID)

        assert len(result) == 1
        assert result[0]["user_id"] == str(USER_ID)
        assert result[0]["staff_name"] == "Jane Doe"
        assert result[0]["email"] == "jane@example.com"
        assert result[0]["total_commission"] == 500.00
        assert result[0]["total_sales"] == 10000.00
        assert result[0]["total_orders"] == 20

    def test_with_date_filters(self):
        svc, db = _svc()
        chain = _chain(db, rows=[])

        svc.get_payroll_export(
            BIZ_ID,
            period_start=date(2025, 1, 1),
            period_end=date(2025, 1, 31),
        )

        # base filter + period_start filter + period_end filter
        assert chain.filter.call_count == 3

    def test_empty_results(self):
        svc, db = _svc()
        _chain(db, rows=[])

        result = svc.get_payroll_export(BIZ_ID)

        assert result == []

    def test_unknown_staff_name_with_missing_names(self):
        svc, db = _svc()
        row = self._make_payroll_row(first_name=None, last_name=None)
        _chain(db, rows=[row])

        result = svc.get_payroll_export(BIZ_ID)

        assert result[0]["staff_name"] == "Unknown"
