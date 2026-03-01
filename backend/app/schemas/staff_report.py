"""Pydantic schemas for staff report API responses."""

from typing import Dict, List, Optional

from pydantic import BaseModel, Field


# -- Performance Report --

class StaffPerformanceItem(BaseModel):
    """Individual staff member performance metrics."""

    rank: int
    user_id: str
    staff_name: str
    email: Optional[str] = None
    total_hours: float
    net_hours: float
    break_hours: float
    overtime_hours: float
    total_entries: int
    completed_entries: int
    first_clock_in: Optional[str] = None
    last_clock_out: Optional[str] = None


class StaffPerformanceReport(BaseModel):
    """Performance report based on attendance and time tracking."""

    start_date: str
    end_date: str
    total_staff: int
    total_hours: float
    average_hours_per_staff: float
    staff: List[StaffPerformanceItem]


# -- Attendance Report --

class AttendanceDailyRecord(BaseModel):
    """Single day attendance record for a staff member."""

    user_id: str
    staff_name: str
    date: str
    hours_worked: float
    net_hours: float
    break_duration: float
    overtime_hours: float
    overtime_entries: int
    auto_clock_outs: int
    first_clock_in: Optional[str] = None
    last_clock_out: Optional[str] = None
    entry_count: int


class AttendanceUserSummary(BaseModel):
    """Aggregated attendance summary for a staff member."""

    user_id: str
    staff_name: str
    total_hours: float
    total_net_hours: float
    total_breaks: float
    total_overtime: float
    days_worked: int
    total_auto_clock_outs: int


class StaffAttendanceReport(BaseModel):
    """Attendance report with daily breakdown and per-user summaries."""

    start_date: str
    end_date: str
    total_staff: int
    total_hours: float
    user_summaries: List[AttendanceUserSummary]
    daily_records: List[AttendanceDailyRecord]


# -- Department Performance Report --

class DepartmentPerformanceItem(BaseModel):
    """Performance metrics for a single department."""

    department_id: Optional[str] = None
    department_name: str
    staff_count: int
    total_hours: float
    net_hours: float
    overtime_hours: float
    total_entries: int
    avg_hours_per_staff: float


class DepartmentPerformanceReport(BaseModel):
    """Performance report grouped by department."""

    start_date: str
    end_date: str
    total_departments: int
    total_hours: float
    departments: List[DepartmentPerformanceItem]


# -- Productivity Report --

class StaffProductivityItem(BaseModel):
    """Productivity metrics for a single staff member."""

    user_id: str
    staff_name: str
    net_hours: float
    total_hours: float
    break_hours: float
    overtime_hours: float
    days_worked: int
    avg_daily_hours: float
    break_ratio_percent: float
    completion_rate_percent: float
    total_entries: int
    auto_clock_outs: int


class HourlyDistributionItem(BaseModel):
    """Clock-in count for a specific hour of the day."""

    hour: int = Field(ge=0, le=23)
    clock_ins: int


class StaffProductivityReport(BaseModel):
    """Productivity analysis with efficiency metrics."""

    start_date: str
    end_date: str
    total_staff: int
    total_net_hours: float
    average_hours_per_staff: float
    average_days_per_staff: float
    staff: List[StaffProductivityItem]
    clock_in_distribution: List[HourlyDistributionItem]


# -- Commission Report --

class StaffCommissionItem(BaseModel):
    """Commission data for a single staff member."""

    rank: int
    user_id: str
    staff_name: str
    email: Optional[str] = None
    order_count: int
    total_sales: float
    total_discounts: float
    commission_rate: float
    commission_amount: float


class StaffCommissionReport(BaseModel):
    """Commission report based on sales attributed to staff."""

    start_date: str
    end_date: str
    commission_rate: float
    total_staff: int
    total_sales: float
    total_commissions: float
    staff: List[StaffCommissionItem]


# -- Activity Log Report --

class ActivityLogEntry(BaseModel):
    """Single entry in the activity audit log."""

    id: str
    user_id: Optional[str] = None
    staff_name: str
    action: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    description: Optional[str] = None
    ip_address: Optional[str] = None
    timestamp: Optional[str] = None


class StaffActivityLogReport(BaseModel):
    """Paginated activity log report from audit trail."""

    start_date: str
    end_date: str
    total: int
    page: int
    per_page: int
    pages: int
    action_summary: Dict[str, int]
    entries: List[ActivityLogEntry]
