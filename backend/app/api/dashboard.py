"""Dashboard API endpoints for overview statistics."""

from fastapi import APIRouter, Depends
from sqlalchemy import func, extract
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta

from app.core.database import get_sync_db
from app.api.deps import get_current_active_user, get_current_business_id
from app.models.user import User
from app.models.product import Product, ProductStatus, ProductCategory
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


class RevenueByMonth(BaseModel):
    """Revenue data by month for charts."""
    month: str
    revenue: float
    orders: int


class ProductByCategory(BaseModel):
    """Product count by category for charts."""
    category: str
    count: int


class InventoryStatus(BaseModel):
    """Inventory status for charts."""
    name: str
    in_stock: int
    low_stock: int


class DashboardResponse(BaseModel):
    """Full dashboard response."""
    stats: DashboardStats
    recent_orders: List[RecentOrder]
    top_products: List[TopProduct]
    revenue_by_month: List[RevenueByMonth]
    products_by_category: List[ProductByCategory]
    inventory_status: List[InventoryStatus]


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """
    Get dashboard statistics for the current user's business.
    """
    
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
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """
    Get recent orders for the dashboard.
    Uses eager loading to avoid N+1 queries.
    """
    
    # Eager load customer relationship to avoid N+1 queries
    from sqlalchemy.orm import joinedload
    orders = db.query(Order).options(
        joinedload(Order.customer)
    ).filter(
        Order.business_id == business_id
    ).order_by(Order.created_at.desc()).limit(limit).all()
    
    result = []
    for order in orders:
        # Customer is already loaded - no additional query
        customer_name = "Walk-in Customer"
        if order.customer:
            if order.customer.company_name:
                customer_name = order.customer.company_name
            else:
                customer_name = f"{order.customer.first_name or ''} {order.customer.last_name or ''}".strip() or "Unknown"
        
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
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """
    Get top selling products for the dashboard.
    Based on quantity in stock (as a proxy for popularity - in real app would use order data).
    """
    
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


@router.get("/revenue-by-month", response_model=List[RevenueByMonth])
async def get_revenue_by_month(
    months: int = 6,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """
    Get revenue data by month for charts.
    Optimized: Single query with GROUP BY instead of 2N queries.
    """
    
    today = datetime.now()
    start_date = (today - relativedelta(months=months-1)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Single query with GROUP BY month - reduces 12 queries to 1
    monthly_data = db.query(
        extract('year', Order.created_at).label('year'),
        extract('month', Order.created_at).label('month'),
        func.coalesce(func.sum(Order.total), 0).label('revenue'),
        func.count(Order.id).label('orders')
    ).filter(
        Order.business_id == business_id,
        Order.created_at >= start_date
    ).group_by(
        extract('year', Order.created_at),
        extract('month', Order.created_at)
    ).all()
    
    # Create a lookup dict for the results
    data_lookup = {(int(row.year), int(row.month)): row for row in monthly_data}
    
    # Build result for all months (including those with no data)
    result = []
    for i in range(months - 1, -1, -1):
        month_date = today - relativedelta(months=i)
        key = (month_date.year, month_date.month)
        row = data_lookup.get(key)
        
        result.append(RevenueByMonth(
            month=month_date.strftime("%b"),
            revenue=float(row.revenue if row else 0),
            orders=int(row.orders if row else 0)
        ))
    
    return result


@router.get("/products-by-category", response_model=List[ProductByCategory])
async def get_products_by_category(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """
    Get product distribution by category for pie chart.
    """
    
    # Get products grouped by category
    products_with_category = db.query(
        ProductCategory.name,
        func.count(Product.id).label('count')
    ).outerjoin(
        Product, 
        (Product.category_id == ProductCategory.id) & 
        (Product.business_id == business_id) &
        (Product.status == ProductStatus.ACTIVE)
    ).filter(
        ProductCategory.business_id == business_id
    ).group_by(ProductCategory.name).all()
    
    result = []
    for category_name, count in products_with_category:
        if count > 0:
            result.append(ProductByCategory(
                category=category_name,
                count=count
            ))
    
    # If no categories, count uncategorized products
    if not result:
        uncategorized = db.query(Product).filter(
            Product.business_id == business_id,
            Product.status == ProductStatus.ACTIVE
        ).count()
        if uncategorized > 0:
            result.append(ProductByCategory(
                category="Uncategorized",
                count=uncategorized
            ))
    
    return result


@router.get("/inventory-status", response_model=List[InventoryStatus])
async def get_inventory_status(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """
    Get inventory status summary for bar chart.
    Optimized: Single query instead of 14 queries.
    Note: Since inventory is a current snapshot (not historical), 
    we show the same current values for all days.
    """
    
    # Single query for current inventory status (reduces 14 queries to 2)
    in_stock = db.query(func.coalesce(func.sum(Product.quantity), 0)).filter(
        Product.business_id == business_id,
        Product.status == ProductStatus.ACTIVE,
        Product.track_inventory.is_(True)
    ).scalar()
    
    low_stock = db.query(Product).filter(
        Product.business_id == business_id,
        Product.status == ProductStatus.ACTIVE,
        Product.track_inventory.is_(True),
        Product.quantity <= Product.low_stock_threshold
    ).count()
    
    # Build result for last 7 days (current snapshot for each)
    result = []
    today = datetime.now()
    in_stock_val = int(in_stock or 0)
    
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        result.append(InventoryStatus(
            name=day.strftime("%a"),
            in_stock=in_stock_val,
            low_stock=low_stock
        ))
    
    return result


@router.get("", response_model=DashboardResponse)
async def get_full_dashboard(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """
    Get complete dashboard data including stats, recent orders, top products, and chart data.
    """
    stats = await get_dashboard_stats(current_user, business_id, db)
    recent_orders = await get_recent_orders(5, current_user, business_id, db)
    top_products = await get_top_products(5, current_user, business_id, db)
    revenue_by_month = await get_revenue_by_month(6, current_user, business_id, db)
    products_by_category = await get_products_by_category(current_user, business_id, db)
    inventory_status = await get_inventory_status(current_user, business_id, db)
    
    return DashboardResponse(
        stats=stats,
        recent_orders=recent_orders,
        top_products=top_products,
        revenue_by_month=revenue_by_month,
        products_by_category=products_by_category,
        inventory_status=inventory_status
    )
