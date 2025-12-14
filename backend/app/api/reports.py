"""Reports API endpoints."""

from typing import List, Optional
from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.models.order import Order
from app.models.customer import Customer
from app.models.product import Product
from app.models.business_user import BusinessUser
from app.schemas.report import (
    ReportStats,
    TopProduct,
    TopCustomer,
)

router = APIRouter(prefix="/reports", tags=["Reports"])


def get_date_range(range_str: str) -> tuple[date, date]:
    """Convert range string to start and end dates."""
    today = date.today()
    if range_str == "7d":
        return today - timedelta(days=7), today
    elif range_str == "30d":
        return today - timedelta(days=30), today
    elif range_str == "90d":
        return today - timedelta(days=90), today
    elif range_str == "1y":
        return today - timedelta(days=365), today
    else:
        return today - timedelta(days=30), today


def get_user_business_id(db: Session, user_id) -> Optional[str]:
    """Get the business ID for a user."""
    business_user = db.query(BusinessUser).filter(
        BusinessUser.user_id == user_id
    ).first()
    return business_user.business_id if business_user else None


@router.get("/stats", response_model=ReportStats)
async def get_report_stats(
    range: str = Query("30d", pattern="^(7d|30d|90d|1y)$"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get overall business statistics."""
    business_id = get_user_business_id(db, current_user.id)
    
    if not business_id:
        return ReportStats(
            total_revenue=0,
            total_orders=0,
            total_customers=0,
            total_products=0,
            revenue_change=0,
            orders_change=0,
            customers_change=0,
        )

    start_date, end_date = get_date_range(range)
    prev_start = start_date - (end_date - start_date)
    
    # Current period stats
    current_revenue = db.query(func.sum(Order.total)).filter(
        Order.business_id == business_id,
        Order.created_at >= start_date,
        Order.created_at <= end_date,
    ).scalar() or 0
    
    current_orders = db.query(func.count(Order.id)).filter(
        Order.business_id == business_id,
        Order.created_at >= start_date,
        Order.created_at <= end_date,
    ).scalar() or 0
    
    # Previous period stats for comparison
    prev_revenue = db.query(func.sum(Order.total)).filter(
        Order.business_id == business_id,
        Order.created_at >= prev_start,
        Order.created_at < start_date,
    ).scalar() or 0
    
    prev_orders = db.query(func.count(Order.id)).filter(
        Order.business_id == business_id,
        Order.created_at >= prev_start,
        Order.created_at < start_date,
    ).scalar() or 0
    
    # Total counts
    total_customers = db.query(func.count(Customer.id)).filter(
        Customer.business_id == business_id
    ).scalar() or 0
    
    total_products = db.query(func.count(Product.id)).filter(
        Product.business_id == business_id
    ).scalar() or 0
    
    # Calculate percentage changes
    revenue_change = 0
    if prev_revenue > 0:
        revenue_change = round(((float(current_revenue) - float(prev_revenue)) / float(prev_revenue)) * 100, 1)
    
    orders_change = 0
    if prev_orders > 0:
        orders_change = round(((current_orders - prev_orders) / prev_orders) * 100, 1)

    return ReportStats(
        total_revenue=float(current_revenue),
        total_orders=current_orders,
        total_customers=total_customers,
        total_products=total_products,
        revenue_change=revenue_change,
        orders_change=orders_change,
        customers_change=0,
    )


@router.get("/top-products", response_model=List[TopProduct])
async def get_top_products(
    range: str = Query("30d", pattern="^(7d|30d|90d|1y)$"),
    limit: int = Query(5, ge=1, le=20),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get top-selling products."""
    business_id = get_user_business_id(db, current_user.id)
    
    if not business_id:
        return []

    # For now, return products by their sales from order items
    # In a real implementation, you'd join with order_items
    products = db.query(Product).filter(
        Product.business_id == business_id,
        Product.status == "active"
    ).limit(limit).all()

    return [
        TopProduct(
            id=str(p.id),
            name=p.name,
            sales=0,  # Would calculate from order_items
            revenue=float(p.selling_price or 0) * 10,  # Placeholder
        )
        for p in products
    ]


@router.get("/top-customers", response_model=List[TopCustomer])
async def get_top_customers(
    range: str = Query("30d", pattern="^(7d|30d|90d|1y)$"),
    limit: int = Query(5, ge=1, le=20),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get top customers by spending."""
    business_id = get_user_business_id(db, current_user.id)
    
    if not business_id:
        return []

    # Get customers with their order totals
    customers = db.query(Customer).filter(
        Customer.business_id == business_id
    ).limit(limit).all()

    result = []
    for customer in customers:
        order_count = db.query(func.count(Order.id)).filter(
            Order.customer_id == customer.id
        ).scalar() or 0
        
        total_spent = db.query(func.sum(Order.total)).filter(
            Order.customer_id == customer.id
        ).scalar() or 0

        name = f"{customer.first_name} {customer.last_name}" if customer.first_name else customer.company_name
        
        result.append(TopCustomer(
            id=str(customer.id),
            name=name or "Unknown",
            orders=order_count,
            total_spent=float(total_spent),
        ))

    # Sort by total spent descending
    result.sort(key=lambda x: x.total_spent, reverse=True)
    return result[:limit]
