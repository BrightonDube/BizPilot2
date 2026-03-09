"""Unit tests for LaybyReportService."""
import os
os.environ.setdefault("SECRET_KEY", "test-secret-key")

from datetime import date, datetime, timedelta
from decimal import Decimal
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from app.models.layby import LaybyStatus
from app.models.layby_payment import PaymentStatus
from app.services.layby_report_service import LaybyReportService


BIZ = uuid4()
LAYBY_ID = uuid4()
CUST = uuid4()


def _chain(first=None, rows=None, count=0):
    """Build a chainable query mock."""
    q = MagicMock()
    q.filter = MagicMock(return_value=q)
    q.order_by = MagicMock(return_value=q)
    q.offset = MagicMock(return_value=q)
    q.limit = MagicMock(return_value=q)
    q.join = MagicMock(return_value=q)
    q.all = MagicMock(return_value=rows or [])
    q.first = MagicMock(return_value=first)
    q.count = MagicMock(return_value=count)
    q.scalar = MagicMock(return_value=count)
    q.one = MagicMock(return_value=first)
    return q


def _make_service():
    db = MagicMock()
    svc = LaybyReportService(db)
    return svc, db


def _agg_row(total_count=0, total_value=0, total_paid=0, total_outstanding=0):
    """Create a mock aggregate row for get_active_laybys."""
    row = MagicMock()
    row.total_count = total_count
    row.total_value = Decimal(str(total_value))
    row.total_paid = Decimal(str(total_paid))
    row.total_outstanding = Decimal(str(total_outstanding))
    return row


def _layby_mock(
    layby_id=None,
    reference_number="LB-001",
    customer_id=None,
    balance_due=Decimal("500.00"),
    next_payment_date=None,
    start_date=None,
    total_amount=Decimal("1000.00"),
    status=LaybyStatus.ACTIVE,
):
    """Create a mock Layby object."""
    lb = MagicMock()
    lb.id = layby_id or uuid4()
    lb.reference_number = reference_number
    lb.customer_id = customer_id or CUST
    lb.balance_due = balance_due
    lb.next_payment_date = next_payment_date
    lb.start_date = start_date or date.today()
    lb.total_amount = total_amount
    lb.status = status
    return lb


# ---------------------------------------------------------------------------
# get_active_laybys / get_active_summary
# ---------------------------------------------------------------------------

class TestGetActiveLaybys:
    """Tests for get_active_laybys (and alias get_active_summary)."""

    def test_returns_correct_totals(self):
        svc, db = _make_service()
        row = _agg_row(
            total_count=5,
            total_value=10000,
            total_paid=4000,
            total_outstanding=6000,
        )
        db.query.return_value = _chain(first=row)

        result = svc.get_active_laybys(BIZ)

        assert result["total_count"] == 5
        assert result["total_value"] == 10000.0
        assert result["total_paid"] == 4000.0
        assert result["total_outstanding"] == 6000.0

    def test_empty_results_return_zeros(self):
        svc, db = _make_service()
        row = _agg_row(0, 0, 0, 0)
        db.query.return_value = _chain(first=row)

        result = svc.get_active_laybys(BIZ)

        assert result["total_count"] == 0
        assert result["total_value"] == 0.0
        assert result["total_paid"] == 0.0
        assert result["total_outstanding"] == 0.0

    def test_decimal_rounding(self):
        svc, db = _make_service()
        row = _agg_row(
            total_count=1,
            total_value="1000.557",
            total_paid="333.333",
            total_outstanding="667.224",
        )
        db.query.return_value = _chain(first=row)

        result = svc.get_active_laybys(BIZ)

        assert result["total_value"] == round(float(Decimal("1000.557")), 2)
        assert result["total_paid"] == round(float(Decimal("333.333")), 2)
        assert result["total_outstanding"] == round(float(Decimal("667.224")), 2)

    def test_get_active_summary_is_alias(self):
        svc, db = _make_service()
        row = _agg_row(2, 2000, 800, 1200)
        db.query.return_value = _chain(first=row)

        result_summary = svc.get_active_summary(BIZ)
        # Reset mock for second call
        db.query.return_value = _chain(first=_agg_row(2, 2000, 800, 1200))
        result_active = svc.get_active_laybys(BIZ)

        assert result_summary == result_active

    def test_total_count_is_int(self):
        svc, db = _make_service()
        row = _agg_row(total_count=3, total_value=1500, total_paid=500, total_outstanding=1000)
        db.query.return_value = _chain(first=row)

        result = svc.get_active_laybys(BIZ)

        assert isinstance(result["total_count"], int)

    def test_values_are_floats(self):
        svc, db = _make_service()
        row = _agg_row(total_count=1, total_value=1000, total_paid=300, total_outstanding=700)
        db.query.return_value = _chain(first=row)

        result = svc.get_active_laybys(BIZ)

        assert isinstance(result["total_value"], float)
        assert isinstance(result["total_paid"], float)
        assert isinstance(result["total_outstanding"], float)

    def test_large_values(self):
        svc, db = _make_service()
        row = _agg_row(
            total_count=1000,
            total_value="9999999.99",
            total_paid="5000000.50",
            total_outstanding="4999999.49",
        )
        db.query.return_value = _chain(first=row)

        result = svc.get_active_laybys(BIZ)

        assert result["total_count"] == 1000
        assert result["total_value"] == 9999999.99
        assert result["total_paid"] == 5000000.50
        assert result["total_outstanding"] == 4999999.49


# ---------------------------------------------------------------------------
# get_overdue_laybys / get_overdue
# ---------------------------------------------------------------------------

class TestGetOverdueLaybys:
    """Tests for get_overdue_laybys."""

    def test_single_overdue_layby(self):
        svc, db = _make_service()
        past = date.today() - timedelta(days=10)
        lb = _layby_mock(
            layby_id=LAYBY_ID,
            reference_number="LB-100",
            customer_id=CUST,
            balance_due=Decimal("750.00"),
            next_payment_date=past,
        )
        db.query.return_value = _chain(rows=[lb])

        result = svc.get_overdue_laybys(BIZ)

        assert result["count"] == 1
        assert result["total_overdue_amount"] == 750.00
        assert len(result["laybys"]) == 1
        item = result["laybys"][0]
        assert item["layby_id"] == str(LAYBY_ID)
        assert item["reference_number"] == "LB-100"
        assert item["customer_id"] == str(CUST)
        assert item["balance_due"] == 750.00
        assert item["days_overdue"] == 10

    def test_no_overdue_laybys(self):
        svc, db = _make_service()
        db.query.return_value = _chain(rows=[])

        result = svc.get_overdue_laybys(BIZ)

        assert result["count"] == 0
        assert result["total_overdue_amount"] == 0.0
        assert result["laybys"] == []

    def test_multiple_overdue_laybys(self):
        svc, db = _make_service()
        lb1 = _layby_mock(
            balance_due=Decimal("200.00"),
            next_payment_date=date.today() - timedelta(days=5),
        )
        lb2 = _layby_mock(
            balance_due=Decimal("300.00"),
            next_payment_date=date.today() - timedelta(days=15),
        )
        db.query.return_value = _chain(rows=[lb1, lb2])

        result = svc.get_overdue_laybys(BIZ)

        assert result["count"] == 2
        assert result["total_overdue_amount"] == 500.00
        assert result["laybys"][0]["days_overdue"] == 5
        assert result["laybys"][1]["days_overdue"] == 15

    def test_none_next_payment_date_shows_zero_days(self):
        svc, db = _make_service()
        lb = _layby_mock(
            balance_due=Decimal("100.00"),
            next_payment_date=None,
        )
        db.query.return_value = _chain(rows=[lb])

        result = svc.get_overdue_laybys(BIZ)

        assert result["laybys"][0]["days_overdue"] == 0
        assert result["laybys"][0]["next_payment_date"] is None

    def test_next_payment_date_formatted_as_string(self):
        svc, db = _make_service()
        target_date = date(2025, 3, 15)
        lb = _layby_mock(
            balance_due=Decimal("100.00"),
            next_payment_date=target_date,
        )
        db.query.return_value = _chain(rows=[lb])

        result = svc.get_overdue_laybys(BIZ)

        assert result["laybys"][0]["next_payment_date"] == "2025-03-15"

    def test_get_overdue_alias(self):
        svc, db = _make_service()
        db.query.return_value = _chain(rows=[])

        result = svc.get_overdue(BIZ)

        assert result["count"] == 0
        assert result["total_overdue_amount"] == 0.0

    def test_balance_due_rounds_correctly(self):
        svc, db = _make_service()
        lb = _layby_mock(
            balance_due=Decimal("123.456"),
            next_payment_date=date.today() - timedelta(days=1),
        )
        db.query.return_value = _chain(rows=[lb])

        result = svc.get_overdue_laybys(BIZ)

        assert result["laybys"][0]["balance_due"] == 123.46
        assert result["total_overdue_amount"] == 123.46


# ---------------------------------------------------------------------------
# get_aging_report
# ---------------------------------------------------------------------------

class TestGetAgingReport:
    """Tests for get_aging_report."""

    def test_empty_report(self):
        svc, db = _make_service()
        db.query.return_value = _chain(rows=[])

        result = svc.get_aging_report(BIZ)

        assert result["total_active"] == 0
        assert result["as_of"] == date.today().isoformat()
        for bucket in result["buckets"].values():
            assert bucket["count"] == 0
            assert bucket["total_value"] == 0.0
            assert bucket["total_outstanding"] == 0.0

    def test_0_30_bucket(self):
        svc, db = _make_service()
        lb = _layby_mock(
            start_date=date.today() - timedelta(days=10),
            total_amount=Decimal("500.00"),
            balance_due=Decimal("300.00"),
        )
        db.query.return_value = _chain(rows=[lb])

        result = svc.get_aging_report(BIZ)

        assert result["buckets"]["0_30"]["count"] == 1
        assert result["buckets"]["0_30"]["total_value"] == 500.0
        assert result["buckets"]["0_30"]["total_outstanding"] == 300.0
        assert result["total_active"] == 1

    def test_31_60_bucket(self):
        svc, db = _make_service()
        lb = _layby_mock(
            start_date=date.today() - timedelta(days=45),
            total_amount=Decimal("800.00"),
            balance_due=Decimal("400.00"),
        )
        db.query.return_value = _chain(rows=[lb])

        result = svc.get_aging_report(BIZ)

        assert result["buckets"]["31_60"]["count"] == 1
        assert result["buckets"]["31_60"]["total_value"] == 800.0
        assert result["buckets"]["31_60"]["total_outstanding"] == 400.0

    def test_61_90_bucket(self):
        svc, db = _make_service()
        lb = _layby_mock(
            start_date=date.today() - timedelta(days=75),
            total_amount=Decimal("1200.00"),
            balance_due=Decimal("600.00"),
        )
        db.query.return_value = _chain(rows=[lb])

        result = svc.get_aging_report(BIZ)

        assert result["buckets"]["61_90"]["count"] == 1
        assert result["buckets"]["61_90"]["total_value"] == 1200.0
        assert result["buckets"]["61_90"]["total_outstanding"] == 600.0

    def test_90_plus_bucket(self):
        svc, db = _make_service()
        lb = _layby_mock(
            start_date=date.today() - timedelta(days=120),
            total_amount=Decimal("2000.00"),
            balance_due=Decimal("1500.00"),
        )
        db.query.return_value = _chain(rows=[lb])

        result = svc.get_aging_report(BIZ)

        assert result["buckets"]["90_plus"]["count"] == 1
        assert result["buckets"]["90_plus"]["total_value"] == 2000.0
        assert result["buckets"]["90_plus"]["total_outstanding"] == 1500.0

    def test_boundary_day_30(self):
        """Day 30 should fall in 0_30 bucket."""
        svc, db = _make_service()
        lb = _layby_mock(
            start_date=date.today() - timedelta(days=30),
            total_amount=Decimal("100.00"),
            balance_due=Decimal("50.00"),
        )
        db.query.return_value = _chain(rows=[lb])

        result = svc.get_aging_report(BIZ)

        assert result["buckets"]["0_30"]["count"] == 1

    def test_boundary_day_31(self):
        """Day 31 should fall in 31_60 bucket."""
        svc, db = _make_service()
        lb = _layby_mock(
            start_date=date.today() - timedelta(days=31),
            total_amount=Decimal("100.00"),
            balance_due=Decimal("50.00"),
        )
        db.query.return_value = _chain(rows=[lb])

        result = svc.get_aging_report(BIZ)

        assert result["buckets"]["31_60"]["count"] == 1

    def test_boundary_day_60(self):
        """Day 60 should fall in 31_60 bucket."""
        svc, db = _make_service()
        lb = _layby_mock(
            start_date=date.today() - timedelta(days=60),
            total_amount=Decimal("100.00"),
            balance_due=Decimal("50.00"),
        )
        db.query.return_value = _chain(rows=[lb])

        result = svc.get_aging_report(BIZ)

        assert result["buckets"]["31_60"]["count"] == 1

    def test_boundary_day_61(self):
        """Day 61 should fall in 61_90 bucket."""
        svc, db = _make_service()
        lb = _layby_mock(
            start_date=date.today() - timedelta(days=61),
            total_amount=Decimal("100.00"),
            balance_due=Decimal("50.00"),
        )
        db.query.return_value = _chain(rows=[lb])

        result = svc.get_aging_report(BIZ)

        assert result["buckets"]["61_90"]["count"] == 1

    def test_boundary_day_90(self):
        """Day 90 should fall in 61_90 bucket."""
        svc, db = _make_service()
        lb = _layby_mock(
            start_date=date.today() - timedelta(days=90),
            total_amount=Decimal("100.00"),
            balance_due=Decimal("50.00"),
        )
        db.query.return_value = _chain(rows=[lb])

        result = svc.get_aging_report(BIZ)

        assert result["buckets"]["61_90"]["count"] == 1

    def test_boundary_day_91(self):
        """Day 91 should fall in 90_plus bucket."""
        svc, db = _make_service()
        lb = _layby_mock(
            start_date=date.today() - timedelta(days=91),
            total_amount=Decimal("100.00"),
            balance_due=Decimal("50.00"),
        )
        db.query.return_value = _chain(rows=[lb])

        result = svc.get_aging_report(BIZ)

        assert result["buckets"]["90_plus"]["count"] == 1

    def test_multiple_laybys_across_buckets(self):
        svc, db = _make_service()
        laybys = [
            _layby_mock(
                start_date=date.today() - timedelta(days=5),
                total_amount=Decimal("100.00"),
                balance_due=Decimal("80.00"),
            ),
            _layby_mock(
                start_date=date.today() - timedelta(days=40),
                total_amount=Decimal("200.00"),
                balance_due=Decimal("150.00"),
            ),
            _layby_mock(
                start_date=date.today() - timedelta(days=70),
                total_amount=Decimal("300.00"),
                balance_due=Decimal("200.00"),
            ),
            _layby_mock(
                start_date=date.today() - timedelta(days=100),
                total_amount=Decimal("400.00"),
                balance_due=Decimal("350.00"),
            ),
        ]
        db.query.return_value = _chain(rows=laybys)

        result = svc.get_aging_report(BIZ)

        assert result["total_active"] == 4
        assert result["buckets"]["0_30"]["count"] == 1
        assert result["buckets"]["31_60"]["count"] == 1
        assert result["buckets"]["61_90"]["count"] == 1
        assert result["buckets"]["90_plus"]["count"] == 1

    def test_multiple_in_same_bucket(self):
        svc, db = _make_service()
        lb1 = _layby_mock(
            start_date=date.today() - timedelta(days=5),
            total_amount=Decimal("100.00"),
            balance_due=Decimal("60.00"),
        )
        lb2 = _layby_mock(
            start_date=date.today() - timedelta(days=20),
            total_amount=Decimal("200.00"),
            balance_due=Decimal("140.00"),
        )
        db.query.return_value = _chain(rows=[lb1, lb2])

        result = svc.get_aging_report(BIZ)

        assert result["buckets"]["0_30"]["count"] == 2
        assert result["buckets"]["0_30"]["total_value"] == 300.0
        assert result["buckets"]["0_30"]["total_outstanding"] == 200.0
        assert result["total_active"] == 2

    def test_none_start_date_defaults_zero_days(self):
        """Layby with no start_date should go into the 0_30 bucket (0 days age)."""
        svc, db = _make_service()
        lb = _layby_mock(
            start_date=None,
            total_amount=Decimal("500.00"),
            balance_due=Decimal("250.00"),
        )
        db.query.return_value = _chain(rows=[lb])

        result = svc.get_aging_report(BIZ)

        assert result["buckets"]["0_30"]["count"] == 1

    def test_today_start_date_is_zero_days(self):
        svc, db = _make_service()
        lb = _layby_mock(
            start_date=date.today(),
            total_amount=Decimal("500.00"),
            balance_due=Decimal("250.00"),
        )
        db.query.return_value = _chain(rows=[lb])

        result = svc.get_aging_report(BIZ)

        assert result["buckets"]["0_30"]["count"] == 1

    def test_as_of_field(self):
        svc, db = _make_service()
        db.query.return_value = _chain(rows=[])

        result = svc.get_aging_report(BIZ)

        assert result["as_of"] == date.today().isoformat()

    def test_all_bucket_keys_present(self):
        svc, db = _make_service()
        db.query.return_value = _chain(rows=[])

        result = svc.get_aging_report(BIZ)

        assert set(result["buckets"].keys()) == {"0_30", "31_60", "61_90", "90_plus"}


# ---------------------------------------------------------------------------
# get_summary
# ---------------------------------------------------------------------------

class TestGetSummary:
    """Tests for get_summary."""

    def _setup_summary(
        self,
        created_count=0,
        created_value=0,
        completed_count=0,
        cancelled_count=0,
        payment_count=0,
        payment_total=0,
        refund_total=0,
        active_count=0,
    ):
        """Set up mocks for the 7 sequential db.query calls in get_summary."""
        svc, db = _make_service()

        # Call 1: created_count (scalar)
        q_created_count = _chain(count=created_count)

        # Call 2: created_value (scalar)
        q_created_value = _chain(count=Decimal(str(created_value)))

        # Call 3: completed_count (scalar)
        q_completed_count = _chain(count=completed_count)

        # Call 4: cancelled_count (scalar)
        q_cancelled_count = _chain(count=cancelled_count)

        # Call 5: payments_row (one) — needs .payment_count and .payment_total
        payments_row = MagicMock()
        payments_row.payment_count = payment_count
        payments_row.payment_total = Decimal(str(payment_total))
        q_payments = _chain(first=payments_row)

        # Call 6: refund_total (scalar)
        q_refund = _chain(count=Decimal(str(refund_total)))

        # Call 7: active_count (scalar)
        q_active = _chain(count=active_count)

        db.query.side_effect = [
            q_created_count,
            q_created_value,
            q_completed_count,
            q_cancelled_count,
            q_payments,
            q_refund,
            q_active,
        ]
        return svc, db

    def test_full_summary(self):
        svc, _ = self._setup_summary(
            created_count=10,
            created_value=25000,
            completed_count=3,
            cancelled_count=1,
            payment_count=20,
            payment_total=15000,
            refund_total=500,
            active_count=6,
        )

        result = svc.get_summary(BIZ, date(2025, 1, 1), date(2025, 1, 31))

        assert result["start_date"] == "2025-01-01"
        assert result["end_date"] == "2025-01-31"
        assert result["created"]["count"] == 10
        assert result["created"]["total_value"] == 25000.0
        assert result["completed"]["count"] == 3
        assert result["cancelled"]["count"] == 1
        assert result["payments"]["count"] == 20
        assert result["payments"]["total"] == 15000.0
        assert result["refunds"]["total"] == 500.0
        assert result["active_snapshot"]["count"] == 6

    def test_all_zeros(self):
        svc, _ = self._setup_summary()

        result = svc.get_summary(BIZ, date(2025, 1, 1), date(2025, 1, 31))

        assert result["created"]["count"] == 0
        assert result["created"]["total_value"] == 0.0
        assert result["completed"]["count"] == 0
        assert result["cancelled"]["count"] == 0
        assert result["payments"]["count"] == 0
        assert result["payments"]["total"] == 0.0
        assert result["refunds"]["total"] == 0.0
        assert result["active_snapshot"]["count"] == 0

    def test_date_range_in_output(self):
        svc, _ = self._setup_summary()

        result = svc.get_summary(BIZ, date(2024, 6, 1), date(2024, 6, 30))

        assert result["start_date"] == "2024-06-01"
        assert result["end_date"] == "2024-06-30"

    def test_created_count_none_defaults_to_zero(self):
        """When scalar returns None for created_count, should default to 0."""
        svc, db = _make_service()

        q_created_count = _chain(count=None)
        q_created_value = _chain(count=Decimal("0"))
        q_completed_count = _chain(count=None)
        q_cancelled_count = _chain(count=None)
        payments_row = MagicMock()
        payments_row.payment_count = 0
        payments_row.payment_total = Decimal("0")
        q_payments = _chain(first=payments_row)
        q_refund = _chain(count=Decimal("0"))
        q_active = _chain(count=None)

        db.query.side_effect = [
            q_created_count,
            q_created_value,
            q_completed_count,
            q_cancelled_count,
            q_payments,
            q_refund,
            q_active,
        ]

        result = svc.get_summary(BIZ, date(2025, 1, 1), date(2025, 1, 31))

        assert result["created"]["count"] == 0
        assert result["completed"]["count"] == 0
        assert result["cancelled"]["count"] == 0
        assert result["active_snapshot"]["count"] == 0

    def test_decimal_precision_in_summary(self):
        svc, _ = self._setup_summary(
            created_count=1,
            created_value="1234.56",
            payment_count=2,
            payment_total="567.89",
            refund_total="12.34",
        )

        result = svc.get_summary(BIZ, date(2025, 1, 1), date(2025, 1, 31))

        assert result["created"]["total_value"] == 1234.56
        assert result["payments"]["total"] == 567.89
        assert result["refunds"]["total"] == 12.34

    def test_single_day_range(self):
        svc, _ = self._setup_summary(created_count=1, created_value=100)

        result = svc.get_summary(BIZ, date(2025, 3, 15), date(2025, 3, 15))

        assert result["start_date"] == "2025-03-15"
        assert result["end_date"] == "2025-03-15"
        assert result["created"]["count"] == 1

    def test_seven_queries_are_made(self):
        svc, db = self._setup_summary()
        svc.get_summary(BIZ, date(2025, 1, 1), date(2025, 1, 31))

        assert db.query.call_count == 7

    def test_return_types(self):
        svc, _ = self._setup_summary(
            created_count=2,
            created_value=500,
            completed_count=1,
            cancelled_count=0,
            payment_count=3,
            payment_total=200,
            refund_total=50,
            active_count=1,
        )

        result = svc.get_summary(BIZ, date(2025, 1, 1), date(2025, 1, 31))

        assert isinstance(result["created"]["count"], int)
        assert isinstance(result["created"]["total_value"], float)
        assert isinstance(result["completed"]["count"], int)
        assert isinstance(result["cancelled"]["count"], int)
        assert isinstance(result["payments"]["count"], int)
        assert isinstance(result["payments"]["total"], float)
        assert isinstance(result["refunds"]["total"], float)
        assert isinstance(result["active_snapshot"]["count"], int)

    def test_only_payments_no_refunds(self):
        svc, _ = self._setup_summary(
            payment_count=5,
            payment_total=2500,
            refund_total=0,
        )

        result = svc.get_summary(BIZ, date(2025, 1, 1), date(2025, 1, 31))

        assert result["payments"]["count"] == 5
        assert result["payments"]["total"] == 2500.0
        assert result["refunds"]["total"] == 0.0

    def test_only_refunds_no_payments(self):
        svc, _ = self._setup_summary(
            payment_count=0,
            payment_total=0,
            refund_total=750,
        )

        result = svc.get_summary(BIZ, date(2025, 1, 1), date(2025, 1, 31))

        assert result["payments"]["count"] == 0
        assert result["payments"]["total"] == 0.0
        assert result["refunds"]["total"] == 750.0

    def test_large_values_in_summary(self):
        svc, _ = self._setup_summary(
            created_count=500,
            created_value="9999999.99",
            completed_count=200,
            cancelled_count=50,
            payment_count=1000,
            payment_total="5555555.55",
            refund_total="111111.11",
            active_count=250,
        )

        result = svc.get_summary(BIZ, date(2025, 1, 1), date(2025, 12, 31))

        assert result["created"]["count"] == 500
        assert result["created"]["total_value"] == 9999999.99
        assert result["completed"]["count"] == 200
        assert result["cancelled"]["count"] == 50
        assert result["payments"]["total"] == 5555555.55
        assert result["refunds"]["total"] == 111111.11
        assert result["active_snapshot"]["count"] == 250
