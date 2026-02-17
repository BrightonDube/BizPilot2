"""Table management service."""

from typing import Optional, Tuple, List
from uuid import UUID
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.restaurant_table import RestaurantTable, TableStatus
from app.models.order import Order, OrderStatus


class TableService:
    """Service for restaurant table management."""

    def __init__(self, db: Session):
        self.db = db

    def create_table(self, business_id: UUID, table_number: str, capacity: int = 4,
                     section: Optional[str] = None, position_x: float = 0,
                     position_y: float = 0) -> RestaurantTable:
        """Create a new restaurant table."""
        existing = self.db.query(RestaurantTable).filter(
            RestaurantTable.business_id == business_id,
            RestaurantTable.table_number == table_number,
            RestaurantTable.deleted_at.is_(None),
        ).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"Table {table_number} already exists")
        table = RestaurantTable(
            business_id=business_id,
            table_number=table_number,
            capacity=capacity,
            section=section,
            position_x=position_x,
            position_y=position_y,
        )
        self.db.add(table)
        self.db.commit()
        self.db.refresh(table)
        return table

    def get_table(self, table_id: UUID, business_id: UUID) -> RestaurantTable:
        """Get a table by ID."""
        table = self.db.query(RestaurantTable).filter(
            RestaurantTable.id == table_id,
            RestaurantTable.business_id == business_id,
            RestaurantTable.deleted_at.is_(None),
        ).first()
        if not table:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Table not found")
        return table

    def list_tables(self, business_id: UUID, section: Optional[str] = None,
                    status_filter: Optional[TableStatus] = None,
                    page: int = 1, per_page: int = 50) -> Tuple[List[RestaurantTable], int]:
        """List tables with optional filtering."""
        query = self.db.query(RestaurantTable).filter(
            RestaurantTable.business_id == business_id,
            RestaurantTable.deleted_at.is_(None),
            RestaurantTable.is_active == True,  # noqa: E712
        )
        if section:
            query = query.filter(RestaurantTable.section == section)
        if status_filter:
            query = query.filter(RestaurantTable.status == status_filter)
        total = query.count()
        tables = query.order_by(RestaurantTable.table_number).offset((page - 1) * per_page).limit(per_page).all()
        return tables, total

    def update_table(self, table_id: UUID, business_id: UUID, **kwargs) -> RestaurantTable:
        """Update a table."""
        table = self.get_table(table_id, business_id)
        for key, value in kwargs.items():
            if hasattr(table, key) and value is not None:
                setattr(table, key, value)
        self.db.commit()
        self.db.refresh(table)
        return table

    def update_status(self, table_id: UUID, business_id: UUID, new_status: TableStatus) -> RestaurantTable:
        """Update table status."""
        table = self.get_table(table_id, business_id)
        table.status = new_status
        self.db.commit()
        self.db.refresh(table)
        return table

    def delete_table(self, table_id: UUID, business_id: UUID) -> None:
        """Soft delete a table."""
        table = self.get_table(table_id, business_id)
        from datetime import datetime, timezone
        table.deleted_at = datetime.now(timezone.utc)
        self.db.commit()

    def get_table_order(self, table_id: UUID, business_id: UUID) -> Optional[Order]:
        """Get the current active order for a table."""
        return self.db.query(Order).filter(
            Order.table_id == table_id,
            Order.business_id == business_id,
            Order.deleted_at.is_(None),
            Order.status.notin_([OrderStatus.CANCELLED.value, OrderStatus.REFUNDED.value]),
            Order.payment_status != 'paid',
        ).first()

    def get_tables_with_orders(self, business_id: UUID) -> List[dict]:
        """Get all tables with their current order info."""
        tables, _ = self.list_tables(business_id, per_page=200)
        result = []
        for table in tables:
            order = self.get_table_order(table.id, business_id)
            result.append({
                "table": table,
                "current_order": order,
                "has_active_order": order is not None,
            })
        return result
