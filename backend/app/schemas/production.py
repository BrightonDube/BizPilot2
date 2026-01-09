"""Production schemas for API validation."""

from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field
from datetime import datetime

from app.models.production import ProductionStatus


class ProductionOrderItemBase(BaseModel):
    """Base schema for production order item."""
    source_product_id: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=255)
    unit: str = Field("unit", min_length=1, max_length=50)
    quantity_required: Decimal = Field(..., ge=0)
    unit_cost: Decimal = Field(default=Decimal("0"), ge=0)


class ProductionOrderItemCreate(ProductionOrderItemBase):
    """Schema for creating a production order item."""
    pass


class ProductionOrderItemResponse(ProductionOrderItemBase):
    """Schema for production order item response."""
    id: str
    business_id: str
    production_order_id: str
    quantity_used: Decimal
    source_product_name: Optional[str] = None
    line_total: Decimal
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProductionOrderBase(BaseModel):
    """Base schema for production order."""
    product_id: str
    quantity_to_produce: int = Field(..., ge=1)
    scheduled_date: Optional[datetime] = None
    notes: Optional[str] = None


class ProductionOrderCreate(ProductionOrderBase):
    """Schema for creating a production order."""
    items: Optional[List[ProductionOrderItemCreate]] = None


class ProductionOrderUpdate(BaseModel):
    """Schema for updating a production order."""
    quantity_to_produce: Optional[int] = Field(None, ge=1)
    quantity_produced: Optional[int] = Field(None, ge=0)
    status: Optional[ProductionStatus] = None
    scheduled_date: Optional[datetime] = None
    notes: Optional[str] = None
    actual_cost: Optional[Decimal] = Field(None, ge=0)


class ProductionOrderResponse(ProductionOrderBase):
    """Schema for production order response."""
    id: str
    business_id: str
    order_number: str
    quantity_produced: int
    status: ProductionStatus
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    estimated_cost: Decimal
    actual_cost: Decimal
    product_name: Optional[str] = None
    completion_percentage: float
    items: List[ProductionOrderItemResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProductionOrderListResponse(BaseModel):
    """Schema for paginated production order list."""
    items: List[ProductionOrderResponse]
    total: int
    page: int
    per_page: int
    total_pages: int


class StartProductionRequest(BaseModel):
    """Schema for starting production."""
    pass


class CompleteProductionRequest(BaseModel):
    """Schema for completing production."""
    quantity_produced: int = Field(..., ge=1)
    actual_cost: Optional[Decimal] = Field(None, ge=0)


class IngredientSuggestion(BaseModel):
    """Schema for AI ingredient suggestion."""
    id: str
    name: str
    sku: Optional[str] = None
    unit: str = "unit"
    cost_price: Optional[Decimal] = None
    quantity_on_hand: Optional[int] = None
    relevance_score: float = 0.0
