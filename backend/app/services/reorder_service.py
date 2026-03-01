"""Reorder service for automated stock replenishment."""

import uuid
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.base import utc_now
from app.models.inventory import InventoryItem, InventoryTransaction, TransactionType
from app.models.product import Product
from app.models.reorder import (
    PurchaseOrderStatus,
    PurchaseRequest,
    PurchaseRequestItem,
    ReorderRule,
    ReorderRuleStatus,
)


class ReorderService:
    """Service for automated reorder operations."""

    def __init__(self, db: Session):
        self.db = db

    # --- Reorder Rule CRUD ---

    def create_rule(
        self,
        business_id: str,
        product_id: str,
        min_stock: int,
        reorder_qty: int,
        supplier_id: Optional[str] = None,
        max_stock: Optional[int] = None,
        lead_time: int = 7,
        auto_approve: bool = False,
    ) -> ReorderRule:
        """Create a reorder rule for a product."""
        rule = ReorderRule(
            business_id=business_id,
            product_id=product_id,
            supplier_id=supplier_id,
            min_stock_level=min_stock,
            reorder_quantity=reorder_qty,
            max_stock_level=max_stock,
            lead_time_days=lead_time,
            auto_approve=auto_approve,
            status=ReorderRuleStatus.ACTIVE,
        )
        self.db.add(rule)
        self.db.commit()
        self.db.refresh(rule)
        return rule

    def list_rules(
        self,
        business_id: str,
        status: Optional[ReorderRuleStatus] = None,
    ) -> List[ReorderRule]:
        """List reorder rules for a business."""
        query = self.db.query(ReorderRule).filter(
            ReorderRule.business_id == business_id,
            ReorderRule.deleted_at.is_(None),
        )
        if status:
            query = query.filter(ReorderRule.status == status)
        return query.order_by(ReorderRule.created_at.desc()).all()

    def update_rule(
        self,
        rule_id: str,
        business_id: str,
        **kwargs,
    ) -> Optional[ReorderRule]:
        """Update a reorder rule."""
        rule = self.db.query(ReorderRule).filter(
            ReorderRule.id == rule_id,
            ReorderRule.business_id == business_id,
            ReorderRule.deleted_at.is_(None),
        ).first()
        if not rule:
            return None
        for key, value in kwargs.items():
            if hasattr(rule, key) and value is not None:
                setattr(rule, key, value)
        self.db.commit()
        self.db.refresh(rule)
        return rule

    def toggle_rule(self, rule_id: str, business_id: str) -> Optional[ReorderRule]:
        """Toggle a reorder rule between active and paused."""
        rule = self.db.query(ReorderRule).filter(
            ReorderRule.id == rule_id,
            ReorderRule.business_id == business_id,
            ReorderRule.deleted_at.is_(None),
        ).first()
        if not rule:
            return None
        if rule.status == ReorderRuleStatus.ACTIVE:
            rule.status = ReorderRuleStatus.PAUSED
        elif rule.status == ReorderRuleStatus.PAUSED:
            rule.status = ReorderRuleStatus.ACTIVE
        self.db.commit()
        self.db.refresh(rule)
        return rule

    # --- Stock Checking ---

    def check_stock_levels(self, business_id: str) -> List[Dict]:
        """Check all products against their reorder rules, return items below min_stock."""
        rules = self.db.query(ReorderRule).filter(
            ReorderRule.business_id == business_id,
            ReorderRule.status == ReorderRuleStatus.ACTIVE,
            ReorderRule.deleted_at.is_(None),
        ).all()

        low_stock_items = []
        for rule in rules:
            product = self.db.query(Product).filter(
                Product.id == rule.product_id,
                Product.deleted_at.is_(None),
            ).first()
            if not product:
                continue

            current_stock = product.quantity or 0
            if current_stock <= rule.min_stock_level:
                # Try to find cost from supplier or product
                unit_cost = product.cost_price or Decimal("0")

                supplier_name = None
                if rule.supplier and rule.supplier.deleted_at is None:
                    supplier_name = rule.supplier.name

                low_stock_items.append({
                    "product_id": str(product.id),
                    "product_name": product.name,
                    "current_stock": current_stock,
                    "min_stock_level": rule.min_stock_level,
                    "reorder_quantity": rule.reorder_quantity,
                    "supplier_id": str(rule.supplier_id) if rule.supplier_id else None,
                    "supplier_name": supplier_name,
                    "unit_cost": unit_cost,
                    "rule_id": str(rule.id),
                })

        return low_stock_items

    # --- Purchase Request Generation ---

    def _generate_reference(self) -> str:
        """Generate a unique purchase request reference."""
        return f"PR-{uuid.uuid4().hex[:8].upper()}"

    def generate_purchase_request(
        self,
        business_id: str,
        items: List[Dict],
        supplier_id: Optional[str] = None,
        user_id: Optional[str] = None,
        is_auto: bool = False,
    ) -> PurchaseRequest:
        """Create a purchase request from a list of items."""
        total_amount = Decimal("0")
        pr = PurchaseRequest(
            business_id=business_id,
            reference=self._generate_reference(),
            supplier_id=supplier_id,
            status=PurchaseOrderStatus.DRAFT,
            total_amount=total_amount,
            requested_by_id=user_id,
            is_auto_generated=is_auto,
        )
        self.db.add(pr)
        self.db.flush()

        for item_data in items:
            qty = item_data["quantity"]
            unit_cost = Decimal(str(item_data["unit_cost"]))
            line_total = unit_cost * qty
            total_amount += line_total

            pr_item = PurchaseRequestItem(
                request_id=pr.id,
                product_id=item_data["product_id"],
                quantity=qty,
                unit_cost=unit_cost,
                total=line_total,
            )
            self.db.add(pr_item)

        pr.total_amount = total_amount
        self.db.commit()
        self.db.refresh(pr)
        return pr

    # --- Auto Reorder ---

    def auto_reorder(self, business_id: str) -> List[PurchaseRequest]:
        """Run stock check and auto-generate purchase requests for auto_approve rules."""
        rules = self.db.query(ReorderRule).filter(
            ReorderRule.business_id == business_id,
            ReorderRule.status == ReorderRuleStatus.ACTIVE,
            ReorderRule.auto_approve.is_(True),
            ReorderRule.deleted_at.is_(None),
        ).all()

        # Group items by supplier
        supplier_items: Dict[Optional[str], List[Dict]] = {}
        for rule in rules:
            product = self.db.query(Product).filter(
                Product.id == rule.product_id,
                Product.deleted_at.is_(None),
            ).first()
            if not product:
                continue

            current_stock = product.quantity or 0
            if current_stock > rule.min_stock_level:
                continue

            unit_cost = product.cost_price or Decimal("0")
            supplier_key = str(rule.supplier_id) if rule.supplier_id else None

            if supplier_key not in supplier_items:
                supplier_items[supplier_key] = []

            supplier_items[supplier_key].append({
                "product_id": str(product.id),
                "quantity": rule.reorder_quantity,
                "unit_cost": unit_cost,
            })

            rule.last_triggered_at = utc_now()

        created_requests = []
        for supplier_key, items in supplier_items.items():
            if not items:
                continue
            pr = self.generate_purchase_request(
                business_id=business_id,
                items=items,
                supplier_id=supplier_key,
                is_auto=True,
            )
            created_requests.append(pr)

        if created_requests:
            self.db.commit()

        return created_requests

    # --- Purchase Request CRUD ---

    def get_request(self, request_id: str, business_id: str) -> Optional[PurchaseRequest]:
        """Get a purchase request by ID."""
        return self.db.query(PurchaseRequest).filter(
            PurchaseRequest.id == request_id,
            PurchaseRequest.business_id == business_id,
            PurchaseRequest.deleted_at.is_(None),
        ).first()

    def list_requests(
        self,
        business_id: str,
        status: Optional[PurchaseOrderStatus] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[PurchaseRequest], int]:
        """List purchase requests with pagination."""
        query = self.db.query(PurchaseRequest).filter(
            PurchaseRequest.business_id == business_id,
            PurchaseRequest.deleted_at.is_(None),
        )
        if status:
            query = query.filter(PurchaseRequest.status == status)

        total = query.count()
        offset = (page - 1) * per_page
        items = query.order_by(PurchaseRequest.created_at.desc()).offset(offset).limit(per_page).all()
        return items, total

    def approve_request(
        self,
        request_id: str,
        business_id: str,
        user_id: str,
    ) -> Optional[PurchaseRequest]:
        """Approve a purchase request."""
        pr = self.get_request(request_id, business_id)
        if not pr:
            return None
        pr.status = PurchaseOrderStatus.APPROVED
        pr.approved_by_id = user_id
        pr.approved_at = utc_now()
        self.db.commit()
        self.db.refresh(pr)
        return pr

    def receive_items(
        self,
        request_id: str,
        business_id: str,
        items: List[Dict],
    ) -> Optional[PurchaseRequest]:
        """Receive items on a purchase request and update inventory."""
        pr = self.get_request(request_id, business_id)
        if not pr:
            return None

        all_received = True
        for receive_data in items:
            pr_item = self.db.query(PurchaseRequestItem).filter(
                PurchaseRequestItem.id == receive_data["item_id"],
                PurchaseRequestItem.request_id == pr.id,
            ).first()
            if not pr_item:
                continue

            qty_received = receive_data["quantity_received"]
            pr_item.received_quantity = (pr_item.received_quantity or 0) + qty_received

            # Update product stock
            product = self.db.query(Product).filter(Product.id == pr_item.product_id).first()
            if product:
                old_qty = product.quantity or 0
                product.quantity = old_qty + qty_received

                # Create inventory transaction
                tx = InventoryTransaction(
                    business_id=business_id,
                    product_id=product.id,
                    transaction_type=TransactionType.PURCHASE,
                    quantity_change=qty_received,
                    quantity_before=old_qty,
                    quantity_after=product.quantity,
                    unit_cost=pr_item.unit_cost,
                    total_cost=pr_item.unit_cost * qty_received,
                    reference_type="purchase_request",
                    reference_id=pr.id,
                )
                self.db.add(tx)

                # Update inventory item if exists
                inv_item = self.db.query(InventoryItem).filter(
                    InventoryItem.product_id == product.id,
                    InventoryItem.business_id == business_id,
                ).first()
                if inv_item:
                    inv_item.quantity_on_hand = (inv_item.quantity_on_hand or 0) + qty_received
                    inv_item.last_received_at = utc_now()
                    inv_item.last_cost = pr_item.unit_cost

            if pr_item.received_quantity < pr_item.quantity:
                all_received = False

        # Check all items to determine status
        if all_received:
            remaining = self.db.query(PurchaseRequestItem).filter(
                PurchaseRequestItem.request_id == pr.id,
                PurchaseRequestItem.received_quantity < PurchaseRequestItem.quantity,
            ).count()
            if remaining == 0:
                pr.status = PurchaseOrderStatus.RECEIVED
            else:
                pr.status = PurchaseOrderStatus.PARTIALLY_RECEIVED
        else:
            pr.status = PurchaseOrderStatus.PARTIALLY_RECEIVED

        self.db.commit()
        self.db.refresh(pr)
        return pr

    # --- Suggestions ---

    def get_reorder_suggestions(self, business_id: str) -> List[Dict]:
        """Products that need reordering but don't have rules."""
        # Get product IDs that already have rules
        rule_product_ids = [
            r[0] for r in self.db.query(ReorderRule.product_id).filter(
                ReorderRule.business_id == business_id,
                ReorderRule.deleted_at.is_(None),
            ).all()
        ]

        # Find low-stock products without rules
        query = self.db.query(Product).filter(
            Product.business_id == business_id,
            Product.deleted_at.is_(None),
            Product.track_inventory.is_(True),
            Product.quantity <= Product.low_stock_threshold,
        )
        if rule_product_ids:
            query = query.filter(Product.id.notin_(rule_product_ids))

        products = query.all()
        suggestions = []
        for p in products:
            suggestions.append({
                "product_id": str(p.id),
                "product_name": p.name,
                "current_stock": p.quantity or 0,
                "low_stock_threshold": p.low_stock_threshold or 10,
                "suggested_reorder_qty": max((p.low_stock_threshold or 10) * 2, 10),
            })
        return suggestions
