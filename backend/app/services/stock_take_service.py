"""Stock take service for month-end stock management."""

import random
import string
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.inventory import InventoryItem, InventoryTransaction, TransactionType
from app.models.stock_take import (
    InventoryAdjustment,
    StockCount,
    StockTakeSession,
    StockTakeStatus,
)


class StockTakeService:
    """Service for stock take operations."""

    def __init__(self, db: Session):
        self.db = db

    def _generate_reference(self) -> str:
        """Generate a unique reference like STK-YYYYMMDD-XXXX."""
        date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
        random_part = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
        return f"STK-{date_part}-{random_part}"

    def create_session(
        self,
        business_id: str,
        user_id: str,
        notes: Optional[str] = None,
    ) -> StockTakeSession:
        """Create a new draft stock take session."""
        session = StockTakeSession(
            business_id=business_id,
            reference=self._generate_reference(),
            status=StockTakeStatus.DRAFT,
            started_by_id=user_id,
            notes=notes,
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def get_session(
        self, session_id: str, business_id: str
    ) -> Optional[StockTakeSession]:
        """Get a stock take session by ID."""
        return (
            self.db.query(StockTakeSession)
            .filter(
                StockTakeSession.id == session_id,
                StockTakeSession.business_id == business_id,
                StockTakeSession.deleted_at.is_(None),
            )
            .first()
        )

    def list_sessions(
        self,
        business_id: str,
        status: Optional[StockTakeStatus] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[StockTakeSession], int]:
        """List stock take sessions with optional status filter."""
        query = self.db.query(StockTakeSession).filter(
            StockTakeSession.business_id == business_id,
            StockTakeSession.deleted_at.is_(None),
        )
        if status:
            query = query.filter(StockTakeSession.status == status)
        total = query.count()
        offset = (page - 1) * per_page
        items = (
            query.order_by(StockTakeSession.created_at.desc())
            .offset(offset)
            .limit(per_page)
            .all()
        )
        return items, total

    def start_session(
        self, session_id: str, business_id: str
    ) -> StockTakeSession:
        """Start a session: change to IN_PROGRESS and populate counts from inventory."""
        session = self.get_session(session_id, business_id)
        if not session:
            raise ValueError("Stock take session not found")
        if session.status != StockTakeStatus.DRAFT:
            raise ValueError("Session must be in DRAFT status to start")

        session.status = StockTakeStatus.IN_PROGRESS
        session.started_at = datetime.now(timezone.utc)

        # Populate stock counts from current inventory
        inventory_items = (
            self.db.query(InventoryItem)
            .filter(
                InventoryItem.business_id == business_id,
                InventoryItem.deleted_at.is_(None),
            )
            .all()
        )

        for item in inventory_items:
            count = StockCount(
                session_id=session.id,
                product_id=item.product_id,
                business_id=business_id,
                system_quantity=item.quantity_on_hand,
                unit_cost=item.average_cost,
            )
            self.db.add(count)

        self.db.commit()
        self.db.refresh(session)
        return session

    def record_count(
        self,
        session_id: str,
        product_id: str,
        business_id: str,
        counted_quantity: int,
        user_id: str,
        notes: Optional[str] = None,
    ) -> StockCount:
        """Record a physical count for a product."""
        session = self.get_session(session_id, business_id)
        if not session:
            raise ValueError("Stock take session not found")
        if session.status != StockTakeStatus.IN_PROGRESS:
            raise ValueError("Session must be IN_PROGRESS to record counts")

        count = (
            self.db.query(StockCount)
            .filter(
                StockCount.session_id == session_id,
                StockCount.product_id == product_id,
                StockCount.business_id == business_id,
                StockCount.deleted_at.is_(None),
            )
            .first()
        )
        if not count:
            raise ValueError("Stock count entry not found for this product")

        count.counted_quantity = counted_quantity
        count.variance = counted_quantity - count.system_quantity
        count.counted_by_id = user_id
        count.notes = notes
        if count.unit_cost is not None:
            count.variance_value = Decimal(str(count.variance)) * count.unit_cost

        self.db.commit()
        self.db.refresh(count)
        return count

    def get_counts(
        self,
        session_id: str,
        business_id: str,
        variance_only: bool = False,
    ) -> List[StockCount]:
        """Get counts for a session, optionally only those with variances."""
        query = self.db.query(StockCount).filter(
            StockCount.session_id == session_id,
            StockCount.business_id == business_id,
            StockCount.deleted_at.is_(None),
        )
        if variance_only:
            query = query.filter(
                StockCount.variance.isnot(None),
                StockCount.variance != 0,
            )
        return query.order_by(StockCount.created_at).all()

    def complete_session(
        self, session_id: str, business_id: str, user_id: str
    ) -> StockTakeSession:
        """Complete session: calculate variances, create adjustments, update inventory."""
        session = self.get_session(session_id, business_id)
        if not session:
            raise ValueError("Stock take session not found")
        if session.status != StockTakeStatus.IN_PROGRESS:
            raise ValueError("Session must be IN_PROGRESS to complete")

        counts = self.get_counts(session_id, business_id, variance_only=True)

        for count in counts:
            if count.variance is None or count.variance == 0:
                continue

            # Create inventory adjustment
            adjustment = InventoryAdjustment(
                business_id=business_id,
                session_id=session.id,
                product_id=count.product_id,
                adjustment_type="stocktake",
                quantity_change=count.variance,
                reason=f"Stock take variance: system={count.system_quantity}, counted={count.counted_quantity}",
                approved_by_id=user_id,
            )
            self.db.add(adjustment)

            # Update inventory
            inv_item = (
                self.db.query(InventoryItem)
                .filter(
                    InventoryItem.product_id == count.product_id,
                    InventoryItem.business_id == business_id,
                    InventoryItem.deleted_at.is_(None),
                )
                .first()
            )
            if inv_item:
                qty_before = inv_item.quantity_on_hand
                inv_item.quantity_on_hand += count.variance
                inv_item.last_counted_at = datetime.now(timezone.utc)

                # Create inventory transaction for audit trail
                txn = InventoryTransaction(
                    business_id=business_id,
                    product_id=count.product_id,
                    inventory_item_id=inv_item.id,
                    transaction_type=TransactionType.COUNT,
                    quantity_change=count.variance,
                    quantity_before=qty_before,
                    quantity_after=inv_item.quantity_on_hand,
                    unit_cost=count.unit_cost,
                    total_cost=(
                        Decimal(str(abs(count.variance))) * count.unit_cost
                        if count.unit_cost
                        else None
                    ),
                    reference_type="stock_take",
                    reference_id=session.id,
                    notes=f"Stock take {session.reference}",
                    user_id=user_id,
                )
                self.db.add(txn)

        session.status = StockTakeStatus.COMPLETED
        session.completed_by_id = user_id
        session.completed_at = datetime.now(timezone.utc)

        self.db.commit()
        self.db.refresh(session)
        return session

    def get_variance_summary(self, session_id: str, business_id: str) -> Dict:
        """Get variance summary for a session."""
        session = self.get_session(session_id, business_id)
        if not session:
            raise ValueError("Stock take session not found")

        total_items = (
            self.db.query(func.count(StockCount.id))
            .filter(
                StockCount.session_id == session_id,
                StockCount.business_id == business_id,
                StockCount.deleted_at.is_(None),
            )
            .scalar()
        )

        items_with_variance = (
            self.db.query(func.count(StockCount.id))
            .filter(
                StockCount.session_id == session_id,
                StockCount.business_id == business_id,
                StockCount.variance.isnot(None),
                StockCount.variance != 0,
                StockCount.deleted_at.is_(None),
            )
            .scalar()
        )

        total_variance_value = (
            self.db.query(func.coalesce(func.sum(StockCount.variance_value), 0))
            .filter(
                StockCount.session_id == session_id,
                StockCount.business_id == business_id,
                StockCount.deleted_at.is_(None),
            )
            .scalar()
        )

        return {
            "session_id": str(session.id),
            "reference": session.reference,
            "status": session.status.value,
            "total_items": total_items or 0,
            "items_with_variance": items_with_variance or 0,
            "total_variance_value": total_variance_value,
        }

    def cancel_session(self, session_id: str, business_id: str) -> StockTakeSession:
        """Cancel a stock take session."""
        session = self.get_session(session_id, business_id)
        if not session:
            raise ValueError("Stock take session not found")
        if session.status == StockTakeStatus.COMPLETED:
            raise ValueError("Cannot cancel a completed session")

        session.status = StockTakeStatus.CANCELLED
        self.db.commit()
        self.db.refresh(session)
        return session
