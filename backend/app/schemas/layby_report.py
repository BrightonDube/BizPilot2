"""Pydantic schemas for layby report endpoints.

Why typed report schemas instead of returning raw dicts?
1. API documentation (FastAPI auto-generates OpenAPI specs from schemas)
2. Compile-time validation prevents silent schema drift
3. Frontend TypeScript clients can auto-generate types from the spec
"""

from typing import List, Optional
from decimal import Decimal
from datetime import date

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Active Laybys Report
# ---------------------------------------------------------------------------


class ActiveLaybyReport(BaseModel):
    """Summary of all active and overdue laybys.

    Returned by GET /laybys/reports/active.
    """
    total_count: int = Field(..., description="Number of active + overdue laybys")
    total_value: float = Field(..., description="Sum of total_amount for all active laybys")
    total_paid: float = Field(..., description="Sum of amount_paid across active laybys")
    total_outstanding: float = Field(..., description="Sum of balance_due across active laybys")


# ---------------------------------------------------------------------------
# Overdue Report
# ---------------------------------------------------------------------------


class OverdueLaybyItem(BaseModel):
    """A single overdue layby in the overdue report."""
    layby_id: str
    reference_number: str
    customer_id: str
    balance_due: float
    next_payment_date: Optional[str] = None
    days_overdue: int


class OverdueReport(BaseModel):
    """Report of laybys with overdue payments.

    Returned by GET /laybys/reports/overdue.
    """
    count: int = Field(..., description="Number of overdue laybys")
    total_overdue_amount: float = Field(..., description="Total outstanding balance on overdue laybys")
    laybys: List[OverdueLaybyItem] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Aging Report
# ---------------------------------------------------------------------------


class AgingBucket(BaseModel):
    """A single aging bucket (e.g. 0-30 days)."""
    count: int = 0
    total_value: float = 0.0
    total_outstanding: float = 0.0


class AgingReport(BaseModel):
    """Aging report with buckets: 0-30, 31-60, 61-90, 90+ days.

    Why these bucket boundaries?
    They align with standard accounting aging schedules.  Most businesses
    consider anything past 90 days as high-risk for non-collection.

    Returned by GET /laybys/reports/aging.
    """
    as_of: str = Field(..., description="Report date in ISO format")
    buckets: dict[str, AgingBucket] = Field(
        ...,
        description="Aging buckets: '0_30', '31_60', '61_90', '90_plus'",
    )
    total_active: int = Field(..., description="Total active laybys across all buckets")


# ---------------------------------------------------------------------------
# Summary Report
# ---------------------------------------------------------------------------


class CountValue(BaseModel):
    """A count + total value pair."""
    count: int = 0
    total_value: float = 0.0


class CountOnly(BaseModel):
    """Just a count."""
    count: int = 0


class PaymentsSummary(BaseModel):
    """Payment totals within the reporting period."""
    count: int = 0
    total: float = 0.0


class RefundsSummary(BaseModel):
    """Refund totals within the reporting period."""
    total: float = 0.0


class ActiveSnapshot(BaseModel):
    """Point-in-time snapshot of active laybys."""
    count: int = 0


class LaybySummaryReport(BaseModel):
    """Full layby summary statistics for a date range.

    Returned by GET /laybys/reports/summary.
    """
    start_date: str
    end_date: str
    created: CountValue
    completed: CountOnly
    cancelled: CountOnly
    payments: PaymentsSummary
    refunds: RefundsSummary
    active_snapshot: ActiveSnapshot
