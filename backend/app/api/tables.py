"""Table management API endpoints."""

from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel as PydanticBaseModel, ConfigDict

from app.api.deps import get_sync_db, get_current_active_user, get_current_business_id
from app.services.table_service import TableService
from app.models.restaurant_table import TableStatus

router = APIRouter(prefix="/tables", tags=["Tables"])


class TableCreate(PydanticBaseModel):
    table_number: str
    capacity: int = 4
    section: Optional[str] = None
    position_x: float = 0
    position_y: float = 0


class TableUpdate(PydanticBaseModel):
    table_number: Optional[str] = None
    capacity: Optional[int] = None
    section: Optional[str] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    is_active: Optional[bool] = None


class TableStatusUpdate(PydanticBaseModel):
    status: TableStatus


class TableResponse(PydanticBaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    table_number: str
    capacity: int
    status: str
    section: Optional[str] = None
    position_x: float
    position_y: float
    is_active: bool


class TableWithOrderResponse(PydanticBaseModel):
    model_config = ConfigDict(from_attributes=True)

    table: TableResponse
    has_active_order: bool
    current_order: Optional[dict] = None


class TableListResponse(PydanticBaseModel):
    items: list[TableResponse]
    total: int
    page: int
    per_page: int


@router.post("", response_model=TableResponse)
def create_table(
    data: TableCreate,
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Create a new restaurant table."""
    service = TableService(db)
    return service.create_table(
        business_id=business_id,
        table_number=data.table_number,
        capacity=data.capacity,
        section=data.section,
        position_x=data.position_x,
        position_y=data.position_y,
    )


@router.get("", response_model=TableListResponse)
def list_tables(
    section: Optional[str] = None,
    status: Optional[TableStatus] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """List restaurant tables."""
    service = TableService(db)
    tables, total = service.list_tables(
        business_id=business_id,
        section=section,
        status_filter=status,
        page=page,
        per_page=per_page,
    )
    return TableListResponse(
        items=[TableResponse.model_validate(t) for t in tables],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/floor-plan")
def get_floor_plan(
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Get floor plan with table status and order info."""
    service = TableService(db)
    tables_with_orders = service.get_tables_with_orders(business_id)
    result = []
    for item in tables_with_orders:
        table = item["table"]
        order = item["current_order"]
        result.append({
            "id": str(table.id),
            "table_number": table.table_number,
            "capacity": table.capacity,
            "status": table.status.value if hasattr(table.status, 'value') else table.status,
            "section": table.section,
            "position_x": float(table.position_x or 0),
            "position_y": float(table.position_y or 0),
            "has_active_order": item["has_active_order"],
            "order_number": order.order_number if order else None,
            "order_total": float(order.total) if order else None,
            "order_item_count": order.item_count if order else 0,
        })
    return result


@router.get("/{table_id}", response_model=TableResponse)
def get_table(
    table_id: UUID,
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Get a specific table."""
    service = TableService(db)
    return service.get_table(table_id, business_id)


@router.put("/{table_id}", response_model=TableResponse)
def update_table(
    table_id: UUID,
    data: TableUpdate,
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Update a table."""
    service = TableService(db)
    return service.update_table(table_id, business_id, **data.model_dump(exclude_none=True))


@router.patch("/{table_id}/status", response_model=TableResponse)
def update_table_status(
    table_id: UUID,
    data: TableStatusUpdate,
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Update table status."""
    service = TableService(db)
    return service.update_status(table_id, business_id, data.status)


@router.delete("/{table_id}")
def delete_table(
    table_id: UUID,
    business_id: UUID = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
    _user=Depends(get_current_active_user),
):
    """Delete a table."""
    service = TableService(db)
    service.delete_table(table_id, business_id)
    return {"detail": "Table deleted"}
