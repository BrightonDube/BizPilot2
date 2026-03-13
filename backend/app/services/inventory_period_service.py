"""Inventory period management service for month-end close.

Handles period lifecycle (open → close → reopen), snapshot generation,
and ABC classification.

Why separate from stock_take_service?
Stock takes are operational (counting products).  Period management is
financial (valuation, COGS, closing).  Mixing them creates a God-service
that violates single responsibility.
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.stock_take import (
    InventoryPeriod,
    PeriodSnapshot,
    ProductABCClassification,
    StockCountHistory,
)


class InventoryPeriodService:
    """Service for managing inventory periods, snapshots, and ABC analysis."""

    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # Period CRUD
    # ------------------------------------------------------------------

    def list_periods(
        self,
        business_id: str,
        page: int = 1,
        per_page: int = 12,
    ) -> Tuple[List[InventoryPeriod], int]:
        """List inventory periods, most recent first."""
        query = self.db.query(InventoryPeriod).filter(
            InventoryPeriod.business_id == business_id,
        )
        total = query.count()
        items = (
            query.order_by(
                InventoryPeriod.period_year.desc(),
                InventoryPeriod.period_month.desc(),
            )
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def get_or_create_period(
        self,
        business_id: str,
        year: int,
        month: int,
    ) -> InventoryPeriod:
        """Get an existing period or create a new one.

        Why upsert?
        Periods are created lazily when the first stock take or
        inventory transaction happens in a new month.  This avoids
        pre-creating 12 empty periods at year start.
        """
        period = (
            self.db.query(InventoryPeriod)
            .filter(
                InventoryPeriod.business_id == business_id,
                InventoryPeriod.period_year == year,
                InventoryPeriod.period_month == month,
            )
            .first()
        )
        if period:
            return period

        period = InventoryPeriod(
            business_id=business_id,
            period_year=year,
            period_month=month,
            status="open",
        )
        self.db.add(period)
        self.db.commit()
        self.db.refresh(period)
        return period

    def close_period(
        self,
        period_id: str,
        business_id: str,
        closing_value: Decimal,
        cogs: Decimal,
        closed_by: str,
    ) -> Optional[InventoryPeriod]:
        """Close an inventory period, locking it for edits.

        Why require closing_value and COGS?
        These are computed by the caller (stock take reconciliation)
        and stored here for reporting.  The service doesn't re-compute
        them to keep separation between counting and financial logic.
        """
        period = (
            self.db.query(InventoryPeriod)
            .filter(
                InventoryPeriod.id == period_id,
                InventoryPeriod.business_id == business_id,
            )
            .first()
        )
        if not period:
            return None
        if period.status == "closed":
            return period  # Idempotent

        now = datetime.now(timezone.utc)
        period.status = "closed"
        period.closing_value = closing_value
        period.cogs = cogs
        period.closed_by = closed_by
        period.closed_at = now
        self.db.commit()
        self.db.refresh(period)
        return period

    def reopen_period(
        self,
        period_id: str,
        business_id: str,
        reopened_by: str,
    ) -> Optional[InventoryPeriod]:
        """Reopen a closed period for corrections.

        Why allow reopening?
        Errors are discovered after close (late invoices, miscounts).
        Reopening is an audited action that sets status to 'reopened'
        rather than back to 'open' — so the audit trail shows it was
        intentionally reopened after being closed.
        """
        period = (
            self.db.query(InventoryPeriod)
            .filter(
                InventoryPeriod.id == period_id,
                InventoryPeriod.business_id == business_id,
                InventoryPeriod.status == "closed",
            )
            .first()
        )
        if not period:
            return None

        now = datetime.now(timezone.utc)
        period.status = "reopened"
        period.reopened_by = reopened_by
        period.reopened_at = now
        self.db.commit()
        self.db.refresh(period)
        return period

    # ------------------------------------------------------------------
    # Period Snapshots
    # ------------------------------------------------------------------

    def create_snapshot(
        self,
        period_id: str,
        product_id: str,
        quantity: int,
        unit_cost: Decimal,
    ) -> PeriodSnapshot:
        """Create a frozen snapshot for a product at period close."""
        total_value = Decimal(quantity) * unit_cost
        snapshot = PeriodSnapshot(
            period_id=period_id,
            product_id=product_id,
            quantity=quantity,
            unit_cost=unit_cost,
            total_value=total_value,
        )
        self.db.add(snapshot)
        self.db.commit()
        self.db.refresh(snapshot)
        return snapshot

    def list_snapshots(
        self,
        period_id: str,
        page: int = 1,
        per_page: int = 50,
    ) -> Tuple[List[PeriodSnapshot], int]:
        """List snapshots for a period."""
        query = self.db.query(PeriodSnapshot).filter(
            PeriodSnapshot.period_id == period_id,
        )
        total = query.count()
        items = query.offset((page - 1) * per_page).limit(per_page).all()
        return items, total

    # ------------------------------------------------------------------
    # ABC Classification
    # ------------------------------------------------------------------

    def set_classification(
        self,
        business_id: str,
        product_id: str,
        classification: str,
        annual_value: Decimal,
        count_frequency_days: int = 90,
    ) -> ProductABCClassification:
        """Set or update ABC classification for a product.

        Why upsert?
        Classifications are recomputed periodically (e.g. quarterly).
        Upsert avoids duplicates and ensures the latest classification
        is always reflected.
        """
        existing = (
            self.db.query(ProductABCClassification)
            .filter(
                ProductABCClassification.business_id == business_id,
                ProductABCClassification.product_id == product_id,
            )
            .first()
        )
        if existing:
            existing.classification = classification
            existing.annual_value = annual_value
            existing.count_frequency_days = count_frequency_days
            self.db.commit()
            self.db.refresh(existing)
            return existing

        abc = ProductABCClassification(
            business_id=business_id,
            product_id=product_id,
            classification=classification,
            annual_value=annual_value,
            count_frequency_days=count_frequency_days,
        )
        self.db.add(abc)
        self.db.commit()
        self.db.refresh(abc)
        return abc

    def list_classifications(
        self,
        business_id: str,
        classification: Optional[str] = None,
        page: int = 1,
        per_page: int = 50,
    ) -> Tuple[List[ProductABCClassification], int]:
        """List ABC classifications, optionally filtered by class."""
        query = self.db.query(ProductABCClassification).filter(
            ProductABCClassification.business_id == business_id,
        )
        if classification:
            query = query.filter(ProductABCClassification.classification == classification)
        total = query.count()
        items = (
            query.order_by(ProductABCClassification.annual_value.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    # ------------------------------------------------------------------
    # Stock Count History
    # ------------------------------------------------------------------

    def add_count_history(
        self,
        count_id: str,
        counted_quantity: int,
        counted_by: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> StockCountHistory:
        """Record a recount attempt for blind-count auditing."""
        history = StockCountHistory(
            count_id=count_id,
            counted_quantity=counted_quantity,
            counted_by=counted_by,
            notes=notes,
        )
        self.db.add(history)
        self.db.commit()
        self.db.refresh(history)
        return history

    def get_count_history(self, count_id: str) -> List[StockCountHistory]:
        """Get all recount attempts for a specific stock count."""
        return (
            self.db.query(StockCountHistory)
            .filter(StockCountHistory.count_id == count_id)
            .order_by(StockCountHistory.counted_at.asc())
            .all()
        )
