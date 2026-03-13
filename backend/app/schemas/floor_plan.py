from typing import List, Optional, Literal
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime

class FloorPlanTableBase(BaseModel):
    name: str = Field(..., max_length=50)
    section: Optional[str] = Field(None, max_length=50)
    x_position: float
    y_position: float
    width: float = 10.0
    height: float = 10.0
    capacity: int = 4
    shape: Literal["rectangle", "circle"] = "rectangle"
    is_active: bool = True

class FloorPlanTableCreate(FloorPlanTableBase):
    pass

class FloorPlanTableUpdate(BaseModel):
    name: Optional[str] = None
    section: Optional[str] = None
    x_position: Optional[float] = None
    y_position: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    capacity: Optional[int] = None
    shape: Optional[Literal["rectangle", "circle"]] = None
    is_active: Optional[bool] = None

class FloorPlanTableResponse(FloorPlanTableBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    business_id: UUID
    floor_plan_id: UUID
    status: str = "available"
    waiter_id: Optional[UUID] = None
    order_id: Optional[UUID] = None
    cover_count: int = 0

class TableStatusResponse(BaseModel):
    table_id: UUID
    status: str
    waiter_id: Optional[UUID] = None
    cover_count: int = 0
    order_id: Optional[UUID] = None

class FloorPlanBase(BaseModel):
    name: str = Field(..., max_length=100)
    is_active: bool = True
    width_units: int = 100
    height_units: int = 100

class FloorPlanCreate(FloorPlanBase):
    pass

class FloorPlanUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    width_units: Optional[int] = None
    height_units: Optional[int] = None

class FloorPlanResponse(FloorPlanBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    business_id: UUID
    tables: List[FloorPlanTableResponse] = []
    created_at: datetime
    updated_at: datetime

class SectionAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    business_id: UUID
    section_name: str
    waiter_id: Optional[UUID]
    floor_plan_id: UUID
