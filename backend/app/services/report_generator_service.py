"""Service for generating automated report data."""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.models.business_user import BusinessUser, BusinessUserStatus
from app.models.business import Business
from app.models.order import Order, OrderDirection, OrderItem
from app.models.customer import Customer
from app.models.inventory import InventoryItem
from app.models.invoice import Invoice, InvoiceStatus
from app.models.report_subscription import ReportType

logger = logging.getLogger(__name__)


@dataclass
class ReportData:
    """Data container for generated reports."""
    report_type: ReportType
    period_start: datetime
    period_end: datetime
    business_name: str
    business_id: str
    user_email: str
    metrics: Dict[str, Any] = field(default_factory=dict)


class ReportGeneratorService:
    """Service for generating report data and metrics."""

    def __init__(self, db: Session):
        self.db = db

    def get_user_businesses(self, user_id: UUID) -> List[Business]:
        """Get all businesses associated with a user."""
        business_users = self.db.query(BusinessUser).filter(
            and_(
                BusinessUser.user_id == user_id,
                BusinessUser.status == BusinessUserStatus.ACTIVE,
                BusinessUser.deleted_at.is_(None),
            )
        ).all()
        
        business_ids = [bu.business_id for bu in business_users]
        
        if not business_ids:
            return []
            
        return self.db.query(Business).filter(
            and_(
                Business.id.in_(business_ids),
                Business.deleted_at.is_(None),
            )
        ).all()

    def get_primary_business(self, user_id: UUID) -> Optional[Business]:
        """Get user's primary business, or first business if no primary set."""
        business_user = self.db.query(BusinessUser).filter(
            and_(
                BusinessUser.user_id == user_id,
                BusinessUser.status == BusinessUserStatus.ACTIVE,
                BusinessUser.is_primary,
                BusinessUser.deleted_at.is_(None),
            )
        ).first()
        
        if not business_user:
            business_user = self.db.query(BusinessUser).filter(
                and_(
                    BusinessUser.user_id == user_id,
                    BusinessUser.status == BusinessUserStatus.ACTIVE,
                    BusinessUser.deleted_at.is_(None),
                )
            ).first()
        
        if not business_user:
            return None
            
        return self.db.query(Business).filter(
            Business.id == business_user.business_id
        ).first()

    def calculate_weekly_period(self, execution_date: datetime) -> tuple[datetime, datetime]:
        """
        Calculate weekly reporting period.
        Returns previous Monday through Sunday.
        """
        days_since_monday = execution_date.weekday()
        previous_monday = execution_date - timedelta(days=days_since_monday + 7)
        previous_sunday = previous_monday + timedelta(days=6)
        
        period_start = previous_monday.replace(hour=0, minute=0, second=0, microsecond=0)
        period_end = previous_sunday.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        return period_start, period_end

    def calculate_monthly_period(self, execution_date: datetime) -> tuple[datetime, datetime]:
        """
        Calculate monthly reporting period.
        Returns first to last day of previous month.
        """
        first_of_current = execution_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_of_previous = first_of_current - timedelta(days=1)
        first_of_previous = last_of_previous.replace(day=1)
        
        period_start = first_of_previous
        period_end = last_of_previous.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        return period_start, period_end

    def generate_sales_summary(
        self,
        user_id: UUID,
        user_email: str,
        business: Business,
        period_start: datetime,
        period_end: datetime,
    ) -> ReportData:
        """
        Generate sales summary report.
        
        Includes: total_revenue, transaction_count, average_transaction_value, top_products
        """
        business_id = business.id
        
        orders = self.db.query(Order).filter(
            and_(
                Order.business_id == business_id,
                Order.direction == OrderDirection.OUTBOUND,
                Order.created_at >= period_start,
                Order.created_at <= period_end,
                Order.deleted_at.is_(None),
            )
        ).all()
        
        total_revenue = sum(float(o.total or 0) for o in orders)
        transaction_count = len(orders)
        average_transaction = total_revenue / transaction_count if transaction_count > 0 else 0
        
        top_products_query = (
            self.db.query(
                OrderItem.name,
                func.sum(OrderItem.quantity).label('quantity'),
                func.sum(OrderItem.total).label('revenue'),
            )
            .join(Order, Order.id == OrderItem.order_id)
            .filter(
                and_(
                    Order.business_id == business_id,
                    Order.direction == OrderDirection.OUTBOUND,
                    Order.created_at >= period_start,
                    Order.created_at <= period_end,
                    Order.deleted_at.is_(None),
                    OrderItem.deleted_at.is_(None),
                )
            )
            .group_by(OrderItem.name)
            .order_by(func.sum(OrderItem.total).desc())
            .limit(5)
            .all()
        )
        
        top_products = [
            {
                'name': p.name,
                'quantity': int(p.quantity or 0),
                'revenue': float(p.revenue or 0),
            }
            for p in top_products_query
        ]
        
        return ReportData(
            report_type=ReportType.SALES_SUMMARY,
            period_start=period_start,
            period_end=period_end,
            business_name=business.name,
            business_id=str(business_id),
            user_email=user_email,
            metrics={
                'total_revenue': round(total_revenue, 2),
                'transaction_count': transaction_count,
                'average_transaction_value': round(average_transaction, 2),
                'top_products': top_products,
                'currency': business.currency or 'ZAR',
            }
        )

    def generate_inventory_status(
        self,
        user_id: UUID,
        user_email: str,
        business: Business,
        period_start: datetime,
        period_end: datetime,
    ) -> ReportData:
        """
        Generate inventory status report.
        
        Includes: total_items, total_value, low_stock_items, out_of_stock_items
        """
        business_id = business.id
        
        inventory_items = self.db.query(InventoryItem).filter(
            and_(
                InventoryItem.business_id == business_id,
                InventoryItem.deleted_at.is_(None),
            )
        ).all()
        
        total_items = len(inventory_items)
        total_value = 0.0
        low_stock_items = []
        out_of_stock_items = []
        
        for item in inventory_items:
            quantity = float(item.quantity_on_hand or 0)
            unit_cost = float(item.unit_cost or 0)
            total_value += quantity * unit_cost
            reorder_point = float(item.reorder_point or 0)
            
            if quantity <= 0:
                out_of_stock_items.append({
                    'name': item.product_name or 'Unknown',
                    'sku': item.sku,
                })
            elif quantity <= reorder_point:
                low_stock_items.append({
                    'name': item.product_name or 'Unknown',
                    'sku': item.sku,
                    'quantity': quantity,
                    'reorder_point': reorder_point,
                })
        
        return ReportData(
            report_type=ReportType.INVENTORY_STATUS,
            period_start=period_start,
            period_end=period_end,
            business_name=business.name,
            business_id=str(business_id),
            user_email=user_email,
            metrics={
                'total_items': total_items,
                'total_value': round(total_value, 2),
                'low_stock_count': len(low_stock_items),
                'out_of_stock_count': len(out_of_stock_items),
                'low_stock_items': low_stock_items[:10],
                'out_of_stock_items': out_of_stock_items[:10],
                'currency': business.currency or 'ZAR',
            }
        )

    def generate_financial_overview(
        self,
        user_id: UUID,
        user_email: str,
        business: Business,
        period_start: datetime,
        period_end: datetime,
    ) -> ReportData:
        """
        Generate financial overview report.
        
        Includes: total_revenue, total_expenses, net_profit, outstanding_invoices
        """
        business_id = business.id
        
        sales_orders = self.db.query(Order).filter(
            and_(
                Order.business_id == business_id,
                Order.direction == OrderDirection.OUTBOUND,
                Order.created_at >= period_start,
                Order.created_at <= period_end,
                Order.deleted_at.is_(None),
            )
        ).all()
        total_revenue = sum(float(o.total or 0) for o in sales_orders)
        
        purchase_orders = self.db.query(Order).filter(
            and_(
                Order.business_id == business_id,
                Order.direction == OrderDirection.INBOUND,
                Order.created_at >= period_start,
                Order.created_at <= period_end,
                Order.deleted_at.is_(None),
            )
        ).all()
        total_expenses = sum(float(o.total or 0) for o in purchase_orders)
        
        net_profit = total_revenue - total_expenses
        
        outstanding_invoices = self.db.query(Invoice).filter(
            and_(
                Invoice.business_id == business_id,
                Invoice.status.in_([InvoiceStatus.SENT.value, InvoiceStatus.OVERDUE.value]),
                Invoice.deleted_at.is_(None),
            )
        ).all()
        
        outstanding_amount = sum(float(inv.total or 0) - float(inv.amount_paid or 0) for inv in outstanding_invoices)
        
        return ReportData(
            report_type=ReportType.FINANCIAL_OVERVIEW,
            period_start=period_start,
            period_end=period_end,
            business_name=business.name,
            business_id=str(business_id),
            user_email=user_email,
            metrics={
                'total_revenue': round(total_revenue, 2),
                'total_expenses': round(total_expenses, 2),
                'net_profit': round(net_profit, 2),
                'profit_margin': round((net_profit / total_revenue * 100) if total_revenue > 0 else 0, 1),
                'outstanding_invoices_count': len(outstanding_invoices),
                'outstanding_amount': round(outstanding_amount, 2),
                'currency': business.currency or 'ZAR',
            }
        )

    def generate_customer_activity(
        self,
        user_id: UUID,
        user_email: str,
        business: Business,
        period_start: datetime,
        period_end: datetime,
    ) -> ReportData:
        """
        Generate customer activity report.
        
        Includes: new_customers, repeat_customers, retention_rate, top_customers
        """
        business_id = business.id
        
        new_customers = self.db.query(Customer).filter(
            and_(
                Customer.business_id == business_id,
                Customer.created_at >= period_start,
                Customer.created_at <= period_end,
                Customer.deleted_at.is_(None),
            )
        ).count()
        
        total_customers = self.db.query(Customer).filter(
            and_(
                Customer.business_id == business_id,
                Customer.created_at <= period_end,
                Customer.deleted_at.is_(None),
            )
        ).count()
        
        customers_with_orders = (
            self.db.query(Order.customer_id)
            .filter(
                and_(
                    Order.business_id == business_id,
                    Order.direction == OrderDirection.OUTBOUND,
                    Order.created_at >= period_start,
                    Order.created_at <= period_end,
                    Order.customer_id.isnot(None),
                    Order.deleted_at.is_(None),
                )
            )
            .distinct()
            .count()
        )
        
        repeat_customers_query = (
            self.db.query(Order.customer_id)
            .filter(
                and_(
                    Order.business_id == business_id,
                    Order.direction == OrderDirection.OUTBOUND,
                    Order.created_at >= period_start,
                    Order.created_at <= period_end,
                    Order.customer_id.isnot(None),
                    Order.deleted_at.is_(None),
                )
            )
            .group_by(Order.customer_id)
            .having(func.count(Order.id) > 1)
            .count()
        )
        
        retention_rate = (customers_with_orders / total_customers * 100) if total_customers > 0 else 0
        
        top_customers_query = (
            self.db.query(
                Customer.id,
                Customer.first_name,
                Customer.last_name,
                Customer.company_name,
                func.sum(Order.total).label('total_spent'),
                func.count(Order.id).label('order_count'),
            )
            .join(Order, Order.customer_id == Customer.id)
            .filter(
                and_(
                    Order.business_id == business_id,
                    Order.direction == OrderDirection.OUTBOUND,
                    Order.created_at >= period_start,
                    Order.created_at <= period_end,
                    Order.deleted_at.is_(None),
                    Customer.deleted_at.is_(None),
                )
            )
            .group_by(Customer.id, Customer.first_name, Customer.last_name, Customer.company_name)
            .order_by(func.sum(Order.total).desc())
            .limit(5)
            .all()
        )
        
        top_customers = []
        for c in top_customers_query:
            name = c.company_name or f"{c.first_name or ''} {c.last_name or ''}".strip() or "Unknown"
            top_customers.append({
                'name': name,
                'total_spent': float(c.total_spent or 0),
                'order_count': int(c.order_count or 0),
            })
        
        return ReportData(
            report_type=ReportType.CUSTOMER_ACTIVITY,
            period_start=period_start,
            period_end=period_end,
            business_name=business.name,
            business_id=str(business_id),
            user_email=user_email,
            metrics={
                'new_customers': new_customers,
                'total_customers': total_customers,
                'active_customers': customers_with_orders,
                'repeat_customers': repeat_customers_query,
                'retention_rate': round(retention_rate, 1),
                'top_customers': top_customers,
                'currency': business.currency or 'ZAR',
            }
        )

    def generate_report(
        self,
        user_id: UUID,
        user_email: str,
        report_type: ReportType,
        period_start: datetime,
        period_end: datetime,
        business: Optional[Business] = None,
    ) -> Optional[ReportData]:
        """
        Generate report based on type.
        
        Args:
            user_id: User's ID
            user_email: User's email address
            report_type: Type of report to generate
            period_start: Start of reporting period
            period_end: End of reporting period
            business: Optional business to generate report for
            
        Returns:
            ReportData or None if user has no businesses
        """
        if not business:
            business = self.get_primary_business(user_id)
            
        if not business:
            logger.warning(f"No business found for user {user_id}")
            return None
        
        generators = {
            ReportType.SALES_SUMMARY: self.generate_sales_summary,
            ReportType.INVENTORY_STATUS: self.generate_inventory_status,
            ReportType.FINANCIAL_OVERVIEW: self.generate_financial_overview,
            ReportType.CUSTOMER_ACTIVITY: self.generate_customer_activity,
        }
        
        generator = generators.get(report_type)
        if not generator:
            logger.error(f"Unknown report type: {report_type}")
            return None
        
        try:
            return generator(user_id, user_email, business, period_start, period_end)
        except Exception as e:
            logger.error(f"Error generating {report_type} report: {e}", exc_info=True)
            return None
