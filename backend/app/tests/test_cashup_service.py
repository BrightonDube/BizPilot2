import uuid
from datetime import datetime, timezone, timedelta
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException
from decimal import Decimal
from app.models.waiter_cashup import WaiterCashup
from app.models.shift import Shift, ShiftStatus
from app.models.payment import PaymentMethodType
from app.services.cashup_service import CashupService
from app.schemas.cashup import CashupRejectRequest

@pytest.fixture
def db():
    mock = AsyncMock()
    now = datetime.now(timezone.utc)
    async def mock_refresh(obj):
        if hasattr(obj, 'id') and obj.id is None:
            obj.id = uuid.uuid4()
        if hasattr(obj, 'created_at') and obj.created_at is None:
            obj.created_at = now
        if hasattr(obj, 'updated_at') and obj.updated_at is None:
            obj.updated_at = now
        if hasattr(obj, 'generated_at') and obj.generated_at is None:
            obj.generated_at = now
        if hasattr(obj, 'shift_id') and obj.shift_id is None:
            obj.shift_id = SHIFT_ID
    mock.refresh = mock_refresh
    return mock

BIZ_ID, WAITER_ID, SHIFT_ID, NOW = uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), datetime.now(timezone.utc)

def make_cashup(**kwargs):
    """Create a WaiterCashup with all required fields populated."""
    defaults = dict(
        id=uuid.uuid4(),
        business_id=BIZ_ID,
        waiter_id=WAITER_ID,
        shift_id=SHIFT_ID,
        status="pending",
        total_sales=Decimal("0.00"),
        total_tips=Decimal("0.00"),
        cash_collected=Decimal("0.00"),
        card_collected=Decimal("0.00"),
        cover_count=0,
        tables_served=0,
        generated_at=NOW,
        created_at=NOW,
        updated_at=NOW,
    )
    defaults.update(kwargs)
    return WaiterCashup(**defaults)

@pytest.mark.asyncio
async def test_generate_cashup_aggregates_all_shift_orders_correctly(db):
    mock_shift = Shift(id=SHIFT_ID, business_id=BIZ_ID, user_id=WAITER_ID, status=ShiftStatus.COMPLETED, actual_start=NOW - timedelta(hours=8), actual_end=NOW)
    mock_totals = MagicMock()
    mock_totals.total_amount, mock_totals.total_tips, mock_totals.tables_served, mock_totals.cover_count = Decimal("100.00"), Decimal("10.00"), 5, 12
    db.execute.side_effect = [AsyncMock(scalars=lambda: MagicMock(first=lambda: mock_shift)), AsyncMock(scalars=lambda: MagicMock(first=lambda: None)), AsyncMock(first=lambda: mock_totals), AsyncMock(all=lambda: [MagicMock(method_type=PaymentMethodType.CARD, sum_amount=Decimal("110.00"))])]
    result = await CashupService.generate_waiter_cashup(SHIFT_ID, WAITER_ID, BIZ_ID, db)
    assert result.total_sales == Decimal("100.00") and result.total_tips == Decimal("10.00") and result.card_collected == Decimal("110.00") and result.status == "pending"

@pytest.mark.asyncio
async def test_generate_cashup_fails_when_shift_has_open_orders(db):
    mock_shift = Shift(id=SHIFT_ID, business_id=BIZ_ID, user_id=WAITER_ID, status=ShiftStatus.IN_PROGRESS, actual_start=NOW - timedelta(hours=4))
    db.execute.side_effect = [AsyncMock(scalars=lambda: MagicMock(first=lambda: mock_shift)), AsyncMock(scalar=lambda: 1)]
    with pytest.raises(HTTPException) as exc:
        await CashupService.generate_waiter_cashup(SHIFT_ID, WAITER_ID, BIZ_ID, db)
    assert exc.value.status_code == 400

@pytest.mark.asyncio
async def test_approve_cashup_changes_status(db):
    mock_cashup = make_cashup(total_sales=Decimal("100.00"))
    db.execute.return_value = AsyncMock(scalars=lambda: MagicMock(first=lambda: mock_cashup))
    result = await CashupService.approve_cashup(mock_cashup.id, uuid.uuid4(), BIZ_ID, db)
    assert result.status == "approved"

@pytest.mark.asyncio
async def test_reject_cashup_requires_reason(db):
    mock_cashup = make_cashup()
    db.execute.return_value = AsyncMock(scalars=lambda: MagicMock(first=lambda: mock_cashup))
    result = await CashupService.reject_cashup(mock_cashup.id, uuid.uuid4(), BIZ_ID, CashupRejectRequest(rejection_reason="Discrepancy in cash"), db)
    assert result.status == "rejected"
