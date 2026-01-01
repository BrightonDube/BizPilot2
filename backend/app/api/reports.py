"""Reports API endpoints."""

from typing import List, Optional
from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.core.rbac import has_permission
from app.models.user import User
from app.models.order import Order, OrderDirection
from app.models.customer import Customer
from app.models.product import Product
from app.models.business_user import BusinessUser
from app.schemas.report import (
    ReportStats,
    TopProduct,
    TopCustomer,
)

router = APIRouter(prefix="/reports", tags=["Reports"])


def _escape_pdf_text(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _build_simple_pdf(lines: list[str]) -> bytes:
    font_obj_num = 4

    content_lines = ["BT", "/F1 11 Tf", "50 770 Td"]
    for line in lines:
        content_lines.append(f"({_escape_pdf_text(line)}) Tj")
        content_lines.append("0 -14 Td")
    content_lines.append("ET")
    content_stream = "\n".join(content_lines).encode("utf-8")

    objects: list[bytes] = []
    objects.append(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
    objects.append(b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n")
    objects.append(
        f"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 {font_obj_num} 0 R >> >> /Contents 5 0 R >>\nendobj\n".encode(
            "utf-8"
        )
    )
    objects.append(b"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n")
    objects.append(
        f"5 0 obj\n<< /Length {len(content_stream)} >>\nstream\n".encode("utf-8")
        + content_stream
        + b"\nendstream\nendobj\n"
    )

    header = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
    out = bytearray()
    out.extend(header)

    offsets: list[int] = [0]
    for obj in objects:
        offsets.append(len(out))
        out.extend(obj)

    xref_start = len(out)
    out.extend(f"xref\n0 {len(objects) + 1}\n".encode("utf-8"))
    out.extend(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        out.extend(f"{off:010d} 00000 n \n".encode("utf-8"))

    out.extend(
        (
            "trailer\n"
            f"<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
            "startxref\n"
            f"{xref_start}\n"
            "%%EOF\n"
        ).encode("utf-8")
    )
    return bytes(out)


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
    direction: Optional[OrderDirection] = Query(None),
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
    current_revenue_query = db.query(func.sum(Order.total)).filter(
        Order.business_id == business_id,
        Order.created_at >= start_date,
        Order.created_at <= end_date,
    )
    if direction:
        current_revenue_query = current_revenue_query.filter(Order.direction == direction)
    current_revenue = current_revenue_query.scalar() or 0
    
    current_orders_query = db.query(func.count(Order.id)).filter(
        Order.business_id == business_id,
        Order.created_at >= start_date,
        Order.created_at <= end_date,
    )
    if direction:
        current_orders_query = current_orders_query.filter(Order.direction == direction)
    current_orders = current_orders_query.scalar() or 0
    
    # Previous period stats for comparison
    prev_revenue_query = db.query(func.sum(Order.total)).filter(
        Order.business_id == business_id,
        Order.created_at >= prev_start,
        Order.created_at < start_date,
    )
    if direction:
        prev_revenue_query = prev_revenue_query.filter(Order.direction == direction)
    prev_revenue = prev_revenue_query.scalar() or 0
    
    prev_orders_query = db.query(func.count(Order.id)).filter(
        Order.business_id == business_id,
        Order.created_at >= prev_start,
        Order.created_at < start_date,
    )
    if direction:
        prev_orders_query = prev_orders_query.filter(Order.direction == direction)
    prev_orders = prev_orders_query.scalar() or 0
    
    # Total counts
    total_customers = 0
    if direction in (None, OrderDirection.INBOUND):
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
    direction: Optional[OrderDirection] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get top-selling products."""
    business_id = get_user_business_id(db, current_user.id)
    
    if not business_id:
        return []

    if direction and direction != OrderDirection.INBOUND:
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
    direction: Optional[OrderDirection] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get top customers by spending."""
    business_id = get_user_business_id(db, current_user.id)
    
    if not business_id:
        return []

    if direction and direction != OrderDirection.INBOUND:
        return []

    # Get customers with their order totals
    customers = db.query(Customer).filter(
        Customer.business_id == business_id
    ).limit(limit).all()

    result = []
    for customer in customers:
        order_count = db.query(func.count(Order.id)).filter(
            Order.customer_id == customer.id,
            Order.direction == OrderDirection.INBOUND,
        ).scalar() or 0
        
        total_spent = db.query(func.sum(Order.total)).filter(
            Order.customer_id == customer.id,
            Order.direction == OrderDirection.INBOUND,
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


@router.get("/export/pdf")
async def export_reports_pdf(
    range: str = Query("30d", pattern="^(7d|30d|90d|1y)$"),
    direction: Optional[OrderDirection] = Query(None),
    current_user: User = Depends(has_permission("reports:export")),
    db: Session = Depends(get_db),
):
    business_id = get_user_business_id(db, current_user.id)
    start_date, end_date = get_date_range(range)

    lines: list[str] = []
    lines.append("BizPilot Report")
    lines.append(f"Range: {start_date} to {end_date}")
    if direction:
        lines.append(f"Category: {direction}")
    lines.append("")

    if not business_id:
        lines.append("No business selected.")
        pdf_bytes = _build_simple_pdf(lines)
        filename = f"report_{range}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    stats = await get_report_stats(range=range, direction=direction, current_user=current_user, db=db)
    top_products = await get_top_products(range=range, limit=5, direction=direction, current_user=current_user, db=db)
    top_customers = await get_top_customers(range=range, limit=5, direction=direction, current_user=current_user, db=db)

    lines.append("Summary")
    lines.append(f"Total Revenue: R {stats.total_revenue}")
    lines.append(f"Total Orders: {stats.total_orders}")
    lines.append(f"Total Customers: {stats.total_customers}")
    lines.append(f"Total Products: {stats.total_products}")
    lines.append("")
    lines.append("Top Products")

    if not top_products:
        lines.append("(No product data)")
    else:
        for idx, p in enumerate(top_products, start=1):
            lines.append(f"{idx}. {p.name} | Sales: {p.sales} | Revenue: R {p.revenue}")

    lines.append("")
    lines.append("Top Customers")

    if not top_customers:
        lines.append("(No customer data)")
    else:
        for idx, c in enumerate(top_customers, start=1):
            lines.append(f"{idx}. {c.name} | Orders: {c.orders} | Total Spent: R {c.total_spent}")

    pdf_bytes = _build_simple_pdf(lines)
    direction_str = f"_{direction}" if direction else ""
    filename = f"report{direction_str}_{range}_{start_date}_to_{end_date}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
