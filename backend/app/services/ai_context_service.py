"""Extracted AI context building methods for use by the agent system."""

from typing import Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.business import Business
from app.models.business_user import BusinessUser, BusinessUserStatus
from app.models.customer import Customer
from app.models.invoice import Invoice, InvoiceStatus
from app.models.inventory import InventoryItem
from app.models.order import Order, OrderDirection, PaymentStatus as OrderPaymentStatus
from app.models.product import Product
from app.models.supplier import Supplier
from app.models.user import User
from app.models.user_settings import AIDataSharingLevel
from app.services.app_help_kb import AppHelpKnowledgeBase
from app.core.config import settings


class AIContextService:
    """Service for building AI context without the chat functionality."""
    
    def __init__(self, db: Session):
        self.db = db

    def _get_business_for_user(self, user_id: str) -> Optional[Business]:
        """Get the business associated with a user."""
        business_user = (
            self.db.query(BusinessUser)
            .filter(BusinessUser.user_id == user_id, BusinessUser.status == BusinessUserStatus.ACTIVE)
            .first()
        )
        if not business_user:
            return None
        return self.db.query(Business).filter(Business.id == business_user.business_id).first()

    def build_business_context(self, user: User, level: AIDataSharingLevel) -> dict[str, Any]:
        """Build business context based on data sharing level."""
        business = self._get_business_for_user(user.id)
        if not business:
            return {
                "businessName": "",
                "currency": "",
                "totalProducts": 0,
                "totalInventoryItems": 0,
                "totalCustomers": 0,
                "totalSuppliers": 0,
                "totalOrders": 0,
                "totalInvoices": 0,
                "totalPayments": 0,
                "lowStockItems": 0,
                "avgMargin": 0,
                "totalRevenue": 0,
                "paidRevenue": 0,
                "outstandingInvoiceAmount": 0,
                "outstandingInvoiceCount": 0,
                "totalPurchaseOrders": 0,
                "totalPurchaseInvoices": 0,
                "totalPurchasePayments": 0,
                "totalPurchaseAmount": 0,
                "totalPurchaseCount": 0,
            }

        if level in (AIDataSharingLevel.NONE, AIDataSharingLevel.APP_ONLY):
            return {
                "businessName": business.name,
                "currency": business.currency,
                "totalProducts": 0,
                "totalInventoryItems": 0,
                "totalCustomers": 0,
                "totalSuppliers": 0,
                "totalOrders": 0,
                "totalInvoices": 0,
                "totalPayments": 0,
                "lowStockItems": 0,
                "avgMargin": 0,
                "totalRevenue": 0,
                "paidRevenue": 0,
                "outstandingInvoiceAmount": 0,
                "outstandingInvoiceCount": 0,
                "totalPurchaseOrders": 0,
                "totalPurchaseInvoices": 0,
                "totalPurchasePayments": 0,
                "totalPurchaseAmount": 0,
                "totalPurchaseCount": 0,
            }

        total_products = (
            self.db.query(func.count(Product.id))
            .filter(Product.business_id == business.id, Product.deleted_at.is_(None))
            .scalar()
            or 0
        )

        total_customers = (
            self.db.query(func.count(Customer.id))
            .filter(Customer.business_id == business.id, Customer.deleted_at.is_(None))
            .scalar()
            or 0
        )

        total_suppliers = (
            self.db.query(func.count(Supplier.id))
            .filter(Supplier.business_id == business.id, Supplier.deleted_at.is_(None))
            .scalar()
            or 0
        )

        total_orders = (
            self.db.query(func.count(Order.id))
            .filter(Order.business_id == business.id, Order.deleted_at.is_(None))
            .scalar()
            or 0
        )

        total_invoices = (
            self.db.query(func.count(Invoice.id))
            .filter(Invoice.business_id == business.id, Invoice.deleted_at.is_(None))
            .scalar()
            or 0
        )

        # Count paid/partial invoices as "payments"
        total_payments = (
            self.db.query(func.count(Invoice.id))
            .filter(
                Invoice.business_id == business.id,
                Invoice.deleted_at.is_(None),
                Invoice.status.in_([InvoiceStatus.PAID, InvoiceStatus.PARTIAL]),
            )
            .scalar()
            or 0
        )

        total_revenue = (
            self.db.query(func.coalesce(func.sum(Order.total), 0))
            .filter(Order.business_id == business.id, Order.deleted_at.is_(None))
            .scalar()
            or 0
        )

        paid_revenue = (
            self.db.query(func.coalesce(func.sum(Order.total), 0))
            .filter(
                Order.business_id == business.id,
                Order.deleted_at.is_(None),
                Order.payment_status == OrderPaymentStatus.PAID,
            )
            .scalar()
            or 0
        )

        outstanding_invoice_amount = (
            self.db.query(func.coalesce(func.sum(Invoice.total - Invoice.amount_paid), 0))
            .filter(
                Invoice.business_id == business.id,
                Invoice.deleted_at.is_(None),
                Invoice.status.in_(
                    [
                        InvoiceStatus.DRAFT,
                        InvoiceStatus.SENT,
                        InvoiceStatus.VIEWED,
                        InvoiceStatus.PARTIAL,
                        InvoiceStatus.OVERDUE,
                    ]
                ),
            )
            .scalar()
            or 0
        )

        outstanding_invoice_count = (
            self.db.query(func.count(Invoice.id))
            .filter(
                Invoice.business_id == business.id,
                Invoice.deleted_at.is_(None),
                Invoice.status.in_(
                    [
                        InvoiceStatus.DRAFT,
                        InvoiceStatus.SENT,
                        InvoiceStatus.VIEWED,
                        InvoiceStatus.PARTIAL,
                        InvoiceStatus.OVERDUE,
                    ]
                ),
            )
            .scalar()
            or 0
        )
        total_inventory_items = (
            self.db.query(func.count(InventoryItem.id))
            .filter(InventoryItem.business_id == business.id, InventoryItem.deleted_at.is_(None))
            .scalar()
            or 0
        )
        low_stock_items = (
            self.db.query(func.count(InventoryItem.id))
            .filter(
                InventoryItem.business_id == business.id,
                InventoryItem.deleted_at.is_(None),
                InventoryItem.quantity_on_hand <= InventoryItem.reorder_point,
            )
            .scalar()
            or 0
        )

        products = (
            self.db.query(Product)
            .filter(Product.business_id == business.id, Product.deleted_at.is_(None))
            .all()
        )
        margins = [p.profit_margin for p in products] if products else []
        avg_margin = (sum(margins) / len(margins)) if margins else 0

        total_purchase_orders = (
            self.db.query(func.count(Order.id))
            .filter(
                Order.business_id == business.id,
                Order.deleted_at.is_(None),
                Order.direction == OrderDirection.OUTBOUND,
            )
            .scalar()
            or 0
        )

        total_purchase_invoices = (
            self.db.query(func.count(Invoice.id))
            .join(Order, Invoice.order_id == Order.id)
            .filter(
                Invoice.business_id == business.id,
                Invoice.deleted_at.is_(None),
                Order.direction == OrderDirection.OUTBOUND,
            )
            .scalar()
            or 0
        )

        # Count paid/partial purchase invoices as "payments"
        total_purchase_payments = (
            self.db.query(func.count(Invoice.id))
            .join(Order, Invoice.order_id == Order.id)
            .filter(
                Invoice.business_id == business.id,
                Invoice.deleted_at.is_(None),
                Order.direction == OrderDirection.OUTBOUND,
                Invoice.status.in_([InvoiceStatus.PAID, InvoiceStatus.PARTIAL]),
            )
            .scalar()
            or 0
        )

        total_purchase_amount = (
            self.db.query(func.coalesce(func.sum(Order.total), 0))
            .filter(
                Order.business_id == business.id,
                Order.deleted_at.is_(None),
                Order.direction == OrderDirection.OUTBOUND,
            )
            .scalar()
            or 0
        )

        total_purchase_count = int(total_purchase_orders)

        context: dict[str, Any] = {
            "businessName": business.name,
            "currency": business.currency,
            "totalProducts": int(total_products),
            "totalInventoryItems": int(total_inventory_items),
            "totalCustomers": int(total_customers),
            "totalSuppliers": int(total_suppliers),
            "totalOrders": int(total_orders),
            "totalInvoices": int(total_invoices),
            "totalPayments": int(total_payments),
            "lowStockItems": int(low_stock_items),
            "avgMargin": float(avg_margin),
            "totalRevenue": float(total_revenue),
            "paidRevenue": float(paid_revenue),
            "outstandingInvoiceAmount": float(outstanding_invoice_amount),
            "outstandingInvoiceCount": int(outstanding_invoice_count),
            "totalPurchaseOrders": int(total_purchase_orders),
            "totalPurchaseInvoices": int(total_purchase_invoices),
            "totalPurchasePayments": int(total_purchase_payments),
            "totalPurchaseAmount": float(total_purchase_amount),
            "totalPurchaseCount": int(total_purchase_count),
        }

        if level == AIDataSharingLevel.METRICS_ONLY:
            return context

        top_products = sorted(products, key=lambda p: p.profit_margin, reverse=True)[:10]
        context["topProductsByMargin"] = [
            {
                "name": p.name,
                "sku": p.sku,
                "selling_price": float(p.selling_price),
                "effective_cost": float(p.effective_cost or 0),
                "profit_margin": float(p.profit_margin),
                "is_low_stock": bool(p.is_low_stock),
            }
            for p in top_products
        ]

        low_stock_inventory = (
            self.db.query(InventoryItem)
            .filter(
                InventoryItem.business_id == business.id,
                InventoryItem.deleted_at.is_(None),
                InventoryItem.quantity_on_hand <= InventoryItem.reorder_point,
            )
            .order_by(InventoryItem.quantity_on_hand.asc())
            .limit(20)
            .all()
        )
        context["lowStockInventory"] = [
            {
                "product_id": str(i.product_id),
                "quantity_on_hand": int(i.quantity_on_hand),
                "reorder_point": int(i.reorder_point),
                "location": i.location,
            }
            for i in low_stock_inventory
        ]

        # Include customer insights only when allowed
        if level == AIDataSharingLevel.FULL_BUSINESS_WITH_CUSTOMERS:
            top_customers = (
                self.db.query(Customer)
                .filter(Customer.business_id == business.id, Customer.deleted_at.is_(None))
                .order_by(Customer.total_spent.desc())
                .limit(10)
                .all()
            )
            context["topCustomers"] = [
                {
                    "id": str(c.id),
                    "name": c.display_name,
                    "email": c.email,
                    "phone": c.phone,
                    "total_spent": float(c.total_spent or 0),
                    "total_orders": int(c.total_orders or 0),
                    "average_order_value": float(c.average_order_value or 0),
                    "type": c.customer_type.value if c.customer_type else None,
                }
                for c in top_customers
            ]

        return context

    def build_app_help_context(self) -> dict[str, Any]:
        """Build app help context."""
        kb = AppHelpKnowledgeBase()
        kb_ctx = kb.to_context()

        # Keep stable keys for the client/LLM and extend with KB info
        return {
            "appName": settings.APP_NAME,
            "routes": kb_ctx.get("routes", {}),
            "howTo": kb_ctx.get("howTo", {}),
        }
