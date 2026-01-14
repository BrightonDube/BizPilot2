"""Production service for manufacturing management."""

from typing import List, Optional, Tuple
from decimal import Decimal
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.production import ProductionOrder, ProductionOrderItem, ProductionStatus
from app.models.product import Product
from app.models.inventory import InventoryItem, InventoryTransaction, TransactionType
from app.schemas.production import (
    ProductionOrderCreate,
    ProductionOrderUpdate,
    ProductionOrderItemCreate,
    IngredientSuggestion,
)


class ProductionService:
    """Service for production operations."""

    def __init__(self, db: Session):
        self.db = db

    def _generate_order_number(self, business_id: str) -> str:
        """Generate a unique production order number."""
        count = self.db.query(ProductionOrder).filter(
            ProductionOrder.business_id == business_id
        ).count()
        return f"PRD-{count + 1:05d}"

    def get_production_order(self, order_id: str, business_id: str) -> Optional[ProductionOrder]:
        """Get a production order by ID."""
        return self.db.query(ProductionOrder).filter(
            ProductionOrder.id == order_id,
            ProductionOrder.business_id == business_id,
            ProductionOrder.deleted_at.is_(None),
        ).first()

    def get_production_orders(
        self,
        business_id: str,
        page: int = 1,
        per_page: int = 20,
        status: Optional[ProductionStatus] = None,
        product_id: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[ProductionOrder], int]:
        """Get production orders with filtering and pagination."""
        query = self.db.query(ProductionOrder).filter(
            ProductionOrder.business_id == business_id,
            ProductionOrder.deleted_at.is_(None),
        )

        if status:
            query = query.filter(ProductionOrder.status == status)

        if product_id:
            query = query.filter(ProductionOrder.product_id == product_id)

        if search:
            query = query.filter(
                or_(
                    ProductionOrder.order_number.ilike(f"%{search}%"),
                    ProductionOrder.notes.ilike(f"%{search}%"),
                )
            )

        total = query.count()
        query = query.order_by(ProductionOrder.created_at.desc())
        offset = (page - 1) * per_page
        orders = query.offset(offset).limit(per_page).all()

        return orders, total

    def create_production_order(
        self,
        business_id: str,
        data: ProductionOrderCreate,
        user_id: Optional[str] = None,
    ) -> ProductionOrder:
        """Create a new production order."""
        # Get the product to manufacture
        product = self.db.query(Product).filter(
            Product.id == data.product_id,
            Product.business_id == business_id,
            Product.deleted_at.is_(None),
        ).first()

        if not product:
            raise ValueError("Product not found")

        # Calculate estimated cost from product ingredients
        estimated_cost = Decimal("0")
        if product.ingredients:
            for ing in product.ingredients:
                if ing.deleted_at is None:
                    estimated_cost += (ing.cost or Decimal("0")) * (ing.quantity or Decimal("0"))
            estimated_cost *= data.quantity_to_produce

        order = ProductionOrder(
            business_id=business_id,
            product_id=data.product_id,
            order_number=self._generate_order_number(business_id),
            quantity_to_produce=data.quantity_to_produce,
            scheduled_date=data.scheduled_date,
            notes=data.notes,
            estimated_cost=estimated_cost,
            created_by_id=user_id,
            status=ProductionStatus.DRAFT,
        )
        self.db.add(order)
        self.db.flush()

        # Create order items from product ingredients
        if data.items:
            for item_data in data.items:
                self._add_order_item(order, business_id, item_data, data.quantity_to_produce)
        elif product.ingredients:
            for ing in product.ingredients:
                if ing.deleted_at is None:
                    item = ProductionOrderItem(
                        business_id=business_id,
                        production_order_id=order.id,
                        source_product_id=ing.source_product_id,
                        name=ing.name,
                        unit=ing.unit,
                        quantity_required=(ing.quantity or Decimal("0")) * data.quantity_to_produce,
                        unit_cost=ing.cost or Decimal("0"),
                    )
                    self.db.add(item)

        self.db.commit()
        self.db.refresh(order)
        return order

    def _add_order_item(
        self,
        order: ProductionOrder,
        business_id: str,
        data: ProductionOrderItemCreate,
        quantity_multiplier: int,
    ) -> ProductionOrderItem:
        """Add an item to a production order."""
        item = ProductionOrderItem(
            business_id=business_id,
            production_order_id=order.id,
            source_product_id=data.source_product_id,
            name=data.name,
            unit=data.unit,
            quantity_required=data.quantity_required * quantity_multiplier,
            unit_cost=data.unit_cost,
        )
        self.db.add(item)
        return item

    def update_production_order(
        self,
        order: ProductionOrder,
        data: ProductionOrderUpdate,
    ) -> ProductionOrder:
        """Update a production order."""
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(order, field, value)
        self.db.commit()
        self.db.refresh(order)
        return order

    def start_production(self, order: ProductionOrder) -> ProductionOrder:
        """Start a production order."""
        if order.status not in [ProductionStatus.DRAFT, ProductionStatus.PENDING]:
            raise ValueError("Cannot start production - invalid status")

        order.status = ProductionStatus.IN_PROGRESS
        order.started_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(order)
        return order

    def complete_production(
        self,
        order: ProductionOrder,
        quantity_produced: int,
        actual_cost: Optional[Decimal] = None,
    ) -> ProductionOrder:
        """Complete a production order and update inventory."""
        if order.status != ProductionStatus.IN_PROGRESS:
            raise ValueError("Cannot complete production - must be in progress")

        order.status = ProductionStatus.COMPLETED
        order.quantity_produced = quantity_produced
        order.completed_at = datetime.utcnow()
        if actual_cost is not None:
            order.actual_cost = actual_cost
        else:
            # Calculate actual cost from items
            order.actual_cost = sum(
                (item.quantity_used or item.quantity_required) * item.unit_cost
                for item in order.items
            )

        # Deduct ingredients from inventory
        for item in order.items:
            if item.source_product_id:
                self._deduct_inventory(
                    business_id=str(order.business_id),
                    product_id=str(item.source_product_id),
                    quantity=int(item.quantity_required),
                    reference_id=str(order.id),
                    notes=f"Used in production order {order.order_number}",
                )
                item.quantity_used = item.quantity_required

        # Add manufactured product to inventory
        self._add_to_inventory(
            business_id=str(order.business_id),
            product_id=str(order.product_id),
            quantity=quantity_produced,
            reference_id=str(order.id),
            notes=f"Produced from production order {order.order_number}",
        )

        self.db.commit()
        self.db.refresh(order)
        return order

    def _deduct_inventory(
        self,
        business_id: str,
        product_id: str,
        quantity: int,
        reference_id: str,
        notes: str,
    ) -> None:
        """Deduct quantity from inventory."""
        inventory = self.db.query(InventoryItem).filter(
            InventoryItem.product_id == product_id,
            InventoryItem.business_id == business_id,
            InventoryItem.deleted_at.is_(None),
        ).first()

        if inventory:
            quantity_before = inventory.quantity_on_hand
            inventory.quantity_on_hand = max(0, inventory.quantity_on_hand - quantity)

            # Create transaction record
            transaction = InventoryTransaction(
                business_id=business_id,
                product_id=product_id,
                inventory_item_id=inventory.id,
                transaction_type=TransactionType.PRODUCTION,
                quantity_change=-quantity,
                quantity_before=quantity_before,
                quantity_after=inventory.quantity_on_hand,
                reference_type="production_order",
                reference_id=reference_id,
                notes=notes,
            )
            self.db.add(transaction)

        # Also update product quantity
        product = self.db.query(Product).filter(
            Product.id == product_id,
            Product.deleted_at.is_(None),
        ).first()
        if product:
            product.quantity = max(0, (product.quantity or 0) - quantity)

    def _add_to_inventory(
        self,
        business_id: str,
        product_id: str,
        quantity: int,
        reference_id: str,
        notes: str,
    ) -> None:
        """Add quantity to inventory."""
        inventory = self.db.query(InventoryItem).filter(
            InventoryItem.product_id == product_id,
            InventoryItem.business_id == business_id,
            InventoryItem.deleted_at.is_(None),
        ).first()

        if inventory:
            quantity_before = inventory.quantity_on_hand
            inventory.quantity_on_hand += quantity

            # Create transaction record
            transaction = InventoryTransaction(
                business_id=business_id,
                product_id=product_id,
                inventory_item_id=inventory.id,
                transaction_type=TransactionType.PRODUCTION,
                quantity_change=quantity,
                quantity_before=quantity_before,
                quantity_after=inventory.quantity_on_hand,
                reference_type="production_order",
                reference_id=reference_id,
                notes=notes,
            )
            self.db.add(transaction)

        # Also update product quantity
        product = self.db.query(Product).filter(
            Product.id == product_id,
            Product.deleted_at.is_(None),
        ).first()
        if product:
            product.quantity = (product.quantity or 0) + quantity

    def cancel_production(self, order: ProductionOrder) -> ProductionOrder:
        """Cancel a production order."""
        if order.status == ProductionStatus.COMPLETED:
            raise ValueError("Cannot cancel completed production")

        order.status = ProductionStatus.CANCELLED
        self.db.commit()
        self.db.refresh(order)
        return order

    def delete_production_order(self, order: ProductionOrder) -> bool:
        """Soft delete a production order."""
        if order.status == ProductionStatus.COMPLETED:
            raise ValueError("Cannot delete completed production order")

        order.soft_delete()
        self.db.commit()
        return True

    def get_ingredient_suggestions(
        self,
        business_id: str,
        query: str = "",
        product_context: Optional[str] = None,
        limit: int = 10,
    ) -> List[IngredientSuggestion]:
        """Get AI-powered ingredient suggestions based on search query and context."""
        # Query products that could be ingredients (raw materials)
        products_query = self.db.query(Product).filter(
            Product.business_id == business_id,
            Product.deleted_at.is_(None),
            Product.status == "active",
        )

        if query:
            products_query = products_query.filter(
                or_(
                    Product.name.ilike(f"%{query}%"),
                    Product.sku.ilike(f"%{query}%"),
                    Product.description.ilike(f"%{query}%"),
                )
            )

        products = products_query.limit(limit * 2).all()

        # Build suggestions with relevance scoring
        suggestions = []
        for product in products:
            # Calculate relevance score
            score = 0.5  # Base score

            # Boost if name starts with query
            if query and product.name.lower().startswith(query.lower()):
                score += 0.3

            # Boost if exact match
            if query and product.name.lower() == query.lower():
                score += 0.2

            # Get inventory info
            inventory = self.db.query(InventoryItem).filter(
                InventoryItem.product_id == product.id,
                InventoryItem.business_id == business_id,
                InventoryItem.deleted_at.is_(None),
            ).first()

            suggestions.append(IngredientSuggestion(
                id=str(product.id),
                name=product.name,
                sku=product.sku,
                unit="unit",
                cost_price=product.cost_price,
                quantity_on_hand=inventory.quantity_on_hand if inventory else 0,
                relevance_score=score,
            ))

        # Sort by relevance and return top results
        suggestions.sort(key=lambda x: x.relevance_score, reverse=True)
        return suggestions[:limit]
