import uuid
from datetime import datetime, timezone
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException
from app.models.restaurant_table import FloorPlan, FloorPlanTable, FloorPlanSectionAssignment
from app.models.order import Order, OrderStatus
from app.services.floor_plan_service import FloorPlanService
from app.schemas.floor_plan import FloorPlanTableCreate

@pytest.fixture
def db():
    mock = AsyncMock()
    async def mock_refresh(obj):
        if hasattr(obj, 'id') and obj.id is None: obj.id = uuid.uuid4()
        if hasattr(obj, 'created_at') and obj.created_at is None: obj.created_at = datetime.now(timezone.utc)
        if hasattr(obj, 'updated_at') and obj.updated_at is None: obj.updated_at = datetime.now(timezone.utc)
    mock.refresh = mock_refresh
    return mock

@pytest.fixture
def redis_client():
    client = AsyncMock()
    client.get.return_value = None
    return client

BIZ_ID, FP_ID, NOW = uuid.uuid4(), uuid.uuid4(), datetime.now(timezone.utc)

@pytest.mark.asyncio
async def test_get_active_floor_plan_returns_all_tables_with_status(db):
    mock_fp = FloorPlan(id=FP_ID, business_id=BIZ_ID, name="Main Floor", is_active=True, width_units=100, height_units=100, created_at=NOW, updated_at=NOW, sort_order=0)
    mock_table = FloorPlanTable(id=uuid.uuid4(), business_id=BIZ_ID, floor_plan_id=FP_ID, name="T1", section="Window", x_position=10.0, y_position=20.0, width=10.0, height=10.0, capacity=4, shape="rectangle", is_active=True)
    mock_fp.floor_plan_tables = [mock_table]
    db.execute.side_effect = [AsyncMock(scalars=lambda: MagicMock(first=lambda: mock_fp)), AsyncMock(scalars=lambda: MagicMock(all=lambda: []))]
    result = await FloorPlanService.get_active_floor_plan(BIZ_ID, db)
    assert result.id == FP_ID and len(result.tables) == 1 and result.tables[0].name == "T1" and result.tables[0].status == "available"

@pytest.mark.asyncio
async def test_get_active_floor_plan_uses_redis_cache_on_second_request(db, redis_client):
    mock_fp_data = '{"id": "'+str(FP_ID)+'", "business_id": "'+str(BIZ_ID)+'", "name": "Main", "is_active": true, "width_units": 100, "height_units": 100, "tables": [], "created_at": "2026-03-13T12:00:00Z", "updated_at": "2026-03-13T12:00:00Z"}'
    redis_client.get.return_value = mock_fp_data
    result = await FloorPlanService.get_active_floor_plan(BIZ_ID, db, redis_client)
    assert str(result.id) == str(FP_ID)
    db.execute.assert_not_called()

@pytest.mark.asyncio
async def test_get_table_status_returns_only_status_fields(db):
    T1_ID = uuid.uuid4()
    db.execute.side_effect = [AsyncMock(scalars=lambda: MagicMock(all=lambda: [T1_ID])), AsyncMock(scalars=lambda: MagicMock(all=lambda: []))]
    result = await FloorPlanService.get_table_status_only(BIZ_ID, db)
    assert len(result) == 1 and result[0].table_id == T1_ID and result[0].status == "available"

@pytest.mark.asyncio
async def test_floor_plan_cache_invalidated_after_table_created(db, redis_client):
    db.execute.return_value = AsyncMock(scalars=lambda: MagicMock(first=lambda: FloorPlan(id=FP_ID, business_id=BIZ_ID)))
    await FloorPlanService.create_floor_plan_table(FP_ID, FloorPlanTableCreate(name="T2", x_position=30, y_position=40), BIZ_ID, db, redis_client)
    redis_client.delete.assert_any_call(f"bizpilot:floor_plan:{BIZ_ID}")
    redis_client.delete.assert_any_call(f"bizpilot:table_status:{BIZ_ID}")

@pytest.mark.asyncio
async def test_floor_plan_returns_404_for_different_business(db):
    db.execute.return_value = AsyncMock(scalars=lambda: MagicMock(first=lambda: None))
    with pytest.raises(HTTPException) as exc: await FloorPlanService.get_active_floor_plan(BIZ_ID, db)
    assert exc.value.status_code == 404

@pytest.mark.asyncio
async def test_assign_waiter_to_section_replaces_existing_assignment(db):
    await FloorPlanService.assign_waiter_to_section("Window", uuid.uuid4(), FP_ID, BIZ_ID, db)
    assert db.execute.called and db.add.called and db.commit.called
