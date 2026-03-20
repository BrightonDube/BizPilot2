from typing import List
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from decimal import Decimal
from app.models.waiter_cashup import WaiterCashup
from app.models.shift import Shift, ShiftStatus
from app.models.order import Order, OrderStatus
from app.models.payment import PaymentTransaction, PaymentTransactionStatus, PaymentMethod, PaymentMethodType
from app.schemas.cashup import WaiterCashupResponse, CashupRejectRequest

class CashupService:
    @staticmethod
    async def generate_waiter_cashup(shift_id: UUID, waiter_id: UUID, business_id: UUID, db: AsyncSession) -> WaiterCashupResponse:
        shift = (await db.execute(select(Shift).filter(Shift.id == shift_id, Shift.business_id == business_id, Shift.user_id == waiter_id))).scalars().first()
        if not shift: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shift not found")
        if shift.status != ShiftStatus.COMPLETED:
            if (await db.execute(select(func.count(Order.id)).filter(Order.business_id == business_id, Order.user_id == waiter_id, Order.status.in_([OrderStatus.PENDING, OrderStatus.PROCESSING]), Order.created_at >= shift.actual_start))).scalar() > 0:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Shift has open orders")
        if (await db.execute(select(WaiterCashup).filter(WaiterCashup.shift_id == shift_id))).scalars().first(): raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cashup already generated")
        start_time, end_time = shift.actual_start, shift.actual_end or datetime.now(timezone.utc)
        totals = (await db.execute(select(func.sum(PaymentTransaction.amount).label("total_amount"), func.sum(PaymentTransaction.tip_amount).label("total_tips"), func.count(func.distinct(Order.id)).label("tables_served"), func.sum(Order.course_count).label("cover_count")).join(Order, PaymentTransaction.order_id == Order.id).filter(Order.business_id == business_id, Order.user_id == waiter_id, Order.created_at >= start_time, Order.created_at <= end_time, PaymentTransaction.status == PaymentTransactionStatus.COMPLETED))).first()
        breakdown = (await db.execute(select(PaymentMethod.method_type, func.sum(PaymentTransaction.amount + PaymentTransaction.tip_amount).label("sum_amount")).join(PaymentTransaction, PaymentTransaction.payment_method_id == PaymentMethod.id).join(Order, PaymentTransaction.order_id == Order.id).filter(Order.business_id == business_id, Order.user_id == waiter_id, Order.created_at >= start_time, Order.created_at <= end_time, PaymentTransaction.status == PaymentTransactionStatus.COMPLETED).group_by(PaymentMethod.method_type))).all()
        cash_collected, card_collected = Decimal("0.00"), Decimal("0.00")
        for row in breakdown:
            if row.method_type == PaymentMethodType.CASH: cash_collected = Decimal(str(row.sum_amount))
            elif row.method_type == PaymentMethodType.CARD: card_collected = Decimal(str(row.sum_amount))
        new_cashup = WaiterCashup(business_id=business_id, shift_id=shift_id, waiter_id=waiter_id, status="pending", total_sales=Decimal(str(totals.total_amount or 0)), total_tips=Decimal(str(totals.total_tips or 0)), cash_collected=cash_collected, card_collected=card_collected, cover_count=int(totals.cover_count or 0), tables_served=int(totals.tables_served or 0), generated_at=datetime.now(timezone.utc))
        db.add(new_cashup); await db.commit(); await db.refresh(new_cashup)
        return WaiterCashupResponse.model_validate(new_cashup)

    @staticmethod
    async def approve_cashup(cashup_id: UUID, approved_by: UUID, business_id: UUID, db: AsyncSession) -> WaiterCashupResponse:
        cashup = (await db.execute(select(WaiterCashup).filter(WaiterCashup.id == cashup_id, WaiterCashup.business_id == business_id))).scalars().first()
        if not cashup: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cashup not found")
        if cashup.waiter_id == approved_by: raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot approve own cashup")
        cashup.status, cashup.approved_by, cashup.approved_at = "approved", approved_by, datetime.now(timezone.utc)
        await db.commit(); await db.refresh(cashup)
        return WaiterCashupResponse.model_validate(cashup)

    @staticmethod
    async def reject_cashup(cashup_id: UUID, rejected_by: UUID, business_id: UUID, data: CashupRejectRequest, db: AsyncSession) -> WaiterCashupResponse:
        cashup = (await db.execute(select(WaiterCashup).filter(WaiterCashup.id == cashup_id, WaiterCashup.business_id == business_id))).scalars().first()
        if not cashup: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cashup not found")
        cashup.status, cashup.rejection_reason = "rejected", data.rejection_reason
        await db.commit(); await db.refresh(cashup)
        return WaiterCashupResponse.model_validate(cashup)

    @staticmethod
    async def get_pending_cashups(business_id: UUID, db: AsyncSession) -> List[WaiterCashupResponse]:
        return [WaiterCashupResponse.model_validate(c) for c in (await db.execute(select(WaiterCashup).filter(WaiterCashup.business_id == business_id, WaiterCashup.status == "pending").order_by(WaiterCashup.generated_at.desc()))).scalars().all()]

    @staticmethod
    async def get_cashup(cashup_id: UUID, business_id: UUID, db: AsyncSession) -> WaiterCashupResponse:
        cashup = (await db.execute(select(WaiterCashup).filter(WaiterCashup.id == cashup_id, WaiterCashup.business_id == business_id))).scalars().first()
        if not cashup: raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cashup not found")
        return WaiterCashupResponse.model_validate(cashup)
