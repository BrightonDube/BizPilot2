"""Report schemas for API validation."""

from pydantic import BaseModel


class ReportStats(BaseModel):
    """Overall business statistics."""
    
    total_revenue: float
    total_orders: int
    total_customers: int
    total_products: int
    revenue_change: float
    orders_change: float
    customers_change: float


class TopProduct(BaseModel):
    """Top-selling product data."""
    
    id: str
    name: str
    sales: int
    revenue: float


class TopCustomer(BaseModel):
    """Top customer by spending."""
    
    id: str
    name: str
    orders: int
    total_spent: float
