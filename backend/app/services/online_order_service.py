"""Online ordering service."""

from datetime import datetime, date, timezone, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.menu import MenuItem
from app.models.online_order import (
    FulfillmentType,
    OnlineOrder,
    OnlineOrderItem,
    OnlineOrderStatus,
    OnlineStore,
)


class OnlineOrderService:
    """Service for online ordering operations."""

    def __init__(self, db: Session):
        self.db = db

    # ---- Store configuration ----

    def get_or_create_store(
        self, business_id: str, store_name: str
    ) -> OnlineStore:
        """Get existing store config or create a new one."""
        store = (
            self.db.query(OnlineStore)
            .filter(
                OnlineStore.business_id == business_id,
                OnlineStore.deleted_at.is_(None),
            )
            .first()
        )
        if store:
            return store
        store = OnlineStore(business_id=business_id, store_name=store_name)
        self.db.add(store)
        self.db.commit()
        self.db.refresh(store)
        return store

    def update_store(
        self, business_id: str, **kwargs
    ) -> Optional[OnlineStore]:
        """Update store settings."""
        store = (
            self.db.query(OnlineStore)
            .filter(
                OnlineStore.business_id == business_id,
                OnlineStore.deleted_at.is_(None),
            )
            .first()
        )
        if not store:
            return None
        for key, value in kwargs.items():
            if hasattr(store, key):
                setattr(store, key, value)
        self.db.commit()
        self.db.refresh(store)
        return store

    # ---- Menu ----

    def get_store_menu(self, business_id: str) -> List[MenuItem]:
        """Get available menu items for the online store."""
        return (
            self.db.query(MenuItem)
            .filter(
                MenuItem.business_id == business_id,
                MenuItem.is_available.is_(True),
                MenuItem.deleted_at.is_(None),
            )
            .order_by(MenuItem.display_order, MenuItem.display_name)
            .all()
        )

    # ---- Order CRUD ----

    def _generate_order_number(self, business_id: str) -> str:
        """Generate an auto-incrementing order number OL-YYYYMMDD-XXXX."""
        today = date.today()
        prefix = f"OL-{today.strftime('%Y%m%d')}-"
        last = (
            self.db.query(OnlineOrder)
            .filter(
                OnlineOrder.business_id == business_id,
                OnlineOrder.order_number.like(f"{prefix}%"),
            )
            .order_by(OnlineOrder.order_number.desc())
            .first()
        )
        if last:
            seq = int(last.order_number.split("-")[-1]) + 1
        else:
            seq = 1
        return f"{prefix}{seq:04d}"

    def create_order(
        self,
        business_id: str,
        customer_name: str,
        customer_phone: str,
        fulfillment_type: FulfillmentType,
        items: List[Dict],
        delivery_address: Optional[str] = None,
        customer_email: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> OnlineOrder:
        """Create an online order.

        ``items`` is a list of dicts with keys:
        product_id (optional), name, quantity, unit_price, modifiers, notes.
        """
        order_number = self._generate_order_number(business_id)

        # Look up store for delivery fee
        store = (
            self.db.query(OnlineStore)
            .filter(
                OnlineStore.business_id == business_id,
                OnlineStore.deleted_at.is_(None),
            )
            .first()
        )
        delivery_fee = Decimal("0")
        estimated_prep = 30
        if store:
            estimated_prep = store.estimated_prep_minutes or 30
            if fulfillment_type == FulfillmentType.DELIVERY:
                delivery_fee = store.delivery_fee or Decimal("0")

        subtotal = Decimal("0")
        order_items: list[OnlineOrderItem] = []
        for item in items:
            qty = item.get("quantity", 1)
            unit_price = Decimal(str(item["unit_price"]))
            line_total = unit_price * qty
            subtotal += line_total
            order_items.append(
                OnlineOrderItem(
                    product_id=item.get("product_id"),
                    name=item["name"],
                    quantity=qty,
                    unit_price=unit_price,
                    total=line_total,
                    modifiers=item.get("modifiers"),
                    notes=item.get("notes"),
                )
            )

        # Free delivery threshold
        if store and store.free_delivery_threshold and subtotal >= store.free_delivery_threshold:
            delivery_fee = Decimal("0")

        total = subtotal + delivery_fee
        now_utc = datetime.now(timezone.utc)

        order = OnlineOrder(
            business_id=business_id,
            order_number=order_number,
            customer_name=customer_name,
            customer_phone=customer_phone,
            customer_email=customer_email,
            fulfillment_type=fulfillment_type,
            delivery_address=delivery_address,
            status=OnlineOrderStatus.PENDING,
            subtotal=subtotal,
            delivery_fee=delivery_fee,
            total=total,
            notes=notes,
            estimated_ready_at=now_utc + timedelta(minutes=estimated_prep),
        )
        self.db.add(order)
        self.db.flush()

        for oi in order_items:
            oi.order_id = order.id
            self.db.add(oi)

        self.db.commit()
        self.db.refresh(order)
        return order

    def get_order(
        self, order_id: str, business_id: str
    ) -> Optional[OnlineOrder]:
        """Get a single order by ID."""
        return (
            self.db.query(OnlineOrder)
            .filter(
                OnlineOrder.id == order_id,
                OnlineOrder.business_id == business_id,
                OnlineOrder.deleted_at.is_(None),
            )
            .first()
        )

    def list_orders(
        self,
        business_id: str,
        status: Optional[OnlineOrderStatus] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[OnlineOrder], int]:
        """List orders with optional status filter and pagination."""
        query = self.db.query(OnlineOrder).filter(
            OnlineOrder.business_id == business_id,
            OnlineOrder.deleted_at.is_(None),
        )
        if status:
            query = query.filter(OnlineOrder.status == status)
        total = query.count()
        items = (
            query.order_by(OnlineOrder.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def update_status(
        self, order_id: str, business_id: str, new_status: OnlineOrderStatus
    ) -> Optional[OnlineOrder]:
        """Update order status."""
        order = self.get_order(order_id, business_id)
        if not order:
            return None
        order.status = new_status
        self.db.commit()
        self.db.refresh(order)
        return order

    def cancel_order(
        self, order_id: str, business_id: str, reason: Optional[str] = None
    ) -> Optional[OnlineOrder]:
        """Cancel an order."""
        order = self.get_order(order_id, business_id)
        if not order:
            return None
        order.status = OnlineOrderStatus.CANCELLED
        if reason:
            existing = order.notes or ""
            order.notes = f"{existing}\n[Cancelled] {reason}".strip()
        self.db.commit()
        self.db.refresh(order)
        return order

    def get_active_orders(self, business_id: str) -> List[OnlineOrder]:
        """Get orders that are not yet delivered/collected/cancelled/refunded."""
        terminal = {
            OnlineOrderStatus.DELIVERED,
            OnlineOrderStatus.COLLECTED,
            OnlineOrderStatus.CANCELLED,
            OnlineOrderStatus.REFUNDED,
        }
        return (
            self.db.query(OnlineOrder)
            .filter(
                OnlineOrder.business_id == business_id,
                OnlineOrder.deleted_at.is_(None),
                ~OnlineOrder.status.in_(terminal),
            )
            .order_by(OnlineOrder.created_at.desc())
            .all()
        )

    def get_order_stats(self, business_id: str) -> Dict:
        """Get order statistics for today."""
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        base = self.db.query(OnlineOrder).filter(
            OnlineOrder.business_id == business_id,
            OnlineOrder.deleted_at.is_(None),
        )
        total = base.count()
        today_q = base.filter(OnlineOrder.created_at >= today_start)
        today_total = today_q.count()
        pending = base.filter(
            OnlineOrder.status == OnlineOrderStatus.PENDING
        ).count()
        preparing = base.filter(
            OnlineOrder.status == OnlineOrderStatus.PREPARING
        ).count()
        completed_today = today_q.filter(
            OnlineOrder.status.in_(
                [OnlineOrderStatus.DELIVERED, OnlineOrderStatus.COLLECTED]
            )
        ).count()
        revenue_today = (
            today_q.filter(
                OnlineOrder.status.in_(
                    [OnlineOrderStatus.DELIVERED, OnlineOrderStatus.COLLECTED]
                )
            )
            .with_entities(func.coalesce(func.sum(OnlineOrder.total), 0))
            .scalar()
        )
        return {
            "total_orders": total,
            "today_orders": today_total,
            "pending": pending,
            "preparing": preparing,
            "completed_today": completed_today,
            "revenue_today": float(revenue_today),
        }
