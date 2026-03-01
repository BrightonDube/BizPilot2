"""CRM service for customer relationship management."""

from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.crm import (
    CustomerInteraction,
    CustomerMetrics,
    CustomerSegment,
    CustomerSegmentMember,
    InteractionType,
)
from app.models.order import Order, OrderStatus


class CrmService:
    """Service for CRM operations."""

    def __init__(self, db: Session):
        self.db = db

    # ---- Segment management ----

    def create_segment(
        self,
        business_id: str,
        name: str,
        description: Optional[str] = None,
        color: Optional[str] = None,
    ) -> CustomerSegment:
        """Create a customer segment."""
        segment = CustomerSegment(
            business_id=business_id,
            name=name,
            description=description,
        )
        if color:
            segment.color = color
        self.db.add(segment)
        self.db.commit()
        self.db.refresh(segment)
        return segment

    def list_segments(self, business_id: str) -> List[dict]:
        """List segments with member count."""
        segments = (
            self.db.query(CustomerSegment)
            .filter(
                CustomerSegment.business_id == business_id,
                CustomerSegment.deleted_at.is_(None),
            )
            .order_by(CustomerSegment.name)
            .all()
        )
        result = []
        for seg in segments:
            count = (
                self.db.query(func.count(CustomerSegmentMember.id))
                .filter(
                    CustomerSegmentMember.segment_id == seg.id,
                    CustomerSegmentMember.deleted_at.is_(None),
                )
                .scalar()
            )
            result.append({"segment": seg, "member_count": count or 0})
        return result

    def add_to_segment(
        self, segment_id: str, customer_id: str
    ) -> CustomerSegmentMember:
        """Add a customer to a segment."""
        existing = (
            self.db.query(CustomerSegmentMember)
            .filter(
                CustomerSegmentMember.segment_id == segment_id,
                CustomerSegmentMember.customer_id == customer_id,
                CustomerSegmentMember.deleted_at.is_(None),
            )
            .first()
        )
        if existing:
            return existing
        member = CustomerSegmentMember(
            segment_id=segment_id,
            customer_id=customer_id,
        )
        self.db.add(member)
        self.db.commit()
        self.db.refresh(member)
        return member

    def remove_from_segment(
        self, segment_id: str, customer_id: str
    ) -> bool:
        """Remove a customer from a segment. Returns True if removed."""
        member = (
            self.db.query(CustomerSegmentMember)
            .filter(
                CustomerSegmentMember.segment_id == segment_id,
                CustomerSegmentMember.customer_id == customer_id,
                CustomerSegmentMember.deleted_at.is_(None),
            )
            .first()
        )
        if not member:
            return False
        member.soft_delete()
        self.db.commit()
        return True

    def get_segment_members(
        self,
        segment_id: str,
        business_id: str,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[CustomerSegmentMember], int]:
        """Get members of a segment with pagination."""
        from app.models.customer import Customer

        query = (
            self.db.query(CustomerSegmentMember)
            .join(
                Customer, Customer.id == CustomerSegmentMember.customer_id
            )
            .filter(
                CustomerSegmentMember.segment_id == segment_id,
                CustomerSegmentMember.deleted_at.is_(None),
                Customer.business_id == business_id,
                Customer.deleted_at.is_(None),
            )
        )
        total = query.count()
        items = (
            query.order_by(CustomerSegmentMember.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    # ---- Interaction management ----

    def log_interaction(
        self,
        customer_id: str,
        business_id: str,
        user_id: Optional[str],
        interaction_type: InteractionType,
        subject: str,
        content: Optional[str] = None,
        follow_up_date: Optional[datetime] = None,
    ) -> CustomerInteraction:
        """Log a customer interaction."""
        interaction = CustomerInteraction(
            customer_id=customer_id,
            business_id=business_id,
            user_id=user_id,
            interaction_type=interaction_type,
            subject=subject,
            content=content,
            follow_up_date=follow_up_date,
        )
        self.db.add(interaction)
        self.db.commit()
        self.db.refresh(interaction)
        return interaction

    def get_interactions(
        self,
        customer_id: str,
        business_id: str,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[CustomerInteraction], int]:
        """Get interaction history for a customer."""
        query = (
            self.db.query(CustomerInteraction)
            .filter(
                CustomerInteraction.customer_id == customer_id,
                CustomerInteraction.business_id == business_id,
                CustomerInteraction.deleted_at.is_(None),
            )
        )
        total = query.count()
        items = (
            query.order_by(CustomerInteraction.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def get_follow_ups(
        self,
        business_id: str,
        user_id: Optional[str] = None,
    ) -> List[CustomerInteraction]:
        """Get pending follow-ups, optionally filtered by user."""
        query = (
            self.db.query(CustomerInteraction)
            .filter(
                CustomerInteraction.business_id == business_id,
                CustomerInteraction.follow_up_date.isnot(None),
                CustomerInteraction.is_completed.is_(False),
                CustomerInteraction.deleted_at.is_(None),
            )
        )
        if user_id:
            query = query.filter(CustomerInteraction.user_id == user_id)
        return query.order_by(CustomerInteraction.follow_up_date.asc()).all()

    def complete_follow_up(
        self, interaction_id: str, business_id: str
    ) -> Optional[CustomerInteraction]:
        """Mark a follow-up as completed."""
        interaction = (
            self.db.query(CustomerInteraction)
            .filter(
                CustomerInteraction.id == interaction_id,
                CustomerInteraction.business_id == business_id,
                CustomerInteraction.deleted_at.is_(None),
            )
            .first()
        )
        if not interaction:
            return None
        interaction.is_completed = True
        self.db.commit()
        self.db.refresh(interaction)
        return interaction

    # ---- Metrics ----

    def update_customer_metrics(
        self, customer_id: str, business_id: str
    ) -> CustomerMetrics:
        """Recalculate customer metrics from orders."""
        completed_statuses = [
            OrderStatus.DELIVERED,
            OrderStatus.RECEIVED,
        ]

        stats = (
            self.db.query(
                func.count(Order.id).label("total_orders"),
                func.coalesce(func.sum(Order.total), 0).label("total_spent"),
                func.max(Order.created_at).label("last_order_date"),
                func.min(Order.created_at).label("first_order_date"),
            )
            .filter(
                Order.customer_id == customer_id,
                Order.business_id == business_id,
                Order.status.in_(completed_statuses),
                Order.deleted_at.is_(None),
            )
            .first()
        )

        total_orders = stats.total_orders or 0
        total_spent = Decimal(str(stats.total_spent or 0))
        avg = (
            total_spent / total_orders
            if total_orders > 0
            else Decimal("0")
        )
        last_order = stats.last_order_date
        first_order = stats.first_order_date
        days_since = None
        if last_order:
            now = datetime.now(timezone.utc)
            if last_order.tzinfo is None:
                from datetime import timezone as tz

                last_order = last_order.replace(tzinfo=tz.utc)
            days_since = (now - last_order).days

        metrics = (
            self.db.query(CustomerMetrics)
            .filter(
                CustomerMetrics.customer_id == customer_id,
                CustomerMetrics.business_id == business_id,
            )
            .first()
        )
        if not metrics:
            metrics = CustomerMetrics(
                customer_id=customer_id,
                business_id=business_id,
            )
            self.db.add(metrics)

        metrics.total_orders = total_orders
        metrics.total_spent = total_spent
        metrics.average_order_value = avg
        metrics.last_order_date = last_order
        metrics.first_order_date = first_order
        metrics.days_since_last_order = days_since

        self.db.commit()
        self.db.refresh(metrics)
        return metrics

    def get_customer_metrics(
        self, customer_id: str, business_id: str
    ) -> Optional[CustomerMetrics]:
        """Get pre-computed metrics for a customer."""
        return (
            self.db.query(CustomerMetrics)
            .filter(
                CustomerMetrics.customer_id == customer_id,
                CustomerMetrics.business_id == business_id,
            )
            .first()
        )

    def get_top_customers(
        self, business_id: str, limit: int = 10
    ) -> List[CustomerMetrics]:
        """Get top customers by total spent."""
        return (
            self.db.query(CustomerMetrics)
            .filter(
                CustomerMetrics.business_id == business_id,
                CustomerMetrics.total_spent > 0,
            )
            .order_by(CustomerMetrics.total_spent.desc())
            .limit(limit)
            .all()
        )

    def get_at_risk_customers(
        self, business_id: str, days_threshold: int = 90
    ) -> List[CustomerMetrics]:
        """Get customers without orders for X days."""
        return (
            self.db.query(CustomerMetrics)
            .filter(
                CustomerMetrics.business_id == business_id,
                CustomerMetrics.days_since_last_order >= days_threshold,
                CustomerMetrics.total_orders > 0,
            )
            .order_by(CustomerMetrics.days_since_last_order.desc())
            .all()
        )
