"""Order service for business logic."""

from typing import List, Optional, Tuple
from uuid import UUID
from decimal import Decimal
from datetime import datetime
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import or_, func

from app.models.order import Order, OrderItem, OrderStatus, PaymentStatus
from app.models.base import utc_now
from app.schemas.order import OrderCreate, OrderUpdate, OrderItemCreate


class OrderService:
    """Service for order operations."""

    def __init__(self, db: Session):
        self.db = db

    def generate_order_number(self, business_id: str) -> str:
        """Generate a unique order number."""
        # Count existing orders for this business
        count = self.db.query(Order).filter(
            Order.business_id == business_id
        ).count()
        
        # Format: ORD-YYYYMMDD-XXXXX
        today = datetime.now().strftime("%Y%m%d")
        return f"ORD-{today}-{(count + 1):05d}"

    def get_orders(
        self,
        business_id: str,
        page: int = 1,
        per_page: int = 20,
        search: Optional[str] = None,
        customer_id: Optional[str] = None,
        status: Optional[OrderStatus] = None,
        payment_status: Optional[PaymentStatus] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> Tuple[List[Order], int]:
        """Get orders with filtering and pagination."""
        query = self.db.query(Order).filter(
            Order.business_id == business_id,
            Order.deleted_at.is_(None),
        )
        
        # Search filter
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Order.order_number.ilike(search_term),
                    Order.notes.ilike(search_term),
                )
            )
        
        # Customer filter
        if customer_id:
            query = query.filter(Order.customer_id == customer_id)
        
        # Status filters
        if status:
            query = query.filter(Order.status == status)
        if payment_status:
            query = query.filter(Order.payment_status == payment_status)
        
        # Date filters
        if date_from:
            query = query.filter(Order.order_date >= date_from)
        if date_to:
            query = query.filter(Order.order_date <= date_to)
        
        # Get total count
        total = query.count()
        
        # Sorting
        sort_column = getattr(Order, sort_by, Order.created_at)
        if sort_order == "desc":
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())
        
        # Pagination
        offset = (page - 1) * per_page
        orders = query.offset(offset).limit(per_page).all()
        
        return orders, total

    def get_order(self, order_id: str, business_id: str) -> Optional[Order]:
        """Get an order by ID."""
        return self.db.query(Order).filter(
            Order.id == order_id,
            Order.business_id == business_id,
            Order.deleted_at.is_(None),
        ).first()

    def get_order_by_number(self, order_number: str, business_id: str) -> Optional[Order]:
        """Get an order by order number."""
        return self.db.query(Order).filter(
            Order.order_number == order_number,
            Order.business_id == business_id,
            Order.deleted_at.is_(None),
        ).first()

    def create_order(self, business_id: str, data: OrderCreate) -> Order:
        """Create a new order with items."""
        # Create order
        order = Order(
            business_id=business_id,
            order_number=self.generate_order_number(business_id),
            customer_id=data.customer_id,
            status=data.status,
            payment_status=data.payment_status,
            payment_method=data.payment_method,
            shipping_address=data.shipping_address.model_dump() if data.shipping_address else None,
            billing_address=data.billing_address.model_dump() if data.billing_address else None,
            notes=data.notes,
            internal_notes=data.internal_notes,
            tags=data.tags or [],
            source=data.source,
        )
        self.db.add(order)
        self.db.flush()  # Get order ID
        
        # Create order items
        for item_data in data.items:
            item = self._create_order_item(order.id, item_data)
            self.db.add(item)
        
        # Calculate totals
        self._calculate_order_totals(order)
        
        self.db.commit()
        self.db.refresh(order)
        return order

    def _create_order_item(self, order_id: UUID, data: OrderItemCreate) -> OrderItem:
        """Create an order item."""
        # Calculate amounts
        line_total = data.unit_price * data.quantity
        discount_amount = line_total * (data.discount_percent / 100)
        taxable_amount = line_total - discount_amount
        tax_amount = taxable_amount * (data.tax_rate / 100)
        total = taxable_amount + tax_amount
        
        return OrderItem(
            order_id=order_id,
            product_id=data.product_id,
            name=data.name,
            sku=data.sku,
            description=data.description,
            unit_price=data.unit_price,
            quantity=data.quantity,
            tax_rate=data.tax_rate,
            tax_amount=tax_amount,
            discount_percent=data.discount_percent,
            discount_amount=discount_amount,
            total=total,
            notes=data.notes,
        )

    def _calculate_order_totals(self, order: Order) -> None:
        """Calculate order totals from items."""
        items = self.db.query(OrderItem).filter(
            OrderItem.order_id == order.id,
            OrderItem.deleted_at.is_(None),
        ).all()
        
        subtotal = sum(item.unit_price * item.quantity for item in items)
        tax_amount = sum(item.tax_amount or 0 for item in items)
        item_discounts = sum(item.discount_amount or 0 for item in items)
        
        order.subtotal = subtotal
        order.tax_amount = tax_amount
        order.total = subtotal + tax_amount + (order.shipping_amount or 0) - (order.discount_amount or 0) - item_discounts

    def update_order(self, order: Order, data: OrderUpdate) -> Order:
        """Update an order."""
        update_data = data.model_dump(exclude_unset=True)
        
        # Handle nested address objects
        if "shipping_address" in update_data and update_data["shipping_address"]:
            update_data["shipping_address"] = update_data["shipping_address"].model_dump() if hasattr(update_data["shipping_address"], 'model_dump') else update_data["shipping_address"]
        if "billing_address" in update_data and update_data["billing_address"]:
            update_data["billing_address"] = update_data["billing_address"].model_dump() if hasattr(update_data["billing_address"], 'model_dump') else update_data["billing_address"]
        
        for field, value in update_data.items():
            setattr(order, field, value)
        
        # Recalculate totals
        self._calculate_order_totals(order)
        
        self.db.commit()
        self.db.refresh(order)
        return order

    def update_order_status(self, order: Order, status: OrderStatus) -> Order:
        """Update order status."""
        order.status = status
        
        # Set relevant dates
        if status == OrderStatus.SHIPPED:
            order.shipped_date = utc_now()
        elif status == OrderStatus.DELIVERED:
            order.delivered_date = utc_now()
        
        self.db.commit()
        self.db.refresh(order)
        return order

    def record_payment(
        self,
        order: Order,
        amount: Decimal,
        payment_method: str,
    ) -> Order:
        """Record a payment for an order."""
        order.amount_paid += amount
        order.payment_method = payment_method
        
        # Update payment status
        if order.amount_paid >= order.total:
            order.payment_status = PaymentStatus.PAID
        elif order.amount_paid > 0:
            order.payment_status = PaymentStatus.PARTIAL
        
        self.db.commit()
        self.db.refresh(order)
        return order

    def delete_order(self, order: Order) -> None:
        """Soft delete an order."""
        order.soft_delete()
        self.db.commit()

    def get_order_items(self, order_id: str) -> List[OrderItem]:
        """Get items for an order."""
        return self.db.query(OrderItem).filter(
            OrderItem.order_id == order_id,
            OrderItem.deleted_at.is_(None),
        ).all()

    def add_order_item(self, order: Order, data: OrderItemCreate) -> OrderItem:
        """Add an item to an order."""
        item = self._create_order_item(order.id, data)
        self.db.add(item)
        
        # Recalculate order totals
        self.db.flush()
        self._calculate_order_totals(order)
        
        self.db.commit()
        self.db.refresh(item)
        return item

    def remove_order_item(self, order: Order, item_id: str) -> None:
        """Remove an item from an order."""
        item = self.db.query(OrderItem).filter(
            OrderItem.id == item_id,
            OrderItem.order_id == order.id,
        ).first()
        
        if item:
            item.soft_delete()
            self._calculate_order_totals(order)
            self.db.commit()

    def get_order_stats(self, business_id: str) -> dict:
        """Get order statistics."""
        orders = self.db.query(Order).filter(
            Order.business_id == business_id,
            Order.deleted_at.is_(None),
        )
        
        total_orders = orders.count()
        total_revenue = self.db.query(func.sum(Order.total)).filter(
            Order.business_id == business_id,
            Order.deleted_at.is_(None),
            Order.payment_status == PaymentStatus.PAID,
        ).scalar() or 0
        
        pending_orders = orders.filter(Order.status == OrderStatus.PENDING).count()
        completed_orders = orders.filter(Order.status == OrderStatus.DELIVERED).count()
        
        avg_order_value = total_revenue / total_orders if total_orders > 0 else 0
        
        return {
            "total_orders": total_orders,
            "total_revenue": Decimal(str(total_revenue)),
            "average_order_value": Decimal(str(avg_order_value)),
            "pending_orders": pending_orders,
            "completed_orders": completed_orders,
        }
