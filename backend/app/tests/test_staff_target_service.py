"""Unit tests for StaffTargetService."""
import os
os.environ.setdefault("SECRET_KEY", "test-secret-key")

from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock
from uuid import uuid4


from app.services.staff_target_service import StaffTargetService


BIZ = str(uuid4())
USR = str(uuid4())
TGT_ID = str(uuid4())
RULE_ID = str(uuid4())
START = date(2025, 1, 1)
END = date(2025, 1, 31)


def _svc():
    db = MagicMock()
    return StaffTargetService(db), db


def _chain(db, rows=None, first=None, count=0, scalar=None, one=None):
    chain = MagicMock()
    chain.filter.return_value = chain
    chain.order_by.return_value = chain
    chain.offset.return_value = chain
    chain.limit.return_value = chain
    chain.group_by.return_value = chain
    chain.all.return_value = rows or []
    chain.first.return_value = first
    chain.count.return_value = count
    chain.scalar.return_value = scalar
    chain.one.return_value = one or MagicMock(count=0, sales=0, commission=0)
    db.query.return_value = chain
    return chain


class TestTargetCRUD:
    def test_create_target(self):
        svc, db = _svc()
        svc.create_target(BIZ, "sales", "monthly", START, END, Decimal("10000"))
        db.add.assert_called_once()
        db.commit.assert_called()

    def test_list_targets(self):
        svc, db = _svc()
        _chain(db, rows=[MagicMock()], count=3)
        items, total = svc.list_targets(BIZ)
        assert total == 3

    def test_list_targets_with_filters(self):
        svc, db = _svc()
        chain = _chain(db, rows=[], count=0)
        svc.list_targets(BIZ, user_id=USR, status="active")
        assert chain.filter.call_count >= 1

    def test_get_target(self):
        svc, db = _svc()
        target = MagicMock()
        _chain(db, first=target)
        assert svc.get_target(TGT_ID, BIZ) == target

    def test_get_target_not_found(self):
        svc, db = _svc()
        _chain(db, first=None)
        assert svc.get_target(TGT_ID, BIZ) is None

    def test_update_target(self):
        svc, db = _svc()
        target = MagicMock()
        _chain(db, first=target)
        result = svc.update_target(TGT_ID, BIZ, target_value=Decimal("20000"))
        db.commit.assert_called()
        assert result == target

    def test_update_target_not_found(self):
        svc, db = _svc()
        _chain(db, first=None)
        assert svc.update_target(TGT_ID, BIZ, target_value=Decimal("20000")) is None

    def test_delete_target(self):
        svc, db = _svc()
        target = MagicMock()
        _chain(db, first=target)
        assert svc.delete_target(TGT_ID, BIZ) is True
        db.commit.assert_called()

    def test_delete_target_not_found(self):
        svc, db = _svc()
        _chain(db, first=None)
        assert svc.delete_target(TGT_ID, BIZ) is False


class TestProgress:
    def test_get_progress(self):
        svc, db = _svc()
        target = MagicMock()
        target.id = uuid4()
        target.target_type = "sales"
        target.target_value = Decimal("10000")
        target.achieved_value = Decimal("7500")
        target.status = "active"
        target.period_start = START
        target.period_end = END
        _chain(db, first=target)
        result = svc.get_progress(TGT_ID, BIZ)
        assert result["achievement_pct"] == 75.0
        assert result["remaining"] == 2500.0

    def test_get_progress_not_found(self):
        svc, db = _svc()
        _chain(db, first=None)
        assert svc.get_progress(TGT_ID, BIZ) == {}


class TestTemplates:
    def test_create_template(self):
        svc, db = _svc()
        svc.create_template(BIZ, "Monthly Sales", "sales", "monthly", Decimal("10000"))
        db.add.assert_called_once()

    def test_list_templates(self):
        svc, db = _svc()
        _chain(db, rows=[MagicMock(), MagicMock()])
        result = svc.list_templates(BIZ)
        assert len(result) == 2


class TestCommissionRules:
    def test_create_percentage_rule(self):
        svc, db = _svc()
        svc.create_commission_rule(BIZ, "Sales Commission", "percentage", Decimal("5"))
        db.add.assert_called()
        db.commit.assert_called()

    def test_create_tiered_rule(self):
        svc, db = _svc()
        tiers = [
            {"min_value": 0, "max_value": 5000, "rate": 3},
            {"min_value": 5000, "max_value": None, "rate": 5},
        ]
        svc.create_commission_rule(BIZ, "Tiered", "tiered", Decimal("0"), tiers=tiers)
        assert db.add.call_count >= 3  # rule + 2 tiers

    def test_list_rules(self):
        svc, db = _svc()
        _chain(db, rows=[MagicMock()])
        result = svc.list_commission_rules(BIZ)
        assert len(result) == 1

    def test_update_rule(self):
        svc, db = _svc()
        rule = MagicMock()
        _chain(db, first=rule)
        result = svc.update_commission_rule(RULE_ID, BIZ, rate=Decimal("7"))
        assert result == rule

    def test_update_rule_not_found(self):
        svc, db = _svc()
        _chain(db, first=None)
        assert svc.update_commission_rule(RULE_ID, BIZ, rate=Decimal("7")) is None


class TestCalculateCommission:
    def test_percentage(self):
        svc, db = _svc()
        rule = MagicMock()
        rule.rule_type = "percentage"
        rule.rate = Decimal("10")
        rule.min_threshold = None
        rule.max_threshold = None
        rule.cap_amount = None
        _chain(db, rows=[rule])
        result = svc.calculate_commission(BIZ, USR, Decimal("5000"))
        assert result == Decimal("500.00")

    def test_flat_rate(self):
        svc, db = _svc()
        rule = MagicMock()
        rule.rule_type = "flat"
        rule.rate = Decimal("100")
        rule.min_threshold = None
        rule.max_threshold = None
        rule.cap_amount = None
        _chain(db, rows=[rule])
        result = svc.calculate_commission(BIZ, USR, Decimal("5000"))
        assert result == Decimal("100.00")

    def test_below_min_threshold(self):
        svc, db = _svc()
        rule = MagicMock()
        rule.rule_type = "percentage"
        rule.rate = Decimal("10")
        rule.min_threshold = Decimal("10000")
        rule.max_threshold = None
        rule.cap_amount = None
        _chain(db, rows=[rule])
        result = svc.calculate_commission(BIZ, USR, Decimal("5000"))
        assert result == Decimal("0.00")

    def test_capped(self):
        svc, db = _svc()
        rule = MagicMock()
        rule.rule_type = "percentage"
        rule.rate = Decimal("50")
        rule.min_threshold = None
        rule.max_threshold = None
        rule.cap_amount = Decimal("200")
        _chain(db, rows=[rule])
        result = svc.calculate_commission(BIZ, USR, Decimal("5000"))
        assert result == Decimal("200.00")

    def test_no_rules(self):
        svc, db = _svc()
        _chain(db, rows=[])
        result = svc.calculate_commission(BIZ, USR, Decimal("5000"))
        assert result == Decimal("0.00")

    def test_tiered(self):
        svc, db = _svc()
        tier1 = MagicMock()
        tier1.tier_order = 1
        tier1.min_value = Decimal("0")
        tier1.max_value = Decimal("5000")
        tier1.rate = Decimal("5")
        tier2 = MagicMock()
        tier2.tier_order = 2
        tier2.min_value = Decimal("5000")
        tier2.max_value = None
        tier2.rate = Decimal("10")
        rule = MagicMock()
        rule.rule_type = "tiered"
        rule.rate = Decimal("0")
        rule.min_threshold = None
        rule.max_threshold = None
        rule.cap_amount = None
        rule.tiers = [tier1, tier2]
        _chain(db, rows=[rule])
        # 5000 * 5% + 3000 * 10% = 250 + 300 = 550
        result = svc.calculate_commission(BIZ, USR, Decimal("8000"))
        assert result == Decimal("550.00")


class TestStaffCommissions:
    def test_list(self):
        svc, db = _svc()
        _chain(db, rows=[MagicMock()], count=1)
        items, total = svc.list_staff_commissions(BIZ)
        assert total == 1

    def test_commission_report(self):
        svc, db = _svc()
        row = MagicMock()
        row.count = 10
        row.sales = 50000
        row.commission = 2500
        _chain(db, one=row)
        result = svc.get_commission_report(BIZ, START, END)
        assert result["total_commissions"] == 10
        assert result["total_sales"] == 50000
        assert result["total_commission_amount"] == 2500


class TestIncentives:
    def test_create(self):
        svc, db = _svc()
        svc.create_incentive(BIZ, "Q1 Bonus", "bonus", "sales_amount",
                             Decimal("50000"), "cash", Decimal("1000"), START, END)
        db.add.assert_called_once()

    def test_list(self):
        svc, db = _svc()
        _chain(db, rows=[MagicMock()])
        result = svc.list_incentives(BIZ)
        assert len(result) == 1

    def test_check_eligibility_not_found(self):
        svc, db = _svc()
        _chain(db, first=None)
        result = svc.check_eligibility("x", USR, BIZ)
        assert result["eligible"] is False
        assert "not found" in result["reason"]

    def test_check_eligibility_already_achieved(self):
        svc, db = _svc()
        program = MagicMock()
        existing = MagicMock()
        existing.achieved_at = "2025-01-15"
        call_count = [0]
        def query_side_effect(*args):
            call_count[0] += 1
            chain = MagicMock()
            chain.filter.return_value = chain
            if call_count[0] == 1:
                chain.first.return_value = program
            else:
                chain.first.return_value = existing
            return chain
        db.query.side_effect = query_side_effect
        result = svc.check_eligibility("x", USR, BIZ)
        assert result["eligible"] is False
        assert "Already achieved" in result["reason"]


class TestLeaderboard:
    def test_get_leaderboard(self):
        svc, db = _svc()
        row = MagicMock()
        row.user_id = uuid4()
        row.value = 10000.0
        _chain(db, rows=[row])
        result = svc.get_leaderboard(BIZ)
        assert len(result) == 1
        assert result[0]["rank"] == 1


class TestPerformance:
    def test_summary(self):
        svc, db = _svc()
        row = MagicMock()
        row.sales = 25000
        row.txns = 100
        row.items = 300
        row.customers = 50
        row.avg_txn = 250.0
        row.hours = 160
        row.days = 20
        _chain(db, one=row)
        result = svc.get_performance_summary(BIZ, USR, START, END)
        assert result["total_sales"] == 25000
        assert result["days_worked"] == 20

    def test_trends(self):
        svc, db = _svc()
        snap = MagicMock()
        snap.snapshot_date = START
        snap.total_sales = Decimal("1000")
        snap.transaction_count = 10
        snap.item_count = 30
        snap.customer_count = 5
        snap.avg_transaction = Decimal("100")
        _chain(db, rows=[snap])
        result = svc.get_performance_trends(BIZ, USR, START, END)
        assert len(result) == 1
        assert result[0]["total_sales"] == 1000.0
