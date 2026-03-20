import json
from typing import List, Optional
from uuid import UUID
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status
from redis.asyncio import Redis

from app.models.restaurant_table import FloorPlan, FloorPlanTable, FloorPlanSectionAssignment
from app.models.order import Order, OrderStatus
from app.schemas.floor_plan import (
    FloorPlanCreate, FloorPlanUpdate, FloorPlanResponse,
    FloorPlanTableCreate, FloorPlanTableUpdate, FloorPlanTableResponse,
    TableStatusResponse, SectionAssignmentResponse
)

class FloorPlanService:
    @staticmethod
    async def get_active_floor_plan(business_id: UUID, db: AsyncSession, redis_client: Optional[Redis] = None) -> FloorPlanResponse:
        cache_key = f"bizpilot:floor_plan:{business_id}"
        if redis_client:
            cached = await redis_client.get(cache_key)
            if cached: return FloorPlanResponse.model_validate_json(cached)
        stmt = select(FloorPlan).filter(FloorPlan.business_id == business_id, FloorPlan.is_active == True).order_by(FloorPlan.sort_order.asc()).options(selectinload(FloorPlan.floor_plan_tables))
        floor_plan = (await db.execute(stmt)).scalars().first()
        if not floor_plan: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active floor plan found")
        order_stmt = select(Order).filter(Order.business_id == business_id, Order.status.in_([OrderStatus.PENDING, OrderStatus.PROCESSING]), Order.table_id.isnot(None))
        active_orders = (await db.execute(order_stmt)).scalars().all()
        order_map = {order.table_id: order for order in active_orders}
        tables_response = [FloorPlanTableResponse(id=t.id, business_id=t.business_id, floor_plan_id=t.floor_plan_id, name=t.name, section=t.section, x_position=float(t.x_position), y_position=float(t.y_position), width=float(t.width), height=float(t.height), capacity=t.capacity, shape=t.shape, is_active=t.is_active, status="occupied" if order_map.get(t.id) else "available", waiter_id=None, order_id=order_map.get(t.id).id if order_map.get(t.id) else None, cover_count=order_map.get(t.id).course_count if order_map.get(t.id) else 0) for t in floor_plan.floor_plan_tables]
        response = FloorPlanResponse(id=floor_plan.id, business_id=floor_plan.business_id, name=floor_plan.name, is_active=floor_plan.is_active, width_units=floor_plan.width_units, height_units=floor_plan.height_units, tables=tables_response, created_at=floor_plan.created_at, updated_at=floor_plan.updated_at)
        if redis_client: await redis_client.setex(cache_key, 30, response.model_dump_json())
        return response

    @staticmethod
    async def get_table_status_only(business_id: UUID, db: AsyncSession, redis_client: Optional[Redis] = None) -> List[TableStatusResponse]:
        cache_key = f"bizpilot:table_status:{business_id}"
        if redis_client:
            cached = await redis_client.get(cache_key)
            if cached: return [TableStatusResponse.model_validate(item) for item in json.loads(cached)]
        table_ids = (await db.execute(select(FloorPlanTable.id).filter(FloorPlanTable.business_id == business_id))).scalars().all()
        active_orders = (await db.execute(select(Order).filter(Order.business_id == business_id, Order.status.in_([OrderStatus.PENDING, OrderStatus.PROCESSING]), Order.table_id.isnot(None)))).scalars().all()
        order_map = {order.table_id: order for order in active_orders}
        status_list = [TableStatusResponse(table_id=tid, status="occupied" if order_map.get(tid) else "available", waiter_id=None, cover_count=order_map.get(tid).course_count if order_map.get(tid) else 0, order_id=order_map.get(tid).id if order_map.get(tid) else None) for tid in table_ids]
        if redis_client: await redis_client.setex(cache_key, 10, json.dumps([s.model_dump(mode='json') for s in status_list]))
        return status_list

    @staticmethod
    async def create_floor_plan(data: FloorPlanCreate, business_id: UUID, db: AsyncSession) -> FloorPlanResponse:
        new_fp = FloorPlan(**data.model_dump(), business_id=business_id)
        db.add(new_fp); await db.commit(); await db.refresh(new_fp)
        return FloorPlanResponse.model_validate(new_fp)

    @staticmethod
    async def update_floor_plan(floor_plan_id: UUID, data: FloorPlanUpdate, business_id: UUID, db: AsyncSession) -> FloorPlanResponse:
        floor_plan = (await db.execute(select(FloorPlan).filter(FloorPlan.id == floor_plan_id, FloorPlan.business_id == business_id))).scalars().first()
        if not floor_plan: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Floor plan not found")
        for k, v in data.model_dump(exclude_unset=True).items(): setattr(floor_plan, k, v)
        await db.commit(); await db.refresh(floor_plan)
        return FloorPlanResponse.model_validate(floor_plan)

    @staticmethod
    async def create_floor_plan_table(floor_plan_id: UUID, data: FloorPlanTableCreate, business_id: UUID, db: AsyncSession, redis_client: Optional[Redis] = None) -> FloorPlanTableResponse:
        if not (await db.execute(select(FloorPlan).filter(FloorPlan.id == floor_plan_id, FloorPlan.business_id == business_id))).scalars().first(): raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Floor plan not found")
        new_table = FloorPlanTable(**data.model_dump(), floor_plan_id=floor_plan_id, business_id=business_id)
        db.add(new_table); await db.commit(); await db.refresh(new_table)
        if redis_client: await redis_client.delete(f"bizpilot:floor_plan:{business_id}"); await redis_client.delete(f"bizpilot:table_status:{business_id}")
        return FloorPlanTableResponse.model_validate(new_table)

    @staticmethod
    async def update_floor_plan_table(floor_plan_id: UUID, table_id: UUID, data: FloorPlanTableUpdate, business_id: UUID, db: AsyncSession, redis_client: Optional[Redis] = None) -> FloorPlanTableResponse:
        table = (await db.execute(select(FloorPlanTable).filter(FloorPlanTable.id == table_id, FloorPlanTable.floor_plan_id == floor_plan_id, FloorPlanTable.business_id == business_id))).scalars().first()
        if not table: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Table not found")
        for k, v in data.model_dump(exclude_unset=True).items(): setattr(table, k, v)
        await db.commit(); await db.refresh(table)
        if redis_client: await redis_client.delete(f"bizpilot:floor_plan:{business_id}"); await redis_client.delete(f"bizpilot:table_status:{business_id}")
        return FloorPlanTableResponse.model_validate(table)

    @staticmethod
    async def delete_floor_plan_table(floor_plan_id: UUID, table_id: UUID, business_id: UUID, db: AsyncSession, redis_client: Optional[Redis] = None) -> None:
        table = (await db.execute(select(FloorPlanTable).filter(FloorPlanTable.id == table_id, FloorPlanTable.floor_plan_id == floor_plan_id, FloorPlanTable.business_id == business_id))).scalars().first()
        if not table: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Table not found")
        await db.delete(table); await db.commit()
        if redis_client: await redis_client.delete(f"bizpilot:floor_plan:{business_id}"); await redis_client.delete(f"bizpilot:table_status:{business_id}")

    @staticmethod
    async def assign_waiter_to_section(section_name: str, waiter_id: UUID, floor_plan_id: UUID, business_id: UUID, db: AsyncSession) -> SectionAssignmentResponse:
        await db.execute(delete(FloorPlanSectionAssignment).filter(FloorPlanSectionAssignment.business_id == business_id, FloorPlanSectionAssignment.floor_plan_id == floor_plan_id, FloorPlanSectionAssignment.section_name == section_name))
        new_assignment = FloorPlanSectionAssignment(business_id=business_id, section_name=section_name, waiter_id=waiter_id, floor_plan_id=floor_plan_id)
        db.add(new_assignment); await db.commit(); await db.refresh(new_assignment)
        return SectionAssignmentResponse.model_validate(new_assignment)
