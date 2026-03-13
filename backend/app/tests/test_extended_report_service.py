"""Unit tests for ExtendedReportService.

Tests cover:
- User activity aggregation with date/user filters
- Login history with suspicious activity detection
- IP address masking (POPIA compliance)
- Pagination
"""

import os
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock

os.environ.setdefault("SECRET_KEY", "test-secret-key")


from app.services.extended_report_service import ExtendedReportService


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

BIZ = uuid.uuid4()
USER1 = uuid.uuid4()
USER2 = uuid.uuid4()


def _make_service():
    db = MagicMock()
    return ExtendedReportService(db), db


def _mock_session(**kwargs):
    """Return a mock Session row."""
    s = MagicMock()
    s.id = kwargs.get("id", uuid.uuid4())
    s.user_id = kwargs.get("user_id", USER1)
    s.ip_address = kwargs.get("ip_address", "192.168.1.100")
    s.device_name = kwargs.get("device_name", "Chrome")
    s.device_type = kwargs.get("device_type", "browser")
    s.location = kwargs.get("location", None)
    s.is_active = kwargs.get("is_active", False)
    s.created_at = kwargs.get("created_at", datetime(2025, 1, 10, 8, 0, tzinfo=timezone.utc))
    s.last_active_at = kwargs.get(
        "last_active_at", datetime(2025, 1, 10, 16, 0, tzinfo=timezone.utc)
    )
    s.deleted_at = None
    return s


# ══════════════════════════════════════════════════════════════════════════════
# IP masking
# ══════════════════════════════════════════════════════════════════════════════

class TestIPMasking:
    """Verify POPIA-compliant IP masking."""

    def test_ipv4_masks_last_octet(self):
        assert ExtendedReportService._mask_ip("192.168.1.100") == "192.168.1.***"

    def test_ipv6_masks_last_segment(self):
        result = ExtendedReportService._mask_ip("2001:0db8:85a3:0000:0000:8a2e:0370:7334")
        assert result.endswith("****")

    def test_empty_ip_passthrough(self):
        assert ExtendedReportService._mask_ip("") == ""

    def test_none_ip_passthrough(self):
        assert ExtendedReportService._mask_ip(None) is None


# ══════════════════════════════════════════════════════════════════════════════
# User Activity
# ══════════════════════════════════════════════════════════════════════════════

class TestUserActivity:
    """Test user activity aggregation."""

    def test_returns_items_and_total(self):
        """get_user_activity returns (items, total) tuple."""
        svc, db = _make_service()
        # Build mock query chain
        q = db.query.return_value.filter.return_value
        grouped = q.group_by.return_value
        grouped.count.return_value = 2

        row1 = MagicMock()
        row1.user_id = USER1
        row1.entry_count = 15
        row1.last_active = datetime(2025, 1, 15, 10, 0, tzinfo=timezone.utc)

        row2 = MagicMock()
        row2.user_id = USER2
        row2.entry_count = 8
        row2.last_active = None

        grouped.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [
            row1, row2
        ]

        items, total = svc.get_user_activity(BIZ)
        assert total == 2
        assert len(items) == 2
        assert items[0]["user_id"] == str(USER1)
        assert items[0]["entry_count"] == 15
        assert items[1]["last_active"] is None

    def test_empty_result(self):
        """Returns empty list for no data."""
        svc, db = _make_service()
        q = db.query.return_value.filter.return_value
        grouped = q.group_by.return_value
        grouped.count.return_value = 0
        grouped.order_by.return_value.offset.return_value.limit.return_value.all.return_value = []

        items, total = svc.get_user_activity(BIZ)
        assert total == 0
        assert items == []


# ══════════════════════════════════════════════════════════════════════════════
# Login History
# ══════════════════════════════════════════════════════════════════════════════

class TestLoginHistory:
    """Test login history with suspicious detection."""

    def test_normal_session_not_flagged(self):
        """8-hour session should not be flagged suspicious."""
        svc, db = _make_service()
        s = _mock_session(
            created_at=datetime(2025, 1, 10, 8, 0, tzinfo=timezone.utc),
            last_active_at=datetime(2025, 1, 10, 16, 0, tzinfo=timezone.utc),
        )
        q = db.query.return_value
        q.count.return_value = 1
        q.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [s]

        items, total = svc.get_login_history()
        assert len(items) == 1
        assert items[0]["is_suspicious"] is False
        assert items[0]["duration_hours"] == 8.0

    def test_long_session_flagged_suspicious(self):
        """Session > 24h should be flagged suspicious."""
        svc, db = _make_service()
        s = _mock_session(
            created_at=datetime(2025, 1, 10, 8, 0, tzinfo=timezone.utc),
            last_active_at=datetime(2025, 1, 12, 10, 0, tzinfo=timezone.utc),
        )
        q = db.query.return_value
        q.count.return_value = 1
        q.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [s]

        items, _ = svc.get_login_history()
        assert items[0]["is_suspicious"] is True

    def test_suspicious_only_filter(self):
        """suspicious_only=True filters out normal sessions."""
        svc, db = _make_service()
        normal = _mock_session(
            created_at=datetime(2025, 1, 10, 8, 0, tzinfo=timezone.utc),
            last_active_at=datetime(2025, 1, 10, 12, 0, tzinfo=timezone.utc),
        )
        suspicious = _mock_session(
            created_at=datetime(2025, 1, 10, 8, 0, tzinfo=timezone.utc),
            last_active_at=datetime(2025, 1, 12, 20, 0, tzinfo=timezone.utc),
        )
        q = db.query.return_value
        q.count.return_value = 2
        q.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [
            normal, suspicious
        ]

        items, total = svc.get_login_history(suspicious_only=True)
        assert total == 1  # in-memory re-count
        assert all(i["is_suspicious"] for i in items)

    def test_ip_address_masked(self):
        """IP addresses in output should be masked."""
        svc, db = _make_service()
        s = _mock_session(ip_address="10.0.0.42")
        q = db.query.return_value
        q.count.return_value = 1
        q.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [s]

        items, _ = svc.get_login_history()
        assert items[0]["ip_address"] == "10.0.0.***"

    def test_null_last_active_no_crash(self):
        """Session with no last_active_at should not crash."""
        svc, db = _make_service()
        s = _mock_session(last_active_at=None)
        q = db.query.return_value
        q.count.return_value = 1
        q.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [s]

        items, _ = svc.get_login_history()
        assert items[0]["duration_hours"] is None
        assert items[0]["is_suspicious"] is False
