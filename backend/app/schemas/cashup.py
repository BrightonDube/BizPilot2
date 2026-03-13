from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from decimal import Decimal

class WaiterCashupBase(BaseModel):
    total_sales: Decimal
    total_tips: Decimal = Decimal("0.00")
    cash_collected: Decimal = Decimal("0.00")
    card_collected: Decimal = Decimal("0.00")
    cover_count: int = 0
    tables_served: int = 0

class WaiterCashupCreate(BaseModel):
    shift_id: UUID

class WaiterCashupResponse(WaiterCashupBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    business_id: UUID
    shift_id: UUID
    waiter_id: UUID
    status: str
    generated_at: datetime
    approved_by: Optional[UUID] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class CashupRejectRequest(BaseModel):
    rejection_reason: str = Field(..., min_length=10)
