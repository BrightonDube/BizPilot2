"""Tests for Stock Control core features.

Covers:
- receive_without_po batch receiving
- WasteService: record_waste, get_waste_report
- StockTakeService: submit/approve/reject approval workflow
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch


def _make_db():
    db = MagicMock()
    return db


def _uuid():
    return uuid.uuid4()


# ---------------------------------------------------------------------------
# InventoryService.receive_without_po
# ---------------------------------------------------------------------------


def test_receive_without_po_calls_record_purchase_for_each_item():
    from app.services.inventory_service import InventoryService

    db = _make_db()
    svc = InventoryService(db)

    mock_txn1 = MagicMock()
    mock_txn2 = MagicMock()

    with patch.object(svc, "record_purchase", side_effect=[mock_txn1, mock_txn2]) as mock_rp:
        result = svc.receive_without_po(
            business_id="biz-1",
            items=[
                {"product_id": _uuid(), "quantity": 10, "unit_cost": "25.00"},
                {"product_id": _uuid(), "quantity": 5, "unit_cost": "50.00"},
            ],
        )

    assert mock_rp.call_count == 2
    assert len(result) == 2
    db.commit.assert_called_once()


def test_receive_without_po_raises_for_zero_quantity():
    from app.services.inventory_service import InventoryService
    import pytest

    db = _make_db()
    svc = InventoryService(db)

    with pytest.raises(ValueError, match="positive"):
        svc.receive_without_po(
            business_id="biz-1",
            items=[{"product_id": _uuid(), "quantity": 0, "unit_cost": "10.00"}],
        )


def test_receive_without_po_raises_if_no_inventory_record():
    from app.services.inventory_service import InventoryService
    import pytest

    db = _make_db()
    svc = InventoryService(db)

    with patch.object(svc, "record_purchase", return_value=None):
        with pytest.raises(ValueError, match="No inventory record"):
            svc.receive_without_po(
                business_id="biz-1",
                items=[{"product_id": _uuid(), "quantity": 5, "unit_cost": "10.00"}],
            )


# ---------------------------------------------------------------------------
# WasteService.record_waste
# ---------------------------------------------------------------------------


def _make_inventory_item(business_id, product_id, qty=100, avg_cost=Decimal("10.00")):
    item = MagicMock()
    item.id = _uuid()
    item.business_id = business_id
    item.product_id = product_id
    item.quantity_on_hand = qty
    item.average_cost = avg_cost
    return item


def test_record_waste_deducts_inventory():
    from app.services.waste_service import WasteService

    db = _make_db()
    business_id = _uuid()
    product_id = _uuid()
    user_id = _uuid()

    inv_item = _make_inventory_item(business_id, product_id, qty=100)
    db.query.return_value.filter.return_value.first.return_value = inv_item

    svc = WasteService(db)
    waste = svc.record_waste(
        business_id=business_id,
        product_id=product_id,
        recorded_by_id=user_id,
        quantity=5,
    )

    assert inv_item.quantity_on_hand == 95
    assert waste.quantity == 5
    assert waste.total_cost == Decimal("50.00")


def test_record_waste_raises_for_insufficient_stock():
    from app.services.waste_service import WasteService
    import pytest

    db = _make_db()
    business_id = _uuid()
    product_id = _uuid()
    user_id = _uuid()

    inv_item = _make_inventory_item(business_id, product_id, qty=3)
    db.query.return_value.filter.return_value.first.return_value = inv_item

    svc = WasteService(db)
    with pytest.raises(ValueError, match="Insufficient stock"):
        svc.record_waste(
            business_id=business_id,
            product_id=product_id,
            recorded_by_id=user_id,
            quantity=10,
        )


def test_record_waste_raises_for_zero_quantity():
    from app.services.waste_service import WasteService
    import pytest

    db = _make_db()
    svc = WasteService(db)

    with pytest.raises(ValueError, match="positive"):
        svc.record_waste(
            business_id=_uuid(),
            product_id=_uuid(),
            recorded_by_id=_uuid(),
            quantity=0,
        )


def test_record_waste_raises_if_no_inventory():
    from app.services.waste_service import WasteService
    import pytest

    db = _make_db()
    db.query.return_value.filter.return_value.first.return_value = None
    svc = WasteService(db)

    with pytest.raises(ValueError, match="not found"):
        svc.record_waste(
            business_id=_uuid(),
            product_id=_uuid(),
            recorded_by_id=_uuid(),
            quantity=1,
        )


def test_record_waste_creates_inventory_transaction():
    from app.services.waste_service import WasteService
    from app.models.inventory import InventoryTransaction

    db = _make_db()
    business_id = _uuid()
    product_id = _uuid()
    user_id = _uuid()

    inv_item = _make_inventory_item(business_id, product_id, qty=50, avg_cost=Decimal("20.00"))
    db.query.return_value.filter.return_value.first.return_value = inv_item

    added_objects = []
    db.add.side_effect = lambda obj: added_objects.append(obj)

    svc = WasteService(db)
    svc.record_waste(
        business_id=business_id,
        product_id=product_id,
        recorded_by_id=user_id,
        quantity=3,
        notes="Expired stock",
    )

    txns = [o for o in added_objects if isinstance(o, InventoryTransaction)]
    assert len(txns) == 1
    assert txns[0].quantity_change == -3
    assert txns[0].total_cost == Decimal("60.00")


# ---------------------------------------------------------------------------
# WasteService.get_waste_report
# ---------------------------------------------------------------------------


def test_waste_report_aggregates_by_product():
    from app.services.waste_service import WasteService

    db = _make_db()
    pid1 = _uuid()
    pid2 = _uuid()

    r1 = MagicMock()
    r1.id = _uuid()
    r1.product_id = pid1
    r1.waste_category_id = None
    r1.quantity = 5
    r1.total_cost = Decimal("50.00")
    r1.recorded_at = datetime.now(timezone.utc)
    r1.notes = None

    r2 = MagicMock()
    r2.id = _uuid()
    r2.product_id = pid2
    r2.waste_category_id = None
    r2.quantity = 3
    r2.total_cost = Decimal("30.00")
    r2.recorded_at = datetime.now(timezone.utc)
    r2.notes = None

    db.query.return_value.filter.return_value.filter.return_value.all.return_value = [r1, r2]
    db.query.return_value.filter.return_value.all.return_value = [r1, r2]

    svc = WasteService(db)
    report = svc.get_waste_report(business_id=_uuid())

    assert report["total_quantity"] == 8
    assert report["total_cost"] == 80.0


# ---------------------------------------------------------------------------
# StockTakeService: submit / approve / reject
# ---------------------------------------------------------------------------


def _make_session(status):

    s = MagicMock()
    s.id = _uuid()
    s.business_id = _uuid()
    s.reference = "STK-20260327-TEST"
    s.status = status
    return s


def test_submit_session_changes_status_to_pending_approval():
    from app.services.stock_take_service import StockTakeService
    from app.models.stock_take import StockTakeStatus

    db = _make_db()
    session = _make_session(StockTakeStatus.IN_PROGRESS)

    svc = StockTakeService(db)
    with patch.object(svc, "get_session", return_value=session):
        result = svc.submit_session(
            session_id=str(session.id),
            business_id=str(session.business_id),
            user_id=str(_uuid()),
        )

    assert result.status == StockTakeStatus.PENDING_APPROVAL
    assert result.submitted_at is not None


def test_submit_session_raises_if_not_in_progress():
    from app.services.stock_take_service import StockTakeService
    from app.models.stock_take import StockTakeStatus
    import pytest

    db = _make_db()
    session = _make_session(StockTakeStatus.DRAFT)

    svc = StockTakeService(db)
    with patch.object(svc, "get_session", return_value=session):
        with pytest.raises(ValueError, match="IN_PROGRESS"):
            svc.submit_session(
                session_id=str(session.id),
                business_id=str(session.business_id),
                user_id=str(_uuid()),
            )


def test_approve_session_applies_variances():
    from app.services.stock_take_service import StockTakeService
    from app.models.stock_take import StockTakeStatus

    db = _make_db()
    session = _make_session(StockTakeStatus.PENDING_APPROVAL)

    svc = StockTakeService(db)
    with patch.object(svc, "get_session", return_value=session):
        with patch.object(svc, "get_counts", return_value=[]):
            result = svc.approve_session(
                session_id=str(session.id),
                business_id=str(session.business_id),
                user_id=str(_uuid()),
            )

    assert result.status == StockTakeStatus.COMPLETED
    assert result.approved_at is not None


def test_reject_session_returns_to_in_progress():
    from app.services.stock_take_service import StockTakeService
    from app.models.stock_take import StockTakeStatus

    db = _make_db()
    session = _make_session(StockTakeStatus.PENDING_APPROVAL)

    svc = StockTakeService(db)
    with patch.object(svc, "get_session", return_value=session):
        result = svc.reject_session(
            session_id=str(session.id),
            business_id=str(session.business_id),
            user_id=str(_uuid()),
            reason="Counts look incorrect",
        )

    assert result.status == StockTakeStatus.IN_PROGRESS
    assert result.rejection_reason == "Counts look incorrect"


def test_reject_session_raises_if_not_pending():
    from app.services.stock_take_service import StockTakeService
    from app.models.stock_take import StockTakeStatus
    import pytest

    db = _make_db()
    session = _make_session(StockTakeStatus.COMPLETED)

    svc = StockTakeService(db)
    with patch.object(svc, "get_session", return_value=session):
        with pytest.raises(ValueError, match="PENDING_APPROVAL"):
            svc.reject_session(
                session_id=str(session.id),
                business_id=str(session.business_id),
                user_id=str(_uuid()),
                reason="test",
            )
