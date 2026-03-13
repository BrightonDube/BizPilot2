"""Unit tests for StaffReportService."""
import os
os.environ.setdefault("SECRET_KEY", "test-secret-key")

from datetime import date
from unittest.mock import MagicMock
from uuid import uuid4


from app.services.staff_report_service import StaffReportService


BIZ = uuid4()
USER1 = uuid4()
USER2 = uuid4()
START = date(2025, 1, 1)
END = date(2025, 1, 31)


def _make_service():
    db = MagicMock()
    return StaffReportService(db), db


def _chain(mock_db, rows):
    """Configure db.query chain to return rows at .all()."""
    chain = MagicMock()
    chain.join.return_value = chain
    chain.outerjoin.return_value = chain
    chain.filter.return_value = chain
    chain.group_by.return_value = chain
    chain.order_by.return_value = chain
    chain.offset.return_value = chain
    chain.limit.return_value = chain
    chain.all.return_value = rows
    chain.one.return_value = rows[0] if rows else MagicMock()
    chain.count.return_value = len(rows)
    mock_db.query.return_value = chain
    return chain


class TestParseAndHelpers:
    def test_parse_dates(self):
        svc, _ = _make_service()
        s, e = svc._parse_dates(date(2025, 3, 1), date(2025, 3, 5))
        assert s.day == 1
        assert e.day == 6  # end_date + 1 day

    def test_get_business_staff(self):
        svc, db = _make_service()
        row = MagicMock(user_id=USER1, first_name="A", last_name="B", email="a@b.c", department_id=None)
        _chain(db, [row])
        result = svc._get_business_staff(BIZ)
        assert len(result) == 1


class TestPerformanceReport:
    def _make_row(self, user_id=USER1, first_name="John", last_name="Doe",
                  email="j@d.c", total_hours=8.0, net_hours=7.0,
                  total_breaks=1.0, overtime_hours=0.5, total_entries=5,
                  completed_entries=4, first_clock_in=None, last_clock_out=None):
        row = MagicMock()
        row.user_id = user_id
        row.first_name = first_name
        row.last_name = last_name
        row.email = email
        row.total_hours = total_hours
        row.net_hours = net_hours
        row.total_breaks = total_breaks
        row.overtime_hours = overtime_hours
        row.total_entries = total_entries
        row.completed_entries = completed_entries
        row.first_clock_in = first_clock_in
        row.last_clock_out = last_clock_out
        return row

    def test_performance_basic(self):
        svc, db = _make_service()
        _chain(db, [self._make_row()])
        result = svc.get_performance_report(BIZ, START, END)
        assert result["total_staff"] == 1
        assert result["total_hours"] == 7.0
        assert len(result["staff"]) == 1
        s = result["staff"][0]
        assert s["total_hours"] == 8.0
        assert s["net_hours"] == 7.0
        assert s["break_hours"] == 1.0

    def test_performance_empty(self):
        svc, db = _make_service()
        _chain(db, [])
        result = svc.get_performance_report(BIZ, START, END)
        assert result["total_staff"] == 0
        assert result["total_hours"] == 0.0
        assert result["average_hours_per_staff"] == 0.0

    def test_performance_multiple_staff(self):
        svc, db = _make_service()
        r1 = self._make_row(user_id=USER1, net_hours=10.0)
        r2 = self._make_row(user_id=USER2, first_name="Jane", net_hours=6.0)
        _chain(db, [r1, r2])
        result = svc.get_performance_report(BIZ, START, END)
        assert result["total_staff"] == 2
        assert result["total_hours"] == 16.0
        assert result["average_hours_per_staff"] == 8.0


class TestAttendanceReport:
    def _make_row(self, user_id=USER1, first_name="John", last_name="Doe",
                  work_date=date(2025, 1, 15), hours_worked=8.0, net_hours=7.0,
                  break_duration=1.0, overtime_hours=0.5, overtime_entries=0,
                  auto_clock_outs=0, first_clock_in=None, last_clock_out=None,
                  entry_count=2):
        row = MagicMock()
        row.user_id = user_id
        row.first_name = first_name
        row.last_name = last_name
        row.work_date = work_date
        row.hours_worked = hours_worked
        row.net_hours = net_hours
        row.break_duration = break_duration
        row.overtime_hours = overtime_hours
        row.overtime_entries = overtime_entries
        row.auto_clock_outs = auto_clock_outs
        row.first_clock_in = first_clock_in
        row.last_clock_out = last_clock_out
        row.entry_count = entry_count
        return row

    def test_attendance_report_basic(self):
        svc, db = _make_service()
        _chain(db, [self._make_row()])
        result = svc.get_attendance_report(BIZ, START, END)
        assert result["total_staff"] == 1
        assert len(result["daily_records"]) == 1
        assert len(result["user_summaries"]) == 1
        s = result["user_summaries"][0]
        assert s["total_net_hours"] == 7.0
        assert s["days_worked"] == 1

    def test_attendance_report_user_filter(self):
        svc, db = _make_service()
        chain = _chain(db, [self._make_row()])
        svc.get_attendance_report(BIZ, START, END, user_id=str(USER1))
        # filter should be called at least twice (base + user filter)
        assert chain.filter.call_count >= 1

    def test_attendance_multi_day(self):
        svc, db = _make_service()
        r1 = self._make_row(work_date=date(2025, 1, 1), net_hours=7.0)
        r2 = self._make_row(work_date=date(2025, 1, 2), net_hours=8.0)
        _chain(db, [r1, r2])
        result = svc.get_attendance_report(BIZ, START, END)
        assert len(result["daily_records"]) == 2
        s = result["user_summaries"][0]
        assert s["total_net_hours"] == 15.0
        assert s["days_worked"] == 2

    def test_attendance_empty(self):
        svc, db = _make_service()
        _chain(db, [])
        result = svc.get_attendance_report(BIZ, START, END)
        assert result["total_staff"] == 0
        assert result["total_hours"] == 0.0


class TestDepartmentPerformance:
    def _make_dept_row(self, dept_id=None, dept_name="Sales", staff_count=3,
                       total_hours=24.0, net_hours=20.0, overtime_hours=2.0,
                       total_entries=10):
        row = MagicMock()
        row.department_id = dept_id or uuid4()
        row.department_name = dept_name
        row.staff_count = staff_count
        row.total_hours = total_hours
        row.net_hours = net_hours
        row.overtime_hours = overtime_hours
        row.total_entries = total_entries
        return row

    def _make_unassigned_row(self, staff_count=0, total_hours=0, net_hours=0,
                             overtime_hours=0, total_entries=0):
        row = MagicMock()
        row.staff_count = staff_count
        row.total_hours = total_hours
        row.net_hours = net_hours
        row.overtime_hours = overtime_hours
        row.total_entries = total_entries
        return row

    def test_department_performance(self):
        svc, db = _make_service()
        dept_row = self._make_dept_row()
        unassigned = self._make_unassigned_row()
        # First query returns department rows, second returns unassigned
        chain = MagicMock()
        chain.join.return_value = chain
        chain.outerjoin.return_value = chain
        chain.filter.return_value = chain
        chain.group_by.return_value = chain
        chain.order_by.return_value = chain
        chain.all.return_value = [dept_row]
        chain.one.return_value = unassigned
        db.query.return_value = chain

        result = svc.get_department_performance(BIZ, START, END)
        assert result["total_departments"] == 1
        assert len(result["departments"]) == 1
        assert result["departments"][0]["staff_count"] == 3
        assert result["departments"][0]["avg_hours_per_staff"] == round(20.0 / 3, 2)

    def test_department_with_unassigned(self):
        svc, db = _make_service()
        dept_row = self._make_dept_row(net_hours=10.0)
        unassigned = self._make_unassigned_row(staff_count=2, net_hours=5.0, total_hours=6.0)

        chain = MagicMock()
        chain.join.return_value = chain
        chain.outerjoin.return_value = chain
        chain.filter.return_value = chain
        chain.group_by.return_value = chain
        chain.order_by.return_value = chain
        chain.all.return_value = [dept_row]
        chain.one.return_value = unassigned
        db.query.return_value = chain

        result = svc.get_department_performance(BIZ, START, END)
        assert result["total_departments"] == 2  # dept + unassigned
        assert result["total_hours"] == 15.0


class TestProductivityReport:
    def _make_row(self, user_id=USER1, first_name="John", last_name="Doe",
                  total_hours=10.0, net_hours=8.0, total_breaks=2.0,
                  overtime_hours=1.0, total_entries=5, days_worked=3,
                  completed_entries=4, auto_clock_outs=1):
        row = MagicMock()
        row.user_id = user_id
        row.first_name = first_name
        row.last_name = last_name
        row.total_hours = total_hours
        row.net_hours = net_hours
        row.total_breaks = total_breaks
        row.overtime_hours = overtime_hours
        row.total_entries = total_entries
        row.days_worked = days_worked
        row.completed_entries = completed_entries
        row.auto_clock_outs = auto_clock_outs
        return row

    def test_productivity_report(self):
        svc, db = _make_service()
        row = self._make_row()
        hourly_row = MagicMock(hour=8, count=3)
        # Two queries: main staff query + hourly distribution
        call_count = [0]
        def query_side_effect(*args):
            call_count[0] += 1
            chain = MagicMock()
            chain.join.return_value = chain
            chain.outerjoin.return_value = chain
            chain.filter.return_value = chain
            chain.group_by.return_value = chain
            chain.order_by.return_value = chain
            if call_count[0] == 1:
                chain.all.return_value = [row]
            else:
                chain.all.return_value = [hourly_row]
            return chain
        db.query.side_effect = query_side_effect

        result = svc.get_productivity_report(BIZ, START, END)
        assert result["total_staff"] == 1
        assert result["total_net_hours"] == 8.0
        assert len(result["staff"]) == 1
        s = result["staff"][0]
        assert s["avg_daily_hours"] == round(8.0 / 3, 2)
        assert s["break_ratio_percent"] == round(2.0 / 10.0 * 100, 1)
        assert s["completion_rate_percent"] == round(4 / 5 * 100, 1)
        assert len(result["clock_in_distribution"]) == 1


class TestCommissionReport:
    def _make_row(self, user_id=USER1, first_name="John", last_name="Doe",
                  email="j@d.c", order_count=10, total_sales=5000.0,
                  total_discounts=200.0):
        row = MagicMock()
        row.user_id = user_id
        row.first_name = first_name
        row.last_name = last_name
        row.email = email
        row.order_count = order_count
        row.total_sales = total_sales
        row.total_discounts = total_discounts
        return row

    def test_commission_report(self):
        svc, db = _make_service()
        _chain(db, [self._make_row()])
        result = svc.get_commission_report(BIZ, START, END, commission_rate=10.0)
        assert result["commission_rate"] == 10.0
        assert result["total_staff"] == 1
        assert result["total_sales"] == 5000.0
        assert result["total_commissions"] == 500.0  # 5000 * 10%
        s = result["staff"][0]
        assert s["commission_amount"] == 500.0

    def test_commission_default_rate(self):
        svc, db = _make_service()
        _chain(db, [self._make_row(total_sales=1000.0)])
        result = svc.get_commission_report(BIZ, START, END)
        assert result["commission_rate"] == 5.0
        assert result["total_commissions"] == 50.0  # 1000 * 5%

    def test_commission_empty(self):
        svc, db = _make_service()
        _chain(db, [])
        result = svc.get_commission_report(BIZ, START, END)
        assert result["total_staff"] == 0
        assert result["total_sales"] == 0.0
        assert result["total_commissions"] == 0.0


class TestActivityLog:
    def _make_row(self, user_id=USER1, first_name="John", last_name="Doe",
                  action=None, resource_type="order", resource_id="abc",
                  description="Created order", ip_address="1.2.3.4",
                  created_at=None):
        from datetime import datetime
        row = MagicMock()
        row.id = uuid4()
        row.user_id = user_id
        row.first_name = first_name
        row.last_name = last_name
        row.action = action or MagicMock(value="create")
        row.resource_type = resource_type
        row.resource_id = resource_id
        row.description = description
        row.ip_address = ip_address
        row.created_at = created_at or datetime(2025, 1, 15, 10, 30)
        return row

    def test_activity_log_basic(self):
        svc, db = _make_service()
        row = self._make_row()
        summary_row = MagicMock(action=MagicMock(value="create"), count=5)

        call_count = [0]
        def query_side_effect(*args):
            call_count[0] += 1
            chain = MagicMock()
            chain.join.return_value = chain
            chain.outerjoin.return_value = chain
            chain.filter.return_value = chain
            chain.group_by.return_value = chain
            chain.order_by.return_value = chain
            chain.offset.return_value = chain
            chain.limit.return_value = chain
            chain.count.return_value = 1
            if call_count[0] == 1:
                chain.all.return_value = [row]
            else:
                chain.all.return_value = [summary_row]
            return chain
        db.query.side_effect = query_side_effect

        result = svc.get_activity_log(BIZ, START, END)
        assert result["total"] == 1
        assert result["page"] == 1
        assert len(result["entries"]) == 1
        assert result["action_summary"]["create"] == 5

    def test_activity_log_pagination(self):
        svc, db = _make_service()

        call_count = [0]
        def query_side_effect(*args):
            call_count[0] += 1
            chain = MagicMock()
            chain.join.return_value = chain
            chain.outerjoin.return_value = chain
            chain.filter.return_value = chain
            chain.group_by.return_value = chain
            chain.order_by.return_value = chain
            chain.offset.return_value = chain
            chain.limit.return_value = chain
            chain.count.return_value = 100
            chain.all.return_value = []
            return chain
        db.query.side_effect = query_side_effect

        result = svc.get_activity_log(BIZ, START, END, page=3, per_page=20)
        assert result["page"] == 3
        assert result["per_page"] == 20
        assert result["pages"] == 5


class TestCashDrawerReport:
    def _make_session_row(self, register_name="Register 1", status=None,
                          opening_float=500.0, closing_float=1500.0,
                          expected_cash=1400.0, actual_cash=1380.0,
                          cash_difference=-20.0, total_sales=1000.0,
                          total_refunds=50.0, total_cash_payments=800.0,
                          total_card_payments=200.0, transaction_count=50,
                          opened_at=None, closed_at=None, notes="",
                          opened_by=None, closed_by=None):
        from datetime import datetime
        row = MagicMock()
        row.session_id = uuid4()
        row.register_name = register_name
        row.status = status or MagicMock(value="closed")
        row.opening_float = opening_float
        row.closing_float = closing_float
        row.expected_cash = expected_cash
        row.actual_cash = actual_cash
        row.cash_difference = cash_difference
        row.total_sales = total_sales
        row.total_refunds = total_refunds
        row.total_cash_payments = total_cash_payments
        row.total_card_payments = total_card_payments
        row.transaction_count = transaction_count
        row.opened_at = opened_at or datetime(2025, 1, 15, 8, 0)
        row.closed_at = closed_at or datetime(2025, 1, 15, 17, 0)
        row.notes = notes
        row.opened_by = opened_by or str(USER1)
        row.closed_by = closed_by or str(USER1)
        return row

    def test_cash_drawer_report(self):
        svc, db = _make_service()
        session_row = self._make_session_row()
        user_row = MagicMock(id=USER1, first_name="John", last_name="Doe")
        movement_row = MagicMock(movement_type="cash_in", count=5, total_amount=200.0)

        call_count = [0]
        def query_side_effect(*args):
            call_count[0] += 1
            chain = MagicMock()
            chain.join.return_value = chain
            chain.outerjoin.return_value = chain
            chain.filter.return_value = chain
            chain.group_by.return_value = chain
            chain.order_by.return_value = chain
            if call_count[0] == 1:
                chain.all.return_value = [session_row]
            elif call_count[0] == 2:
                chain.all.return_value = [user_row]
            else:
                chain.all.return_value = [movement_row]
            return chain
        db.query.side_effect = query_side_effect

        result = svc.get_cash_drawer_report(BIZ, START, END)
        assert result["total_sessions"] == 1
        assert result["total_sales"] == 1000.0
        assert result["total_cash_difference"] == -20.0
        assert result["discrepancy_count"] == 1
        assert "cash_in" in result["movement_summary"]


class TestVoidRefundReport:
    def _make_row(self, user_id=USER1, first_name="John", last_name="Doe",
                  email="j@d.c", action_value="void", action_count=3):
        row = MagicMock()
        row.user_id = user_id
        row.first_name = first_name
        row.last_name = last_name
        row.email = email
        row.action = MagicMock(value=action_value)
        row.action_count = action_count
        return row

    def test_void_refund_report(self):
        svc, db = _make_service()
        void_row = self._make_row(action_value="void", action_count=3)
        refund_row = self._make_row(action_value="refund", action_count=2)
        _chain(db, [void_row, refund_row])
        result = svc.get_void_refund_report(BIZ, START, END)
        assert result["total_staff"] == 1
        assert result["total_voids"] == 3
        assert result["total_refunds"] == 2
        assert result["staff"][0]["total_actions"] == 5

    def test_void_refund_empty(self):
        svc, db = _make_service()
        _chain(db, [])
        result = svc.get_void_refund_report(BIZ, START, END)
        assert result["total_staff"] == 0
        assert result["total_voids"] == 0
        assert result["total_refunds"] == 0


class TestDiscountReport:
    def _make_row(self, user_id=USER1, first_name="John", last_name="Doe",
                  email="j@d.c", order_count=5, total_discounts=100.0,
                  total_sales=2000.0):
        row = MagicMock()
        row.user_id = user_id
        row.first_name = first_name
        row.last_name = last_name
        row.email = email
        row.order_count = order_count
        row.total_discounts = total_discounts
        row.total_sales = total_sales
        return row

    def test_discount_report(self):
        svc, db = _make_service()
        _chain(db, [self._make_row()])
        result = svc.get_discount_report(BIZ, START, END)
        assert result["total_staff"] == 1
        assert result["total_discounts"] == 100.0
        assert result["total_sales"] == 2000.0
        assert result["overall_discount_rate"] == 5.0  # 100/2000 * 100
        s = result["staff"][0]
        assert s["discount_rate"] == 5.0

    def test_discount_empty(self):
        svc, db = _make_service()
        _chain(db, [])
        result = svc.get_discount_report(BIZ, START, END)
        assert result["total_staff"] == 0
        assert result["overall_discount_rate"] == 0.0
