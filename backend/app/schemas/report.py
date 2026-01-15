"""Report schemas for API validation."""

from pydantic import BaseModel
from typing import List


class ReportStats(BaseModel):
    """Overall business statistics."""
    
    total_revenue: float
    total_orders: int
    total_customers: int
    total_products: int
    revenue_change: float
    orders_change: float
    customers_change: float


class TrendDataPoint(BaseModel):
    """Single data point for trend charts."""
    
    date: str
    value: float
    label: str


class RevenueTrend(BaseModel):
    """Revenue over time data."""
    
    data: List[TrendDataPoint]
    total: float
    average: float


class OrdersTrend(BaseModel):
    """Orders over time data."""
    
    data: List[TrendDataPoint]
    total: int
    average: float


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


class InventoryReportItem(BaseModel):
    """Inventory report item."""
    
    id: str
    product_name: str
    sku: str | None
    quantity_on_hand: float
    reorder_point: float
    unit_cost: float
    total_value: float
    status: str  # 'in_stock', 'low_stock', 'out_of_stock'


class InventoryReport(BaseModel):
    """Inventory summary report."""
    
    items: List[InventoryReportItem]
    total_items: int
    total_value: float
    low_stock_count: int
    out_of_stock_count: int


class COGSReportItem(BaseModel):
    """Cost of Goods Sold report item."""
    
    product_id: str
    product_name: str
    quantity_sold: int
    unit_cost: float
    total_cost: float
    revenue: float
    gross_profit: float
    margin_percent: float


class COGSReport(BaseModel):
    """COGS summary report."""
    
    items: List[COGSReportItem]
    total_cogs: float
    total_revenue: float
    gross_profit: float
    average_margin: float


class ProfitMarginItem(BaseModel):
    """Profit margin by product."""
    
    product_id: str
    product_name: str
    selling_price: float
    total_cost: float
    profit: float
    margin_percent: float


class ProfitMarginReport(BaseModel):
    """Profit margin report."""
    
    items: List[ProfitMarginItem]
    average_margin: float
    highest_margin: float
    lowest_margin: float


class UserActivityItem(BaseModel):
    """User activity report item."""
    
    user_id: str
    user_name: str
    total_hours: float
    total_entries: int
    clock_ins: int
    clock_outs: int
    break_duration: float
    last_activity: str | None  # ISO datetime
    status: str  # 'active' | 'completed'


class UserActivityReport(BaseModel):
    """User activity summary report."""
    
    items: List[UserActivityItem]
    total_users: int
    total_hours: float
    average_hours_per_user: float


class LoginHistoryItem(BaseModel):
    """Login history report item."""
    
    session_id: str
    user_id: str
    user_name: str
    device_name: str | None
    device_type: str | None
    ip_address: str | None
    location: str | None
    login_time: str  # ISO datetime
    logout_time: str | None  # ISO datetime
    duration_minutes: float | None
    is_active: bool
    is_suspicious: bool


class LoginHistoryReport(BaseModel):
    """Login history summary report."""
    
    items: List[LoginHistoryItem]
    total_sessions: int
    active_sessions: int
    unique_users: int
    suspicious_count: int
