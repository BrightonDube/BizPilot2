"""Unit tests for ProformaReportService.

Covers conversion-rate analytics, value reports, aging buckets,
and lost-quotes breakdowns using mocked DB sessions.
"""

import os
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

os.environ.setdefault("SECRET_KEY", "test-secret-key")

from app.models.proforma import QuoteStatus
from app.services.proforma_report_service import ProformaReportService

BIZ_ID = str(uuid.uuid4())


# -- Helpers ---------------------------------------------------------------


def _chain(first=None, rows=None, count=0):
    """Chainable query mock supporting filter/order_by/offset/limit/all/first/count/scalar/one."""
    q = MagicMock()
    q.filter = MagicMock(return_value=q)
    q.order_by = MagicMock(return_value=q)
    q.offset = MagicMock(return_value=q)
    q.limit = MagicMock(return_value=q)
    q.all = MagicMock(return_value=rows or [])
    q.first = MagicMock(return_value=first)
    q.count = MagicMock(return_value=count)
    q.scalar = MagicMock(return_value=count)
    q.one = MagicMock(return_value=first)
    return q


def _make_quote(**overrides):
    """Build a minimal ProformaInvoice-like mock."""
    q = MagicMock()
    q.id = overrides.get("id", uuid.uuid4())
    q.business_id = overrides.get("business_id", uuid.uuid4())
    q.customer_id = overrides.get("customer_id", None)
    q.quote_number = overrides.get("quote_number", "QT-001")
    q.status = overrides.get("status", MagicMock(value="draft"))
    q.issue_date = overrides.get("issue_date", date.today())
    q.total = overrides.get("total", Decimal("115.00"))
    q.rejection_reason = overrides.get("rejection_reason", None)
    q.created_at = overrides.get("created_at", datetime.now(timezone.utc))
    q.deleted_at = None
    return q


# ==========================================================================
# get_conversion_rate
# ==========================================================================


class TestGetConversionRate:
    """Tests for ProformaReportService.get_conversion_rate."""

    def _setup_db(self, total, status_counts):
        """Return a mocked db where base.count() == total and
        base.filter(status==X).count() yields *status_counts* in order
        (approved, converted, rejected, expired, cancelled).
        """
        db = MagicMock()
        base_q = MagicMock()
        db.query.return_value = base_q

        # First .filter() call (business_id + deleted_at) returns sub_q
        sub_q = MagicMock()
        base_q.filter.return_value = sub_q
        sub_q.count.return_value = total

        # Each subsequent sub_q.filter(status==X) returns a mock whose
        # .count() yields the next value from status_counts.
        status_q = MagicMock()
        sub_q.filter.return_value = status_q
        status_q.count.side_effect = list(status_counts)

        return db

    def test_basic_counts(self):
        db = self._setup_db(total=100, status_counts=[20, 30, 10, 5, 3])
        result = ProformaReportService(db).get_conversion_rate(BIZ_ID)

        assert result["total_quotes"] == 100
        assert result["approved"] == 20
        assert result["converted"] == 30
        assert result["rejected"] == 10
        assert result["expired"] == 5
        assert result["cancelled"] == 3

    def test_conversion_rate_calculation(self):
        db = self._setup_db(total=100, status_counts=[20, 30, 10, 5, 3])
        result = ProformaReportService(db).get_conversion_rate(BIZ_ID)

        assert result["conversion_rate"] == 30.0   # 30/100*100
        assert result["approval_rate"] == 50.0      # (20+30)/100*100

    def test_zero_total_returns_all_zeros(self):
        db = self._setup_db(total=0, status_counts=[])
        result = ProformaReportService(db).get_conversion_rate(BIZ_ID)

        assert result == {
            "total_quotes": 0,
            "approved": 0,
            "converted": 0,
            "rejected": 0,
            "expired": 0,
            "cancelled": 0,
            "conversion_rate": 0.0,
            "approval_rate": 0.0,
        }

    def test_all_converted(self):
        db = self._setup_db(total=50, status_counts=[0, 50, 0, 0, 0])
        result = ProformaReportService(db).get_conversion_rate(BIZ_ID)

        assert result["conversion_rate"] == 100.0
        assert result["approval_rate"] == 100.0

    def test_no_conversions(self):
        db = self._setup_db(total=40, status_counts=[0, 0, 20, 10, 10])
        result = ProformaReportService(db).get_conversion_rate(BIZ_ID)

        assert result["conversion_rate"] == 0.0
        assert result["approval_rate"] == 0.0

    def test_rounding(self):
        # 3 converted out of 7 = 42.857...% => 42.9
        db = self._setup_db(total=7, status_counts=[1, 3, 1, 1, 1])
        result = ProformaReportService(db).get_conversion_rate(BIZ_ID)

        assert result["conversion_rate"] == 42.9
        assert result["approval_rate"] == 57.1  # (1+3)/7*100

    def test_single_quote_converted(self):
        db = self._setup_db(total=1, status_counts=[0, 1, 0, 0, 0])
        result = ProformaReportService(db).get_conversion_rate(BIZ_ID)

        assert result["total_quotes"] == 1
        assert result["conversion_rate"] == 100.0
        assert result["approval_rate"] == 100.0

    def test_all_rejected(self):
        db = self._setup_db(total=10, status_counts=[0, 0, 10, 0, 0])
        result = ProformaReportService(db).get_conversion_rate(BIZ_ID)

        assert result["rejected"] == 10
        assert result["conversion_rate"] == 0.0
        assert result["approval_rate"] == 0.0

    def test_approved_but_not_converted(self):
        db = self._setup_db(total=20, status_counts=[15, 0, 3, 1, 1])
        result = ProformaReportService(db).get_conversion_rate(BIZ_ID)

        assert result["conversion_rate"] == 0.0
        assert result["approval_rate"] == 75.0  # (15+0)/20*100


# ==========================================================================
# get_value_report
# ==========================================================================


class TestGetValueReport:
    """Tests for ProformaReportService.get_value_report."""

    @staticmethod
    def _agg_row(cnt=0, total_val=0, avg_val=0, min_val=0, max_val=0):
        """Create a named-tuple-like mock for the aggregate row."""
        row = MagicMock()
        row.cnt = cnt
        row.total_val = Decimal(str(total_val))
        row.avg_val = Decimal(str(avg_val))
        row.min_val = Decimal(str(min_val))
        row.max_val = Decimal(str(max_val))
        return row

    def _setup_db(self, row):
        """db.query is called twice:
        1st: db.query(ProformaInvoice).filter(...)  -> unused base
        2nd: db.query(func.count, ...).filter(...).one() -> row
        """
        db = MagicMock()
        unused_chain = _chain()
        result_chain = _chain(first=row)
        db.query.side_effect = [unused_chain, result_chain]
        return db

    def test_basic_aggregates(self):
        row = self._agg_row(cnt=5, total_val=500, avg_val=100, min_val=50, max_val=200)
        db = self._setup_db(row)
        result = ProformaReportService(db).get_value_report(
            BIZ_ID, start_date=date(2025, 1, 1), end_date=date(2025, 1, 31),
        )

        assert result["total_quotes"] == 5
        assert result["total_value"] == 500.0
        assert result["avg_value"] == 100.0
        assert result["min_value"] == 50.0
        assert result["max_value"] == 200.0

    def test_period_dates_explicit(self):
        row = self._agg_row()
        db = self._setup_db(row)
        result = ProformaReportService(db).get_value_report(
            BIZ_ID, start_date=date(2025, 3, 1), end_date=date(2025, 3, 31),
        )

        assert result["period_start"] == "2025-03-01"
        assert result["period_end"] == "2025-03-31"

    def test_default_dates(self):
        """When no dates supplied, end_date=today, start_date=today-30."""
        row = self._agg_row()
        db = self._setup_db(row)
        result = ProformaReportService(db).get_value_report(BIZ_ID)

        today = date.today()
        assert result["period_end"] == today.isoformat()
        assert result["period_start"] == (today - timedelta(days=30)).isoformat()

    def test_default_start_with_explicit_end(self):
        row = self._agg_row()
        db = self._setup_db(row)
        end = date(2025, 6, 15)
        result = ProformaReportService(db).get_value_report(BIZ_ID, end_date=end)

        assert result["period_end"] == "2025-06-15"
        assert result["period_start"] == (end - timedelta(days=30)).isoformat()

    def test_zero_quotes(self):
        row = self._agg_row(cnt=0, total_val=0, avg_val=0, min_val=0, max_val=0)
        db = self._setup_db(row)
        result = ProformaReportService(db).get_value_report(
            BIZ_ID, start_date=date(2025, 1, 1), end_date=date(2025, 1, 31),
        )

        assert result["total_quotes"] == 0
        assert result["total_value"] == 0.0
        assert result["avg_value"] == 0.0

    def test_decimal_rounding(self):
        row = self._agg_row(
            cnt=3, total_val="333.333", avg_val="111.111",
            min_val="99.999", max_val="133.335",
        )
        db = self._setup_db(row)
        result = ProformaReportService(db).get_value_report(
            BIZ_ID, start_date=date(2025, 1, 1), end_date=date(2025, 1, 31),
        )

        assert result["total_value"] == 333.33
        assert result["avg_value"] == 111.11
        assert result["min_value"] == 100.0
        assert result["max_value"] == 133.34

    def test_large_values(self):
        row = self._agg_row(
            cnt=1000, total_val="9999999.99", avg_val="9999.99",
            min_val="0.01", max_val="99999.99",
        )
        db = self._setup_db(row)
        result = ProformaReportService(db).get_value_report(
            BIZ_ID, start_date=date(2025, 1, 1), end_date=date(2025, 12, 31),
        )

        assert result["total_quotes"] == 1000
        assert result["total_value"] == 9999999.99
        assert result["min_value"] == 0.01


# ==========================================================================
# get_aging_report
# ==========================================================================


class TestGetAgingReport:
    """Tests for ProformaReportService.get_aging_report."""

    def _setup_db(self, quotes):
        db = MagicMock()
        chain = _chain(rows=quotes)
        db.query.return_value = chain
        return db

    def test_all_buckets(self):
        today = date.today()
        quotes = [
            _make_quote(issue_date=today),                         # age 0 -> 0-7
            _make_quote(issue_date=today - timedelta(days=5)),     # age 5 -> 0-7
            _make_quote(issue_date=today - timedelta(days=10)),    # age 10 -> 8-14
            _make_quote(issue_date=today - timedelta(days=14)),    # age 14 -> 8-14
            _make_quote(issue_date=today - timedelta(days=20)),    # age 20 -> 15-30
            _make_quote(issue_date=today - timedelta(days=30)),    # age 30 -> 15-30
            _make_quote(issue_date=today - timedelta(days=31)),    # age 31 -> 30+
            _make_quote(issue_date=today - timedelta(days=90)),    # age 90 -> 30+
        ]
        db = self._setup_db(quotes)
        result = ProformaReportService(db).get_aging_report(BIZ_ID)

        assert result["bucket_0_7"] == 2
        assert result["bucket_8_14"] == 2
        assert result["bucket_15_30"] == 2
        assert result["bucket_30_plus"] == 2
        assert result["total"] == 8

    def test_empty_quotes(self):
        db = self._setup_db([])
        result = ProformaReportService(db).get_aging_report(BIZ_ID)

        assert result == {
            "bucket_0_7": 0,
            "bucket_8_14": 0,
            "bucket_15_30": 0,
            "bucket_30_plus": 0,
            "total": 0,
        }

    def test_all_in_first_bucket(self):
        today = date.today()
        quotes = [
            _make_quote(issue_date=today),
            _make_quote(issue_date=today - timedelta(days=3)),
            _make_quote(issue_date=today - timedelta(days=7)),
        ]
        db = self._setup_db(quotes)
        result = ProformaReportService(db).get_aging_report(BIZ_ID)

        assert result["bucket_0_7"] == 3
        assert result["bucket_8_14"] == 0
        assert result["bucket_15_30"] == 0
        assert result["bucket_30_plus"] == 0
        assert result["total"] == 3

    def test_all_overdue(self):
        today = date.today()
        quotes = [
            _make_quote(issue_date=today - timedelta(days=60)),
            _make_quote(issue_date=today - timedelta(days=120)),
        ]
        db = self._setup_db(quotes)
        result = ProformaReportService(db).get_aging_report(BIZ_ID)

        assert result["bucket_30_plus"] == 2
        assert result["total"] == 2

    def test_none_issue_date_treated_as_zero_age(self):
        """If issue_date is None, age defaults to 0 -> bucket 0-7."""
        quotes = [_make_quote(issue_date=None)]
        db = self._setup_db(quotes)
        result = ProformaReportService(db).get_aging_report(BIZ_ID)

        assert result["bucket_0_7"] == 1
        assert result["total"] == 1

    def test_boundary_day_7(self):
        """Day 7 stays in 0-7 bucket."""
        today = date.today()
        quotes = [_make_quote(issue_date=today - timedelta(days=7))]
        db = self._setup_db(quotes)
        result = ProformaReportService(db).get_aging_report(BIZ_ID)

        assert result["bucket_0_7"] == 1

    def test_boundary_day_8(self):
        """Day 8 goes to 8-14 bucket."""
        today = date.today()
        quotes = [_make_quote(issue_date=today - timedelta(days=8))]
        db = self._setup_db(quotes)
        result = ProformaReportService(db).get_aging_report(BIZ_ID)

        assert result["bucket_8_14"] == 1

    def test_boundary_day_14(self):
        today = date.today()
        quotes = [_make_quote(issue_date=today - timedelta(days=14))]
        db = self._setup_db(quotes)
        result = ProformaReportService(db).get_aging_report(BIZ_ID)

        assert result["bucket_8_14"] == 1

    def test_boundary_day_15(self):
        today = date.today()
        quotes = [_make_quote(issue_date=today - timedelta(days=15))]
        db = self._setup_db(quotes)
        result = ProformaReportService(db).get_aging_report(BIZ_ID)

        assert result["bucket_15_30"] == 1

    def test_boundary_day_30(self):
        today = date.today()
        quotes = [_make_quote(issue_date=today - timedelta(days=30))]
        db = self._setup_db(quotes)
        result = ProformaReportService(db).get_aging_report(BIZ_ID)

        assert result["bucket_15_30"] == 1

    def test_boundary_day_31(self):
        today = date.today()
        quotes = [_make_quote(issue_date=today - timedelta(days=31))]
        db = self._setup_db(quotes)
        result = ProformaReportService(db).get_aging_report(BIZ_ID)

        assert result["bucket_30_plus"] == 1


# ==========================================================================
# get_lost_quotes
# ==========================================================================


class TestGetLostQuotes:
    """Tests for ProformaReportService.get_lost_quotes."""

    def _setup_db(self, quotes):
        db = MagicMock()
        chain = _chain(rows=quotes)
        db.query.return_value = chain
        return db

    def test_mix_rejected_and_expired(self):
        cust_id = uuid.uuid4()
        now = datetime.now(timezone.utc)
        quotes = [
            _make_quote(
                status=QuoteStatus.REJECTED,
                total=Decimal("200.00"),
                rejection_reason="Too expensive",
                customer_id=cust_id,
                quote_number="QT-R1",
                created_at=now,
            ),
            _make_quote(
                status=QuoteStatus.EXPIRED,
                total=Decimal("300.00"),
                quote_number="QT-E1",
                created_at=now,
            ),
        ]
        db = self._setup_db(quotes)
        result = ProformaReportService(db).get_lost_quotes(
            BIZ_ID, start_date=date(2025, 1, 1), end_date=date(2025, 12, 31),
        )

        assert result["total_lost"] == 2
        assert result["total_value"] == 500.0
        assert result["rejected_count"] == 1
        assert result["expired_count"] == 1

        # Check items detail
        assert len(result["items"]) == 2
        assert result["items"][0]["status"] == "rejected"
        assert result["items"][0]["reason"] == "Too expensive"
        assert result["items"][0]["total"] == 200.0
        assert result["items"][1]["status"] == "expired"
        assert result["items"][1]["reason"] == "Expired"

    def test_empty_results(self):
        db = self._setup_db([])
        result = ProformaReportService(db).get_lost_quotes(
            BIZ_ID, start_date=date(2025, 1, 1), end_date=date(2025, 12, 31),
        )

        assert result == {
            "total_lost": 0,
            "total_value": 0.0,
            "rejected_count": 0,
            "expired_count": 0,
            "items": [],
        }

    def test_default_dates(self):
        """end_date defaults to today, start_date to today-90."""
        db = self._setup_db([])
        # Should not raise; dates are computed internally
        result = ProformaReportService(db).get_lost_quotes(BIZ_ID)

        assert result["total_lost"] == 0

    def test_default_start_with_explicit_end(self):
        db = self._setup_db([])
        end = date(2025, 6, 15)
        result = ProformaReportService(db).get_lost_quotes(BIZ_ID, end_date=end)
        assert result["total_lost"] == 0

    def test_all_rejected(self):
        quotes = [
            _make_quote(
                status=QuoteStatus.REJECTED,
                total=Decimal("100.00"),
                rejection_reason="Budget cut",
                quote_number=f"QT-R{i}",
            )
            for i in range(3)
        ]
        db = self._setup_db(quotes)
        result = ProformaReportService(db).get_lost_quotes(
            BIZ_ID, start_date=date(2025, 1, 1), end_date=date(2025, 12, 31),
        )

        assert result["rejected_count"] == 3
        assert result["expired_count"] == 0
        assert result["total_value"] == 300.0

    def test_all_expired(self):
        quotes = [
            _make_quote(
                status=QuoteStatus.EXPIRED,
                total=Decimal("50.00"),
                quote_number=f"QT-E{i}",
            )
            for i in range(4)
        ]
        db = self._setup_db(quotes)
        result = ProformaReportService(db).get_lost_quotes(
            BIZ_ID, start_date=date(2025, 1, 1), end_date=date(2025, 12, 31),
        )

        assert result["rejected_count"] == 0
        assert result["expired_count"] == 4
        assert result["total_value"] == 200.0
        for item in result["items"]:
            assert item["reason"] == "Expired"

    def test_none_total_treated_as_zero(self):
        quotes = [
            _make_quote(
                status=QuoteStatus.REJECTED,
                total=None,
                rejection_reason="N/A",
                quote_number="QT-N1",
            ),
        ]
        db = self._setup_db(quotes)
        result = ProformaReportService(db).get_lost_quotes(
            BIZ_ID, start_date=date(2025, 1, 1), end_date=date(2025, 12, 31),
        )

        assert result["total_value"] == 0.0
        assert result["items"][0]["total"] == 0

    def test_none_customer_id(self):
        quotes = [
            _make_quote(
                status=QuoteStatus.EXPIRED,
                total=Decimal("10.00"),
                customer_id=None,
                quote_number="QT-NC",
            ),
        ]
        db = self._setup_db(quotes)
        result = ProformaReportService(db).get_lost_quotes(
            BIZ_ID, start_date=date(2025, 1, 1), end_date=date(2025, 12, 31),
        )

        assert result["items"][0]["customer_id"] is None

    def test_customer_id_stringified(self):
        cid = uuid.uuid4()
        quotes = [
            _make_quote(
                status=QuoteStatus.REJECTED,
                total=Decimal("10.00"),
                customer_id=cid,
                rejection_reason="Price",
                quote_number="QT-CID",
            ),
        ]
        db = self._setup_db(quotes)
        result = ProformaReportService(db).get_lost_quotes(
            BIZ_ID, start_date=date(2025, 1, 1), end_date=date(2025, 12, 31),
        )

        assert result["items"][0]["customer_id"] == str(cid)

    def test_none_created_at(self):
        quotes = [
            _make_quote(
                status=QuoteStatus.EXPIRED,
                total=Decimal("10.00"),
                created_at=None,
                quote_number="QT-NCA",
            ),
        ]
        db = self._setup_db(quotes)
        result = ProformaReportService(db).get_lost_quotes(
            BIZ_ID, start_date=date(2025, 1, 1), end_date=date(2025, 12, 31),
        )

        assert result["items"][0]["created_at"] is None

    def test_created_at_iso_format(self):
        ts = datetime(2025, 3, 15, 10, 30, 0, tzinfo=timezone.utc)
        quotes = [
            _make_quote(
                status=QuoteStatus.REJECTED,
                total=Decimal("99.00"),
                rejection_reason="Changed vendor",
                created_at=ts,
                quote_number="QT-ISO",
            ),
        ]
        db = self._setup_db(quotes)
        result = ProformaReportService(db).get_lost_quotes(
            BIZ_ID, start_date=date(2025, 1, 1), end_date=date(2025, 12, 31),
        )

        assert result["items"][0]["created_at"] == ts.isoformat()

    def test_quote_id_stringified(self):
        qid = uuid.uuid4()
        quotes = [
            _make_quote(
                id=qid,
                status=QuoteStatus.EXPIRED,
                total=Decimal("1.00"),
                quote_number="QT-QID",
            ),
        ]
        db = self._setup_db(quotes)
        result = ProformaReportService(db).get_lost_quotes(
            BIZ_ID, start_date=date(2025, 1, 1), end_date=date(2025, 12, 31),
        )

        assert result["items"][0]["quote_id"] == str(qid)
