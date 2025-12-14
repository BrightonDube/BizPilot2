"""Dashboard API endpoints for overview statistics."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.business_user import BusinessUser, BusinessUserStatus
from app.models.product import Product, ProductStatus
from app.models.customer import Customer
from app.models.order import Order
from app.models.invoice import Invoice, InvoiceStatus

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


class DashboardStats(BaseModel):
    """Dashboard statistics response."""
    total_revenue: float
    total_orders: int
    total_customers: int
    total_products: int
    orders_today: int
    revenue_today: float
    orders_this_month: int
    revenue_this_month: float
    pending_invoices: int
    pending_invoice_amount: float
    low_stock_products: int
    currency: str = "ZAR"


class RecentOrder(BaseModel):
    """Recent order for dashboard."""
    id: str
    order_number: str
    customer_name: str
    total: float
    status: str
    created_at: datetime


class TopProduct(BaseModel):
    """Top selling product."""
    id: str
    name: str
    sku: Optional[str]
    quantity_sold: int
    revenue: float


class DashboardResponse(BaseModel):
    """Full dashboard response."""
    stats: DashboardStats
    recent_orders: List[RecentOrder]
    top_products: List[TopProduct]


def get_user_business_id(user: User, db: Session) -> str:
    """Get the current business ID for a user."""
    # Get user's primary business
    business_user = db.query(BusinessUser).filter(
        BusinessUser.user_id == user.id,
        BusinessUser.status == BusinessUserStatus.ACTIVE
    ).first()
    
    if not business_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No business found for user"
        )
    
    return str(business_user.business_id)


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get dashboard statistics for the current user's business.
    """
    business_id = get_user_business_id(current_user, db)
    
    # Calculate date ranges
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = today.replace(day=1)
    
    # Total revenue (all time - from paid orders)
    total_revenue_result = db.query(func.coalesce(func.sum(Order.total), 0)).filter(
        Order.business_id == business_id,
    ).scalar()
    
    # Total orders
    total_orders = db.query(Order).filter(
        Order.business_id == business_id
    ).count()
    
    # Total customers
    total_customers = db.query(Customer).filter(
        Customer.business_id == business_id
    ).count()
    
    # Total products
    total_products = db.query(Product).filter(
        Product.business_id == business_id,
        Product.status == ProductStatus.ACTIVE
    ).count()
    
    # Orders today
    orders_today = db.query(Order).filter(
        Order.business_id == business_id,
        Order.created_at >= today
    ).count()
    
    # Revenue today
    revenue_today_result = db.query(func.coalesce(func.sum(Order.total), 0)).filter(
        Order.business_id == business_id,
        Order.created_at >= today
    ).scalar()
    
    # Orders this month
    orders_this_month = db.query(Order).filter(
        Order.business_id == business_id,
        Order.created_at >= month_start
    ).count()
    
    # Revenue this month
    revenue_this_month_result = db.query(func.coalesce(func.sum(Order.total), 0)).filter(
        Order.business_id == business_id,
        Order.created_at >= month_start
    ).scalar()
    
    # Pending invoices
    pending_invoices = db.query(Invoice).filter(
        Invoice.business_id == business_id,
        Invoice.status.in_([InvoiceStatus.DRAFT, InvoiceStatus.SENT, InvoiceStatus.VIEWED, InvoiceStatus.PARTIAL])
    ).count()
    
    # Pending invoice amount
    pending_invoice_amount_result = db.query(func.coalesce(func.sum(Invoice.total - Invoice.amount_paid), 0)).filter(
        Invoice.business_id == business_id,
        Invoice.status.in_([InvoiceStatus.DRAFT, InvoiceStatus.SENT, InvoiceStatus.VIEWED, InvoiceStatus.PARTIAL])
    ).scalar()
    
    # Low stock products
    low_stock_products = db.query(Product).filter(
        Product.business_id == business_id,
        Product.status == ProductStatus.ACTIVE,
        Product.track_inventory.is_(True),
        Product.quantity <= Product.low_stock_threshold
    ).count()
    
    return DashboardStats(
        total_revenue=float(total_revenue_result or 0),
        total_orders=total_orders,
        total_customers=total_customers,
        total_products=total_products,
        orders_today=orders_today,
        revenue_today=float(revenue_today_result or 0),
        orders_this_month=orders_this_month,
        revenue_this_month=float(revenue_this_month_result or 0),
        pending_invoices=pending_invoices,
        pending_invoice_amount=float(pending_invoice_amount_result or 0),
        low_stock_products=low_stock_products,
        currency="ZAR"
    )


@router.get("/recent-orders", response_model=List[RecentOrder])
async def get_recent_orders(
    limit: int = 5,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get recent orders for the dashboard.
    """
    business_id = get_user_business_id(current_user, db)
    
    orders = db.query(Order).filter(
        Order.business_id == business_id
    ).order_by(Order.created_at.desc()).limit(limit).all()
    
    result = []
    for order in orders:
        # Get customer name
        customer_name = "Walk-in Customer"
        if order.customer_id:
            customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
            if customer:
                if customer.company_name:
                    customer_name = customer.company_name
                else:
                    customer_name = f"{customer.first_name or ''} {customer.last_name or ''}".strip() or "Unknown"
        
        result.append(RecentOrder(
            id=str(order.id),
            order_number=order.order_number,
            customer_name=customer_name,
            total=float(order.total),
            status=order.status.value,
            created_at=order.created_at
        ))
    
    return result


@router.get("/top-products", response_model=List[TopProduct])
async def get_top_products(
    limit: int = 5,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get top selling products for the dashboard.
    Based on quantity in stock (as a proxy for popularity - in real app would use order data).
    """
    business_id = get_user_business_id(current_user, db)
    
    # Get top products by quantity (simulating popularity)
    products = db.query(Product).filter(
        Product.business_id == business_id,
        Product.status == ProductStatus.ACTIVE
    ).order_by(Product.quantity.desc()).limit(limit).all()
    
    result = []
    for product in products:
        result.append(TopProduct(
            id=str(product.id),
            name=product.name,
            sku=product.sku,
            quantity_sold=product.quantity,  # Using quantity as proxy
            revenue=float(product.selling_price * product.quantity)
        ))
    
    return result


@router.get("", response_model=DashboardResponse)
async def get_full_dashboard(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get complete dashboard data including stats, recent orders, and top products.
    """
    stats = await get_dashboard_stats(current_user, db)
    recent_orders = await get_recent_orders(5, current_user, db)
    top_products = await get_top_products(5, current_user, db)
    
    return DashboardResponse(
        stats=stats,
        recent_orders=recent_orders,
        top_products=top_products
    )
