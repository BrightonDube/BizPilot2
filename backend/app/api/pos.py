from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.schemas.cashup import WaiterCashupResponse, WaiterCashupCreate, CashupRejectRequest
from app.services.cashup_service import CashupService
from app.api.floor_plan import check_manager_role

router = APIRouter()

@router.post("/cashup/generate", response_model=WaiterCashupResponse)
async def generate_cashup(data: WaiterCashupCreate, db: AsyncSession = Depends(deps.get_db), business_id: str = Depends(deps.get_current_business_id), current_user = Depends(deps.get_current_active_user)):
    return await CashupService.generate_waiter_cashup(data.shift_id, current_user.id, UUID(business_id), db)

@router.get("/cashup/pending", response_model=List[WaiterCashupResponse])
async def get_pending_cashups(db: AsyncSession = Depends(deps.get_db), business_id: str = Depends(deps.get_current_business_id), current_user = Depends(check_manager_role)):
    return await CashupService.get_pending_cashups(UUID(business_id), db)

@router.get("/cashup/{cashup_id}", response_model=WaiterCashupResponse)
async def get_cashup(cashup_id: UUID, db: AsyncSession = Depends(deps.get_db), business_id: str = Depends(deps.get_current_business_id), current_user = Depends(deps.get_current_active_user)):
    return await CashupService.get_cashup(cashup_id, UUID(business_id), db)

@router.post("/cashup/{cashup_id}/approve", response_model=WaiterCashupResponse)
async def approve_cashup(cashup_id: UUID, db: AsyncSession = Depends(deps.get_db), business_id: str = Depends(deps.get_current_business_id), current_user = Depends(check_manager_role)):
    return await CashupService.approve_cashup(cashup_id, current_user.id, UUID(business_id), db)

@router.post("/cashup/{cashup_id}/reject", response_model=WaiterCashupResponse)
async def reject_cashup(cashup_id: UUID, data: CashupRejectRequest, db: AsyncSession = Depends(deps.get_db), business_id: str = Depends(deps.get_current_business_id), current_user = Depends(check_manager_role)):
    return await CashupService.reject_cashup(cashup_id, current_user.id, UUID(business_id), data, db)
