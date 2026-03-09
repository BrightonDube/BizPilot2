"""Unit tests for LaybyService."""
import os
os.environ.setdefault("SECRET_KEY", "test-secret-key")

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch, PropertyMock
from uuid import uuid4

import pytest

from app.models.layby import LaybyStatus, PaymentFrequency
from app.models.layby_payment import PaymentType, PaymentStatus
from app.models.layby_schedule import ScheduleStatus
from app.services.layby_service import LaybyService


BIZ = uuid4()
CUST = uuid4()
USER = uuid4()
LAYBY_ID = uuid4()
PAY_ID = uuid4()


def _make_service():
    db = MagicMock()
    svc = LaybyService(db)
    svc.stock_service = MagicMock()
    return svc, db


def _chain(mock_db, rows=None, first=None, scalar=None, count=0):
    """Configure db.query chain."""
    chain = MagicMock()
    chain.join.return_value = chain
    chain.outerjoin.return_value = chain
    chain.filter.return_value = chain
    chain.group_by.return_value = chain
    chain.order_by.return_value = chain
    chain.offset.return_value = chain
    chain.limit.return_value = chain
    chain.all.return_value = rows or []
    chain.first.return_value = first
    chain.scalar.return_value = scalar
    chain.count.return_value = count
    chain.update.return_value = 0
    chain.delete.return_value = 0
    mock_db.query.return_value = chain
    return chain


def _make_layby(status=LaybyStatus.ACTIVE, total=Decimal("1000.00"),
                deposit=Decimal("200.00"), amount_paid=Decimal("200.00"),
                balance_due=Decimal("800.00"), can_make_payment=True,
                can_be_cancelled=True, can_be_collected=False,
                can_be_extended=True, end_date=None, location_id=None,
                payment_frequency=PaymentFrequency.MONTHLY,
                extension_count=0, item_count=2):
    layby = MagicMock()
    layby.id = LAYBY_ID
    layby.business_id = str(BIZ)
    layby.customer_id = str(CUST)
    layby.status = status
    layby.total_amount = total
    layby.deposit_amount = deposit
    layby.amount_paid = amount_paid
    layby.balance_due = balance_due
    layby.can_make_payment = can_make_payment
    layby.can_be_cancelled = can_be_cancelled
    layby.can_be_collected = can_be_collected
    layby.can_be_extended = can_be_extended
    layby.end_date = end_date or date.today() + timedelta(days=90)
    layby.location_id = location_id
    layby.payment_frequency = payment_frequency
    layby.extension_count = extension_count
    layby.item_count = item_count
    return layby


def _make_config(enabled=True, min_deposit_pct=10, max_duration=90,
                 cancel_fee_pct=10, cancel_fee_min=Decimal("50.00"),
                 restocking_fee=Decimal("10.00"), max_extensions=3,
                 extension_fee=Decimal("25.00")):
    config = MagicMock()
    config.is_enabled = enabled
    config.min_deposit_percentage = Decimal(str(min_deposit_pct))
    config.max_duration_days = max_duration
    config.cancellation_fee_percentage = Decimal(str(cancel_fee_pct))
    config.cancellation_fee_minimum = cancel_fee_min
    config.restocking_fee_per_item = restocking_fee
    config.max_extensions = max_extensions
    config.extension_fee = extension_fee
    return config


class TestInstallmentDates:
    def test_weekly(self):
        svc, _ = _make_service()
        start = date(2025, 1, 1)
        end = date(2025, 2, 1)
        dates = svc._calculate_installment_dates(start, end, PaymentFrequency.WEEKLY)
        assert len(dates) >= 4  # ~4 weeks

    def test_monthly(self):
        svc, _ = _make_service()
        start = date(2025, 1, 1)
        end = date(2025, 4, 1)
        dates = svc._calculate_installment_dates(start, end, PaymentFrequency.MONTHLY)
        assert len(dates) == 3

    def test_ensures_at_least_one(self):
        svc, _ = _make_service()
        start = date(2025, 1, 1)
        end = date(2025, 1, 5)  # too short for any frequency
        dates = svc._calculate_installment_dates(start, end, PaymentFrequency.MONTHLY)
        assert len(dates) == 1
        assert dates[0] == end


class TestGenerateReference:
    def test_first_reference(self):
        svc, db = _make_service()
        _chain(db, first=None)
        ref = svc._generate_reference_number(BIZ)
        assert ref.startswith("LAY-")
        assert ref.endswith("-0001")

    def test_increments_sequence(self):
        svc, db = _make_service()
        existing = MagicMock()
        existing.reference_number = f"LAY-{date.today().strftime('%Y%m%d')}-0005"
        _chain(db, first=existing)
        ref = svc._generate_reference_number(BIZ)
        assert ref.endswith("-0006")


class TestGetLayby:
    def test_found(self):
        svc, db = _make_service()
        layby = _make_layby()
        _chain(db, first=layby)
        result = svc.get_layby(BIZ, LAYBY_ID)
        assert result == layby

    def test_not_found(self):
        svc, db = _make_service()
        _chain(db, first=None)
        result = svc.get_layby(BIZ, LAYBY_ID)
        assert result is None


class TestListLaybys:
    def test_basic(self):
        svc, db = _make_service()
        chain = _chain(db, rows=[_make_layby()], count=1)
        laybys, total = svc.list_laybys(BIZ)
        assert total == 1
        assert len(laybys) == 1

    def test_with_filters(self):
        svc, db = _make_service()
        chain = _chain(db, rows=[], count=0)
        laybys, total = svc.list_laybys(
            BIZ, status=LaybyStatus.ACTIVE, customer_id=CUST, search="LAY-"
        )
        assert chain.filter.call_count >= 1


class TestMakePayment:
    def test_success(self):
        svc, db = _make_service()
        layby = _make_layby()
        schedule = MagicMock()
        schedule.id = uuid4()
        schedule.amount_due = Decimal("200.00")
        schedule.amount_paid = Decimal("0.00")

        call_count = [0]
        def query_side_effect(*args):
            call_count[0] += 1
            chain = MagicMock()
            chain.filter.return_value = chain
            chain.order_by.return_value = chain
            if call_count[0] == 1:
                # get_layby
                chain.first.return_value = layby
            elif call_count[0] == 2:
                # schedules query
                chain.all.return_value = [schedule]
            elif call_count[0] == 3:
                # next schedule query
                chain.first.return_value = None
            return chain
        db.query.side_effect = query_side_effect

        payment = svc.make_payment(BIZ, LAYBY_ID, Decimal("200.00"), "cash", USER)
        db.add.assert_called()
        db.commit.assert_called()

    def test_not_found(self):
        svc, db = _make_service()
        _chain(db, first=None)
        with pytest.raises(ValueError, match="Layby not found"):
            svc.make_payment(BIZ, LAYBY_ID, Decimal("100.00"), "cash", USER)

    def test_not_eligible(self):
        svc, db = _make_service()
        layby = _make_layby(can_make_payment=False)
        _chain(db, first=layby)
        with pytest.raises(ValueError, match="not eligible"):
            svc.make_payment(BIZ, LAYBY_ID, Decimal("100.00"), "cash", USER)

    def test_zero_amount(self):
        svc, db = _make_service()
        layby = _make_layby()
        _chain(db, first=layby)
        with pytest.raises(ValueError, match="greater than zero"):
            svc.make_payment(BIZ, LAYBY_ID, Decimal("0.00"), "cash", USER)

    def test_exceeds_balance(self):
        svc, db = _make_service()
        layby = _make_layby(balance_due=Decimal("100.00"))
        _chain(db, first=layby)
        with pytest.raises(ValueError, match="exceeds balance"):
            svc.make_payment(BIZ, LAYBY_ID, Decimal("200.00"), "cash", USER)


class TestRefundPayment:
    def test_not_found_layby(self):
        svc, db = _make_service()
        _chain(db, first=None)
        with pytest.raises(ValueError, match="Layby not found"):
            svc.refund_payment(BIZ, LAYBY_ID, PAY_ID, "test", USER)

    def test_not_found_payment(self):
        svc, db = _make_service()
        layby = _make_layby()
        call_count = [0]
        def query_side_effect(*args):
            call_count[0] += 1
            chain = MagicMock()
            chain.filter.return_value = chain
            if call_count[0] == 1:
                chain.first.return_value = layby
            else:
                chain.first.return_value = None
            return chain
        db.query.side_effect = query_side_effect
        with pytest.raises(ValueError, match="Payment not found"):
            svc.refund_payment(BIZ, LAYBY_ID, PAY_ID, "test", USER)

    def test_already_refunded(self):
        svc, db = _make_service()
        layby = _make_layby()
        payment = MagicMock()
        payment.is_refunded = True
        payment.status = PaymentStatus.COMPLETED

        call_count = [0]
        def query_side_effect(*args):
            call_count[0] += 1
            chain = MagicMock()
            chain.filter.return_value = chain
            if call_count[0] == 1:
                chain.first.return_value = layby
            else:
                chain.first.return_value = payment
            return chain
        db.query.side_effect = query_side_effect
        with pytest.raises(ValueError, match="already been refunded"):
            svc.refund_payment(BIZ, LAYBY_ID, PAY_ID, "test", USER)

    def test_success_full_refund(self):
        svc, db = _make_service()
        layby = _make_layby(amount_paid=Decimal("300.00"), balance_due=Decimal("700.00"))
        payment = MagicMock()
        payment.is_refunded = False
        payment.status = PaymentStatus.COMPLETED
        payment.amount = Decimal("100.00")
        payment.refund_amount = None

        call_count = [0]
        def query_side_effect(*args):
            call_count[0] += 1
            chain = MagicMock()
            chain.filter.return_value = chain
            if call_count[0] == 1:
                chain.first.return_value = layby
            else:
                chain.first.return_value = payment
            return chain
        db.query.side_effect = query_side_effect

        result = svc.refund_payment(BIZ, LAYBY_ID, PAY_ID, "test", USER)
        db.commit.assert_called()
        assert payment.refund_amount == Decimal("100.00")


class TestCancelLayby:
    def test_not_found(self):
        svc, db = _make_service()
        _chain(db, first=None)
        with pytest.raises(ValueError, match="Layby not found"):
            svc.cancel_layby(BIZ, LAYBY_ID, "test", USER)

    def test_cannot_cancel(self):
        svc, db = _make_service()
        layby = _make_layby(can_be_cancelled=False)
        _chain(db, first=layby)
        with pytest.raises(ValueError, match="cannot be cancelled"):
            svc.cancel_layby(BIZ, LAYBY_ID, "test", USER)

    def test_cancel_with_fee(self):
        svc, db = _make_service()
        layby = _make_layby(amount_paid=Decimal("200.00"))
        config = _make_config()

        call_count = [0]
        def query_side_effect(*args):
            call_count[0] += 1
            chain = MagicMock()
            chain.filter.return_value = chain
            chain.order_by.return_value = chain
            chain.update.return_value = 0
            if call_count[0] == 1:
                # get_layby
                chain.first.return_value = layby
            elif call_count[0] == 2:
                # _get_config (location)
                chain.first.return_value = None
            elif call_count[0] == 3:
                # _get_config (business fallback)
                chain.first.return_value = config
            else:
                chain.first.return_value = None
            return chain
        db.query.side_effect = query_side_effect

        result = svc.cancel_layby(BIZ, LAYBY_ID, "changed mind", USER)
        assert layby.status == LaybyStatus.CANCELLED
        db.commit.assert_called()
        svc.stock_service.release_stock.assert_called_once()


class TestCollectLayby:
    def test_not_found(self):
        svc, db = _make_service()
        _chain(db, first=None)
        with pytest.raises(ValueError, match="Layby not found"):
            svc.collect_layby(BIZ, LAYBY_ID, USER)

    def test_not_ready(self):
        svc, db = _make_service()
        layby = _make_layby(can_be_collected=False)
        _chain(db, first=layby)
        with pytest.raises(ValueError, match="not ready"):
            svc.collect_layby(BIZ, LAYBY_ID, USER)

    def test_success(self):
        svc, db = _make_service()
        layby = _make_layby(can_be_collected=True, status=LaybyStatus.READY_FOR_COLLECTION)
        _chain(db, first=layby)
        result = svc.collect_layby(BIZ, LAYBY_ID, USER)
        assert layby.status == LaybyStatus.COMPLETED
        svc.stock_service.collect_stock.assert_called_once()
        db.commit.assert_called()


class TestExtendLayby:
    def test_not_found(self):
        svc, db = _make_service()
        _chain(db, first=None)
        with pytest.raises(ValueError, match="Layby not found"):
            svc.extend_layby(BIZ, LAYBY_ID, date.today() + timedelta(days=120), USER)

    def test_cannot_extend(self):
        svc, db = _make_service()
        layby = _make_layby(can_be_extended=False)
        _chain(db, first=layby)
        with pytest.raises(ValueError, match="cannot be extended"):
            svc.extend_layby(BIZ, LAYBY_ID, date.today() + timedelta(days=120), USER)

    def test_date_not_after_current(self):
        svc, db = _make_service()
        layby = _make_layby(end_date=date.today() + timedelta(days=90))
        _chain(db, first=layby)
        with pytest.raises(ValueError, match="after the current"):
            svc.extend_layby(BIZ, LAYBY_ID, date.today(), USER)

    def test_max_extensions_reached(self):
        svc, db = _make_service()
        layby = _make_layby(extension_count=3, end_date=date.today() + timedelta(days=30))
        config = _make_config(max_extensions=3)

        call_count = [0]
        def query_side_effect(*args):
            call_count[0] += 1
            chain = MagicMock()
            chain.filter.return_value = chain
            chain.order_by.return_value = chain
            if call_count[0] == 1:
                # get_layby
                chain.first.return_value = layby
            else:
                # _get_config fallback (location_id is None so only 1 query)
                chain.first.return_value = config
            return chain
        db.query.side_effect = query_side_effect

        with pytest.raises(ValueError, match="Maximum number"):
            svc.extend_layby(BIZ, LAYBY_ID, date.today() + timedelta(days=150), USER)


class TestPaymentHistory:
    def test_found(self):
        svc, db = _make_service()
        layby = _make_layby()
        pay = MagicMock()

        call_count = [0]
        def query_side_effect(*args):
            call_count[0] += 1
            chain = MagicMock()
            chain.filter.return_value = chain
            chain.order_by.return_value = chain
            if call_count[0] == 1:
                chain.first.return_value = layby
            else:
                chain.all.return_value = [pay]
            return chain
        db.query.side_effect = query_side_effect

        result = svc.get_payment_history(BIZ, LAYBY_ID)
        assert len(result) == 1

    def test_not_found(self):
        svc, db = _make_service()
        _chain(db, first=None)
        with pytest.raises(ValueError, match="Layby not found"):
            svc.get_payment_history(BIZ, LAYBY_ID)


class TestGetSchedule:
    def test_found(self):
        svc, db = _make_service()
        layby = _make_layby()
        sched = MagicMock()

        call_count = [0]
        def query_side_effect(*args):
            call_count[0] += 1
            chain = MagicMock()
            chain.filter.return_value = chain
            chain.order_by.return_value = chain
            if call_count[0] == 1:
                chain.first.return_value = layby
            else:
                chain.all.return_value = [sched]
            return chain
        db.query.side_effect = query_side_effect

        result = svc.get_schedule(BIZ, LAYBY_ID)
        assert len(result) == 1


class TestConfig:
    def test_get_config(self):
        svc, db = _make_service()
        config = _make_config()
        _chain(db, first=config)
        result = svc.get_config(BIZ)
        assert result == config

    def test_update_config_existing(self):
        svc, db = _make_service()
        config = _make_config()
        _chain(db, first=config)
        data = MagicMock()
        data.model_dump.return_value = {"max_duration_days": 120}
        result = svc.update_config(BIZ, data)
        db.commit.assert_called()

    def test_update_config_creates_new(self):
        svc, db = _make_service()
        _chain(db, first=None)
        data = MagicMock()
        data.model_dump.return_value = {"max_duration_days": 120}
        svc.update_config(BIZ, data)
        db.add.assert_called()
        db.commit.assert_called()
