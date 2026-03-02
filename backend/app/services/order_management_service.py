"""Order management service for enhanced order handling."""

from typing import Optional, Tuple, List
from uuid import UUID
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import desc
from fastapi import HTTPException, status

from app.models.order import Order, OrderItem, OrderStatus, OrderType
from app.models.order_status_history import OrderStatusHistory
from app.models.restaurant_table import RestaurantTable, TableStatus


# Valid status transitions
VALID_TRANSITIONS = {
    OrderStatus.DRAFT: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    OrderStatus.PENDING: [OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.CANCELLED],
    OrderStatus.CONFIRMED: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
    OrderStatus.PROCESSING: [OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.CANCELLED],
    OrderStatus.SHIPPED: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
    OrderStatus.DELIVERED: [OrderStatus.RECEIVED, OrderStatus.REFUNDED],
    OrderStatus.RECEIVED: [OrderStatus.REFUNDED],
    OrderStatus.CANCELLED: [],
    OrderStatus.REFUNDED: [],
}


class OrderManagementService:
    """Enhanced order management service."""

    def __init__(self, db: Session):
        self.db = db

    def update_order_status(self, order_id: UUID, business_id: UUID,
                            new_status: OrderStatus, user_id: Optional[UUID] = None,
                            reason: Optional[str] = None) -> Order:
        """Update order status with validation and history tracking."""
        order = self.db.query(Order).filter(
            Order.id == order_id,
            Order.business_id == business_id,
            Order.deleted_at.is_(None),
        ).first()
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

        old_status = order.status
        allowed = VALID_TRANSITIONS.get(old_status, [])
        if new_status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot transition from {old_status.value} to {new_status.value}",
            )

        # Record status history
        history = OrderStatusHistory(
            order_id=order.id,
            old_status=old_status.value if old_status else None,
            new_status=new_status.value,
            changed_by_id=user_id,
            reason=reason,
        )
        self.db.add(history)

        order.status = new_status

        # Update table status if dine-in order is completed
        if order.table_id and new_status in (OrderStatus.CANCELLED, OrderStatus.REFUNDED):
            table = self.db.query(RestaurantTable).filter(
                RestaurantTable.id == order.table_id,
            ).first()
            if table:
                table.status = TableStatus.DIRTY

        self.db.commit()
        self.db.refresh(order)
        return order

    def assign_table(self, order_id: UUID, table_id: UUID, business_id: UUID) -> Order:
        """Assign an order to a table."""
        order = self.db.query(Order).filter(
            Order.id == order_id,
            Order.business_id == business_id,
            Order.deleted_at.is_(None),
        ).first()
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

        table = self.db.query(RestaurantTable).filter(
            RestaurantTable.id == table_id,
            RestaurantTable.business_id == business_id,
            RestaurantTable.deleted_at.is_(None),
        ).first()
        if not table:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Table not found")

        order.table_id = table_id
        order.order_type = OrderType.DINE_IN
        table.status = TableStatus.OCCUPIED
        self.db.commit()
        self.db.refresh(order)
        return order

    def transfer_table(self, order_id: UUID, new_table_id: UUID, business_id: UUID) -> Order:
        """Transfer an order to a different table."""
        order = self.db.query(Order).filter(
            Order.id == order_id,
            Order.business_id == business_id,
            Order.deleted_at.is_(None),
        ).first()
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

        old_table_id = order.table_id

        new_table = self.db.query(RestaurantTable).filter(
            RestaurantTable.id == new_table_id,
            RestaurantTable.business_id == business_id,
            RestaurantTable.deleted_at.is_(None),
        ).first()
        if not new_table:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="New table not found")

        # Free old table
        if old_table_id:
            old_table = self.db.query(RestaurantTable).filter(
                RestaurantTable.id == old_table_id,
            ).first()
            if old_table:
                old_table.status = TableStatus.AVAILABLE

        # Assign new table
        order.table_id = new_table_id
        new_table.status = TableStatus.OCCUPIED
        self.db.commit()
        self.db.refresh(order)
        return order

    def merge_orders(self, order_ids: List[UUID], business_id: UUID,
                     target_order_id: Optional[UUID] = None) -> Order:
        """Merge multiple orders into one."""
        if len(order_ids) < 2:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Need at least 2 orders to merge")

        orders = self.db.query(Order).filter(
            Order.id.in_(order_ids),
            Order.business_id == business_id,
            Order.deleted_at.is_(None),
        ).all()

        if len(orders) != len(order_ids):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail="One or more orders not found")

        # Use target or first order as the primary
        target = None
        if target_order_id:
            target = next((o for o in orders if o.id == target_order_id), None)
        if not target:
            target = orders[0]

        # Move items from other orders to target
        for order in orders:
            if order.id == target.id:
                continue
            for item in order.items:
                item.order_id = target.id
            # Cancel the source order
            order.status = OrderStatus.CANCELLED
            order.internal_notes = (order.internal_notes or "") + f"\nMerged into order {target.order_number}"

            # Free table from source order
            if order.table_id:
                src_table = self.db.query(RestaurantTable).filter(
                    RestaurantTable.id == order.table_id,
                ).first()
                if src_table:
                    src_table.status = TableStatus.AVAILABLE

        # Recalculate totals
        self._recalculate_order_totals(target)
        self.db.commit()
        self.db.refresh(target)
        return target

    def split_order(self, order_id: UUID, item_ids: List[UUID],
                    business_id: UUID) -> Order:
        """Split selected items into a new order."""
        order = self.db.query(Order).filter(
            Order.id == order_id,
            Order.business_id == business_id,
            Order.deleted_at.is_(None),
        ).first()
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

        items_to_move = [item for item in order.items if item.id in item_ids and item.deleted_at is None]
        if not items_to_move:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="No valid items to split")

        # Create new order
        import random
        new_order = Order(
            business_id=business_id,
            customer_id=order.customer_id,
            direction=order.direction,
            order_number=f"{order.order_number}-S{random.randint(100, 999)}",
            status=order.status,
            order_type=order.order_type,
            source=order.source,
        )
        self.db.add(new_order)
        self.db.flush()

        # Move items
        for item in items_to_move:
            item.order_id = new_order.id

        # Recalculate totals for both orders
        self._recalculate_order_totals(order)
        self._recalculate_order_totals(new_order)

        self.db.commit()
        self.db.refresh(new_order)
        return new_order

    def open_tab(self, business_id: UUID, tab_name: str,
                 customer_id: Optional[UUID] = None,
                 table_id: Optional[UUID] = None) -> Order:
        """Open a new tab."""
        import random
        tab = Order(
            business_id=business_id,
            customer_id=customer_id,
            table_id=table_id,
            direction="inbound",
            order_number=f"TAB-{datetime.now().strftime('%Y%m%d')}-{random.randint(1000, 9999)}",
            status=OrderStatus.DRAFT,
            order_type=OrderType.DINE_IN if table_id else OrderType.STANDARD,
            is_tab=True,
            tab_name=tab_name,
            source="pos",
        )
        self.db.add(tab)

        if table_id:
            table = self.db.query(RestaurantTable).filter(
                RestaurantTable.id == table_id,
            ).first()
            if table:
                table.status = TableStatus.OCCUPIED

        self.db.commit()
        self.db.refresh(tab)
        return tab

    def close_tab(self, order_id: UUID, business_id: UUID) -> Order:
        """Close a tab (prepare for payment)."""
        order = self.db.query(Order).filter(
            Order.id == order_id,
            Order.business_id == business_id,
            Order.deleted_at.is_(None),
            Order.is_tab == True,  # noqa: E712
        ).first()
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail="Tab not found")
        order.is_tab = False
        order.status = OrderStatus.CONFIRMED
        self.db.commit()
        self.db.refresh(order)
        return order

    def get_open_tabs(self, business_id: UUID) -> List[Order]:
        """Get all open tabs."""
        return self.db.query(Order).filter(
            Order.business_id == business_id,
            Order.is_tab == True,  # noqa: E712
            Order.deleted_at.is_(None),
            Order.status.notin_([OrderStatus.CANCELLED.value, OrderStatus.REFUNDED.value]),
        ).order_by(Order.created_at.desc()).all()

    def add_item_to_order(self, order_id: UUID, business_id: UUID,
                          name: str, unit_price: Decimal, quantity: int = 1,
                          product_id: Optional[UUID] = None,
                          notes: Optional[str] = None) -> OrderItem:
        """Add an item to an existing order."""
        order = self.db.query(Order).filter(
            Order.id == order_id,
            Order.business_id == business_id,
            Order.deleted_at.is_(None),
        ).first()
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

        if order.status in (OrderStatus.CANCELLED, OrderStatus.REFUNDED):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Cannot add items to cancelled/refunded order")

        item = OrderItem(
            order_id=order.id,
            product_id=product_id,
            name=name,
            unit_price=unit_price,
            quantity=quantity,
            total=unit_price * quantity,
            notes=notes,
        )
        self.db.add(item)
        self._recalculate_order_totals(order)
        self.db.commit()
        self.db.refresh(item)
        return item

    def remove_item_from_order(self, order_id: UUID, item_id: UUID,
                               business_id: UUID, reason: Optional[str] = None) -> None:
        """Remove an item from an order (soft delete)."""
        order = self.db.query(Order).filter(
            Order.id == order_id,
            Order.business_id == business_id,
            Order.deleted_at.is_(None),
        ).first()
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

        item = self.db.query(OrderItem).filter(
            OrderItem.id == item_id,
            OrderItem.order_id == order.id,
            OrderItem.deleted_at.is_(None),
        ).first()
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

        item.deleted_at = datetime.now(timezone.utc)
        item.notes = (item.notes or "") + f"\nRemoved: {reason or 'No reason'}"
        self._recalculate_order_totals(order)
        self.db.commit()

    def get_order_history(self, business_id: UUID, search: Optional[str] = None,
                          status_filter: Optional[OrderStatus] = None,
                          order_type: Optional[OrderType] = None,
                          date_from: Optional[datetime] = None,
                          date_to: Optional[datetime] = None,
                          page: int = 1, per_page: int = 20) -> Tuple[List[Order], int]:
        """Get order history with filtering."""
        query = self.db.query(Order).filter(
            Order.business_id == business_id,
            Order.deleted_at.is_(None),
        )
        if search:
            query = query.filter(
                Order.order_number.ilike(f"%{search}%")
            )
        if status_filter:
            query = query.filter(Order.status == status_filter)
        if order_type:
            query = query.filter(Order.order_type == order_type)
        if date_from:
            query = query.filter(Order.order_date >= date_from)
        if date_to:
            query = query.filter(Order.order_date <= date_to)

        total = query.count()
        orders = query.order_by(desc(Order.order_date)).offset((page - 1) * per_page).limit(per_page).all()
        return orders, total

    def get_status_history(self, order_id: UUID, business_id: UUID) -> List[OrderStatusHistory]:
        """Get status change history for an order."""
        order = self.db.query(Order).filter(
            Order.id == order_id,
            Order.business_id == business_id,
            Order.deleted_at.is_(None),
        ).first()
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

        return self.db.query(OrderStatusHistory).filter(
            OrderStatusHistory.order_id == order_id,
        ).order_by(OrderStatusHistory.changed_at.desc()).all()

    def set_delivery_info(self, order_id: UUID, business_id: UUID,
                          delivery_address: Optional[str] = None,
                          delivery_phone: Optional[str] = None,
                          driver_id: Optional[UUID] = None,
                          estimated_time: Optional[datetime] = None,
                          delivery_fee: Optional[Decimal] = None) -> Order:
        """Set delivery information on an order."""
        order = self.db.query(Order).filter(
            Order.id == order_id,
            Order.business_id == business_id,
            Order.deleted_at.is_(None),
        ).first()
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

        order.order_type = OrderType.DELIVERY
        if delivery_address is not None:
            order.delivery_address_text = delivery_address
        if delivery_phone is not None:
            order.delivery_phone = delivery_phone
        if driver_id is not None:
            order.driver_id = driver_id
        if estimated_time is not None:
            order.estimated_delivery_time = estimated_time
        if delivery_fee is not None:
            order.delivery_fee = delivery_fee
            self._recalculate_order_totals(order)

        self.db.commit()
        self.db.refresh(order)
        return order

    def _recalculate_order_totals(self, order: Order) -> None:
        """Recalculate order totals from items."""
        active_items = [i for i in order.items if i.deleted_at is None]
        subtotal = sum(i.unit_price * i.quantity for i in active_items)
        tax = sum(i.tax_amount or 0 for i in active_items)
        discount = sum(i.discount_amount or 0 for i in active_items)
        delivery_fee = order.delivery_fee or 0
        order.subtotal = subtotal
        order.tax_amount = tax
        order.discount_amount = discount
        order.total = subtotal + tax - discount + delivery_fee + (order.shipping_amount or 0)
