from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from redis.asyncio import Redis
from app.api import deps
from app.models.business_user import BusinessUser
from app.schemas.floor_plan import FloorPlanResponse, TableStatusResponse, FloorPlanTableCreate, FloorPlanTableResponse, SectionAssignmentResponse, FloorPlanTableUpdate, FloorPlanCreate, FloorPlanUpdate
from app.services.floor_plan_service import FloorPlanService

router = APIRouter()

async def check_manager_role(current_user=Depends(deps.get_current_active_user), business_id: str = Depends(deps.get_current_business_id), db: AsyncSession = Depends(deps.get_db)):
    if current_user.is_superadmin: return current_user
    business_user = (await db.execute(select(BusinessUser).options(selectinload(BusinessUser.role)).filter(BusinessUser.user_id == current_user.id, BusinessUser.business_id == UUID(business_id)))).scalars().first()
    if not business_user or not business_user.role or business_user.role.name.lower() not in ["admin", "manager"]: raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Requires manager or admin role")
    return current_user

@router.get("/active", response_model=FloorPlanResponse)
async def get_active_floor_plan(db: AsyncSession = Depends(deps.get_db), redis: Redis = Depends(deps.get_redis), business_id: str = Depends(deps.get_current_business_id)):
    return await FloorPlanService.get_active_floor_plan(UUID(business_id), db, redis)

@router.get("/table-status", response_model=List[TableStatusResponse])
async def get_table_status(db: AsyncSession = Depends(deps.get_db), redis: Redis = Depends(deps.get_redis), business_id: str = Depends(deps.get_current_business_id)):
    return await FloorPlanService.get_table_status_only(UUID(business_id), db, redis)

@router.post("", response_model=FloorPlanResponse)
async def create_floor_plan(data: FloorPlanCreate, db: AsyncSession = Depends(deps.get_db), business_id: str = Depends(deps.get_current_business_id), current_user=Depends(check_manager_role)):
    return await FloorPlanService.create_floor_plan(data, UUID(business_id), db)

@router.put("/{floor_plan_id}", response_model=FloorPlanResponse)
async def update_floor_plan(floor_plan_id: UUID, data: FloorPlanUpdate, db: AsyncSession = Depends(deps.get_db), business_id: str = Depends(deps.get_current_business_id), current_user=Depends(check_manager_role)):
    return await FloorPlanService.update_floor_plan(floor_plan_id, data, UUID(business_id), db)

@router.post("/{floor_plan_id}/tables", response_model=FloorPlanTableResponse)
async def create_floor_plan_table(floor_plan_id: UUID, data: FloorPlanTableCreate, db: AsyncSession = Depends(deps.get_db), redis: Redis = Depends(deps.get_redis), business_id: str = Depends(deps.get_current_business_id), current_user=Depends(check_manager_role)):
    return await FloorPlanService.create_floor_plan_table(floor_plan_id, data, UUID(business_id), db, redis)

@router.put("/{floor_plan_id}/tables/{table_id}", response_model=FloorPlanTableResponse)
async def update_floor_plan_table(floor_plan_id: UUID, table_id: UUID, data: FloorPlanTableUpdate, db: AsyncSession = Depends(deps.get_db), redis: Redis = Depends(deps.get_redis), business_id: str = Depends(deps.get_current_business_id), current_user=Depends(check_manager_role)):
    return await FloorPlanService.update_floor_plan_table(floor_plan_id, table_id, data, UUID(business_id), db, redis)

@router.delete("/{floor_plan_id}/tables/{table_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_floor_plan_table(floor_plan_id: UUID, table_id: UUID, db: AsyncSession = Depends(deps.get_db), redis: Redis = Depends(deps.get_redis), business_id: str = Depends(deps.get_current_business_id), current_user=Depends(check_manager_role)):
    await FloorPlanService.delete_floor_plan_table(floor_plan_id, table_id, UUID(business_id), db, redis)

@router.post("/{floor_plan_id}/sections/assign", response_model=SectionAssignmentResponse)
async def assign_waiter_to_section(floor_plan_id: UUID, section_name: str, waiter_id: UUID, db: AsyncSession = Depends(deps.get_db), business_id: str = Depends(deps.get_current_business_id), current_user=Depends(check_manager_role)):
    return await FloorPlanService.assign_waiter_to_section(section_name, waiter_id, floor_plan_id, UUID(business_id), db)
