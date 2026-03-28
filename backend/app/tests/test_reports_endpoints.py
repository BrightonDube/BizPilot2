"""Endpoint-level tests for Extended Reports (vt39 + yk5q).

Covers:
  - GET /reports/user-activity  (UserActivityReport)
  - GET /reports/login-history  (LoginHistoryReport)
  - GET /reports/export/excel   (Excel download, all 5 report types)
  - check_feature dependency    (RBAC gate: superadmin bypass, 403, 200)

Strategy: call the async endpoint functions directly with mocked db/user args.
This keeps tests fast, deterministic, and free of a real database.
"""

import os
os.environ.setdefault("SECRET_KEY", "test-secret-key-32-bytes-minimum")

import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, AsyncMock, patch
from uuid import uuid4
from fastapi import HTTPException

from app.api.reports import (
    get_user_activity_report,
    get_login_history_report,
    export_report_excel,
)

# ── Constants ────────────────────────────────────────────────────────────────

BIZ_ID = str(uuid4())


# ── Helpers ──────────────────────────────────────────────────────────────────

def _user(is_superadmin=False):
    """Minimal User mock."""
    u = MagicMock()
    u.id = uuid4()
    u.is_superadmin = is_superadmin
    u.first_name = "Test"
    u.last_name = "User"
    u.email = "test@example.com"
    return u


def _chain(rows=None, first=None):
    """
    SQLAlchemy query-chain mock.

    All filter/join/group_by etc. calls return self so chaining works.
    Terminal methods (.all(), .first()) return the supplied values.
    """
    c = MagicMock()
    for m in ("filter", "join", "group_by", "order_by", "limit",
              "distinct", "having", "options"):
        getattr(c, m).return_value = c
    c.all.return_value = rows if rows is not None else []
    c.first.return_value = first
    c.count.return_value = len(rows) if rows else 0
    return c


def _time_entry_row(uid=None, hours=8.0, entries=1, break_dur=0.0):
    """Build a mock row matching the TimeEntry aggregate query."""
    r = MagicMock()
    r.user_id = uid or uuid4()
    r.first_name = "Alice"
    r.last_name = "Smith"
    r.total_hours = hours
    r.total_entries = entries
    r.clock_ins = entries
    r.clock_outs = entries
    r.break_duration = break_dur
    r.last_activity = datetime(2025, 3, 10, 17, 0)
    return r


def _session_row(uid=None, is_active=False, ip="1.2.3.4",
                 revoked_at=None, created_at=None):
    """Build a minimal Session mock for login-history queries."""
    s = MagicMock()
    s.id = uuid4()
    s.user_id = uid or uuid4()
    s.is_active = is_active
    s.ip_address = ip
    s.revoked_at = revoked_at
    s.expires_at = datetime.utcnow() + timedelta(hours=1)
    s.created_at = created_at or datetime.utcnow()
    s.device_name = "Chrome"
    s.device_type = "web"
    s.location = "Cape Town"
    return s


def _user_row(uid=None, first="Carol", last="Jones"):
    """Build a minimal User model mock."""
    u = MagicMock()
    u.id = uid or uuid4()
    u.first_name = first
    u.last_name = last
    u.email = "carol@example.com"
    return u


def _sales_svc():
    """SalesReportService mock returning one-item lists for each report type."""
    svc = MagicMock()
    svc.get_product_performance.return_value = {
        "products": [{"rank": 1, "product_name": "Widget", "quantity_sold": 5,
                      "revenue": 250.0, "order_count": 3, "revenue_percentage": 100.0}]
    }
    svc.get_category_performance.return_value = {
        "categories": [{"category_name": "Gear", "quantity_sold": 5,
                        "revenue": 250.0, "order_count": 3, "revenue_percentage": 100.0}]
    }
    svc.get_payment_breakdown.return_value = {
        "methods": [{"payment_method": "cash", "count": 3, "amount": 250.0,
                     "percentage_amount": 100.0, "percentage_count": 100.0}]
    }
    svc.get_discount_analysis.return_value = {
        "by_product": [{"product_name": "Widget", "discount_total": 5.0,
                        "revenue": 245.0, "discount_percentage": 2.0, "item_count": 3}]
    }
    svc.get_refund_analysis.return_value = {
        "by_product": [{"product_name": "Widget", "refund_total": 10.0,
                        "quantity": 1, "refund_count": 1, "percentage_of_refunds": 100.0}]
    }
    return svc


# ── User Activity ─────────────────────────────────────────────────────────────


class TestUserActivityReport:
    """GET /reports/user-activity"""

    @pytest.mark.asyncio
    async def test_empty_business_id_returns_zeroed_report(self):
        """Missing business_id short-circuits before querying the db."""
        result = await get_user_activity_report(
            range="30d", user_id=None,
            current_user=_user(), business_id="", db=MagicMock(),
        )
        assert result.total_users == 0
        assert result.total_hours == 0.0
        assert result.items == []

    @pytest.mark.asyncio
    async def test_single_user_entry_is_aggregated(self):
        """One time-entry row produces one item with correct totals."""
        row = _time_entry_row(hours=8.0, entries=2, break_dur=0.5)
        db = MagicMock()
        # query 1 = aggregate; query 2 = active-session check (no active)
        db.query.side_effect = [_chain(rows=[row]), _chain(first=None)]

        result = await get_user_activity_report(
            range="30d", user_id=None,
            current_user=_user(), business_id=BIZ_ID, db=db,
        )

        assert result.total_users == 1
        assert result.total_hours == 8.0
        assert result.average_hours_per_user == 8.0
        item = result.items[0]
        assert item.user_name == "Alice Smith"
        assert item.clock_ins == 2
        assert item.break_duration == 0.5
        assert item.status == "completed"

    @pytest.mark.asyncio
    async def test_open_clock_in_marks_user_active(self):
        """User with no clock-out in the db gets status='active'."""
        row = _time_entry_row(hours=3.0)
        db = MagicMock()
        db.query.side_effect = [
            _chain(rows=[row]),
            _chain(first=MagicMock()),  # active session exists
        ]

        result = await get_user_activity_report(
            range="7d", user_id=None,
            current_user=_user(), business_id=BIZ_ID, db=db,
        )

        assert result.items[0].status == "active"

    @pytest.mark.asyncio
    async def test_null_names_fall_back_to_unknown(self):
        """Users with no first/last name appear as 'Unknown'."""
        row = _time_entry_row()
        row.first_name = None
        row.last_name = None
        row.last_activity = None
        db = MagicMock()
        db.query.side_effect = [_chain(rows=[row]), _chain(first=None)]

        result = await get_user_activity_report(
            range="30d", user_id=None,
            current_user=_user(), business_id=BIZ_ID, db=db,
        )

        assert result.items[0].user_name == "Unknown"
        assert result.items[0].last_activity is None

    @pytest.mark.asyncio
    async def test_no_entries_returns_zero_average(self):
        """No time entries → average_hours_per_user stays 0 (no ZeroDivisionError)."""
        db = MagicMock()
        db.query.return_value = _chain(rows=[])

        result = await get_user_activity_report(
            range="90d", user_id=None,
            current_user=_user(), business_id=BIZ_ID, db=db,
        )

        assert result.average_hours_per_user == 0


# ── Login History ─────────────────────────────────────────────────────────────


class TestLoginHistoryReport:
    """GET /reports/login-history"""

    @pytest.mark.asyncio
    async def test_empty_business_id_returns_zeroed_report(self):
        result = await get_login_history_report(
            range="30d", user_id=None, include_active=True,
            current_user=_user(), business_id="", db=MagicMock(),
        )
        assert result.total_sessions == 0
        assert result.active_sessions == 0

    @pytest.mark.asyncio
    async def test_revoked_session_duration_calculated(self):
        """Duration = (revoked_at - created_at) in minutes."""
        login = datetime(2025, 1, 10, 9, 0)
        logout = datetime(2025, 1, 10, 17, 0)  # 8 h = 480 min
        uid = uuid4()
        s = _session_row(uid=uid, revoked_at=logout, created_at=login)
        u = _user_row(uid=uid)

        db = MagicMock()
        db.query.return_value = _chain(rows=[(s, u)])

        result = await get_login_history_report(
            range="30d", user_id=None, include_active=True,
            current_user=_user(), business_id=BIZ_ID, db=db,
        )

        assert result.total_sessions == 1
        assert result.active_sessions == 0
        assert result.items[0].duration_minutes == pytest.approx(480.0, abs=0.1)

    @pytest.mark.asyncio
    async def test_active_session_counted_separately(self):
        """is_active=True increments active_sessions counter."""
        uid = uuid4()
        s = _session_row(uid=uid, is_active=True)
        u = _user_row(uid=uid)

        db = MagicMock()
        db.query.return_value = _chain(rows=[(s, u)])

        result = await get_login_history_report(
            range="7d", user_id=None, include_active=True,
            current_user=_user(), business_id=BIZ_ID, db=db,
        )

        assert result.active_sessions == 1
        assert result.items[0].is_active is True

    @pytest.mark.asyncio
    async def test_more_than_3_ips_triggers_suspicious_flag(self):
        """Account accessed from >3 IPs in period → is_suspicious=True."""
        uid = uuid4()
        u = _user_row(uid=uid)
        # 4 different IPs for the same user
        sessions = [_session_row(uid=uid, ip=f"10.0.0.{i}") for i in range(1, 5)]

        db = MagicMock()
        db.query.return_value = _chain(rows=[(s, u) for s in sessions])

        result = await get_login_history_report(
            range="30d", user_id=None, include_active=True,
            current_user=_user(), business_id=BIZ_ID, db=db,
        )

        assert result.suspicious_count >= 1

    @pytest.mark.asyncio
    async def test_session_over_24h_is_suspicious(self):
        """Session lasting >1440 minutes is flagged suspicious."""
        uid = uuid4()
        login = datetime(2025, 1, 1, 0, 0)
        logout = datetime(2025, 1, 3, 0, 0)  # 48 h = 2880 min
        s = _session_row(uid=uid, revoked_at=logout, created_at=login)
        u = _user_row(uid=uid)

        db = MagicMock()
        db.query.return_value = _chain(rows=[(s, u)])

        result = await get_login_history_report(
            range="30d", user_id=None, include_active=True,
            current_user=_user(), business_id=BIZ_ID, db=db,
        )

        assert result.items[0].is_suspicious is True

    @pytest.mark.asyncio
    async def test_two_sessions_same_user_count_as_one_unique(self):
        """Duplicate sessions from same user do not inflate unique_users."""
        uid = uuid4()
        u = _user_row(uid=uid)
        sessions = [_session_row(uid=uid), _session_row(uid=uid)]

        db = MagicMock()
        db.query.return_value = _chain(rows=[(s, u) for s in sessions])

        result = await get_login_history_report(
            range="30d", user_id=None, include_active=True,
            current_user=_user(), business_id=BIZ_ID, db=db,
        )

        assert result.total_sessions == 2
        assert result.unique_users == 1


# ── Excel Export ──────────────────────────────────────────────────────────────


class TestExcelExport:
    """GET /reports/export/excel"""

    @pytest.mark.asyncio
    @pytest.mark.parametrize("report_type", [
        "products", "categories", "payments", "discounts", "refunds",
    ])
    async def test_each_report_type_returns_xlsx_bytes(self, report_type):
        """Every supported type returns a valid Excel (ZIP-PK) response."""
        with patch("app.api.reports.SalesReportService", return_value=_sales_svc()):
            resp = await export_report_excel(
                report_type=report_type,
                start_date="2025-01-01",
                end_date="2025-01-31",
                current_user=_user(),
                business_id=BIZ_ID,
                db=MagicMock(),
            )

        assert resp.media_type == (
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        assert resp.body[:2] == b"PK", "xlsx must start with ZIP magic bytes"

    @pytest.mark.asyncio
    async def test_unknown_report_type_raises_400(self):
        """Unsupported report_type raises HTTP 400."""
        with pytest.raises(HTTPException) as exc_info:
            await export_report_excel(
                report_type="rainbow",
                start_date="2025-01-01",
                end_date="2025-01-31",
                current_user=_user(),
                business_id=BIZ_ID,
                db=MagicMock(),
            )
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_invalid_date_raises_400(self):
        """Malformed date string raises HTTP 400."""
        with pytest.raises(HTTPException) as exc_info:
            await export_report_excel(
                report_type="products",
                start_date="bad-date",
                end_date="2025-01-31",
                current_user=_user(),
                business_id=BIZ_ID,
                db=MagicMock(),
            )
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_filename_includes_type_and_dates(self):
        """Content-Disposition header encodes report_type and date range."""
        with patch("app.api.reports.SalesReportService", return_value=_sales_svc()):
            resp = await export_report_excel(
                report_type="products",
                start_date="2025-01-01",
                end_date="2025-01-31",
                current_user=_user(),
                business_id=BIZ_ID,
                db=MagicMock(),
            )

        disp = resp.headers["Content-Disposition"]
        assert "products" in disp
        assert "2025-01-01" in disp
        assert "2025-01-31" in disp


# ── RBAC: check_feature dependency ───────────────────────────────────────────


class TestCheckFeatureRBAC:
    """check_feature('has_advanced_reporting') gate behaviour."""

    @pytest.mark.asyncio
    async def test_superadmin_skips_permission_check(self):
        """SuperAdmin bypasses feature check entirely (Requirement 20.4)."""
        from app.api.deps import check_feature
        svc = MagicMock()
        inner = check_feature("has_advanced_reporting")

        result = await inner(
            current_user=_user(is_superadmin=True),
            business_id=BIZ_ID,
            permission_service=svc,
        )

        assert result.is_superadmin is True
        svc.check_feature.assert_not_called()

    @pytest.mark.asyncio
    async def test_missing_feature_raises_403(self):
        """Regular user without the feature receives HTTP 403."""
        from app.api.deps import check_feature
        svc = AsyncMock()
        svc.check_feature.return_value = False

        inner = check_feature("has_advanced_reporting")
        with pytest.raises(HTTPException) as exc_info:
            await inner(
                current_user=_user(is_superadmin=False),
                business_id=BIZ_ID,
                permission_service=svc,
            )

        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_user_with_feature_is_returned(self):
        """Regular user who has the feature passes through unchanged."""
        from app.api.deps import check_feature
        user = _user(is_superadmin=False)
        svc = AsyncMock()
        svc.check_feature.return_value = True

        inner = check_feature("has_advanced_reporting")
        result = await inner(
            current_user=user,
            business_id=BIZ_ID,
            permission_service=svc,
        )

        assert result == user
