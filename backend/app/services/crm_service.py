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

    # ---- Auto-segment evaluation ----

    def auto_update_segments(self, business_id: str) -> dict:
        """Evaluate all auto-segments and update their membership.

        For each segment with is_auto=True, evaluate all customers against
        the segment's criteria and add/remove members accordingly.
        Criteria is a JSON string with rules like:
        {"min_total_spent": 1000, "min_orders": 5, "max_days_since_last_order": 90}
        """
        import json
        from app.models.customer import Customer

        auto_segments = (
            self.db.query(CustomerSegment)
            .filter(
                CustomerSegment.business_id == business_id,
                CustomerSegment.is_auto.is_(True),
                CustomerSegment.deleted_at.is_(None),
            )
            .all()
        )

        customers = (
            self.db.query(Customer)
            .filter(
                Customer.business_id == business_id,
                Customer.deleted_at.is_(None),
            )
            .all()
        )

        results = {"segments_evaluated": 0, "members_added": 0, "members_removed": 0}

        for segment in auto_segments:
            criteria = {}
            if segment.criteria:
                try:
                    criteria = json.loads(segment.criteria) if isinstance(segment.criteria, str) else segment.criteria
                except (json.JSONDecodeError, TypeError):
                    continue

            current_member_ids = set(
                mid for (mid,) in self.db.query(CustomerSegmentMember.customer_id)
                .filter(
                    CustomerSegmentMember.segment_id == segment.id,
                    CustomerSegmentMember.deleted_at.is_(None),
                )
                .all()
            )

            matching_ids = set()
            for customer in customers:
                if self._customer_matches_criteria(customer, criteria):
                    matching_ids.add(customer.id)

            # Add new members
            to_add = matching_ids - current_member_ids
            for cid in to_add:
                member = CustomerSegmentMember(
                    segment_id=segment.id, customer_id=cid,
                )
                self.db.add(member)
                results["members_added"] += 1

            # Remove non-matching members
            to_remove = current_member_ids - matching_ids
            if to_remove:
                from datetime import datetime, timezone as tz
                now = datetime.now(tz.utc)
                self.db.query(CustomerSegmentMember).filter(
                    CustomerSegmentMember.segment_id == segment.id,
                    CustomerSegmentMember.customer_id.in_(to_remove),
                ).update({CustomerSegmentMember.deleted_at: now}, synchronize_session="fetch")
                results["members_removed"] += len(to_remove)

            results["segments_evaluated"] += 1

        self.db.commit()
        return results

    @staticmethod
    def _customer_matches_criteria(customer, criteria: dict) -> bool:
        """Check if a customer matches segment criteria rules."""
        if not criteria:
            return False

        min_spent = criteria.get("min_total_spent")
        if min_spent is not None and (customer.total_spent or 0) < float(min_spent):
            return False

        max_spent = criteria.get("max_total_spent")
        if max_spent is not None and (customer.total_spent or 0) > float(max_spent):
            return False

        min_orders = criteria.get("min_orders")
        if min_orders is not None and (customer.total_orders or 0) < int(min_orders):
            return False

        max_days = criteria.get("max_days_since_last_order")
        if max_days is not None:
            if not hasattr(customer, "last_order_date") or not customer.last_order_date:
                return False

        customer_type = criteria.get("customer_type")
        if customer_type is not None:
            ct = customer.customer_type.value if hasattr(customer.customer_type, "value") else customer.customer_type
            if ct != customer_type:
                return False

        return True

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

    # ---- Privacy compliance ----

    def export_customer_data(self, business_id: str, customer_id: str, accessed_by: str) -> dict:
        """Export all data for a customer (POPIA/GDPR data subject access request)."""
        from app.models.customer import Customer
        from app.models.data_access_log import CustomerDataAccessLog

        customer = (
            self.db.query(Customer)
            .filter(Customer.id == customer_id, Customer.business_id == business_id)
            .first()
        )
        if not customer:
            return {"error": "Customer not found"}

        # Log the access
        log = CustomerDataAccessLog(
            business_id=business_id,
            customer_id=customer_id,
            accessed_by=accessed_by,
            access_type="export",
            details="Full data export requested",
        )
        self.db.add(log)
        self.db.commit()

        return {
            "customer": {
                "id": str(customer.id),
                "first_name": customer.first_name,
                "last_name": customer.last_name,
                "email": customer.email,
                "phone": customer.phone,
                "company_name": customer.company_name,
                "customer_type": customer.customer_type.value if customer.customer_type else None,
                "address_line1": customer.address_line1,
                "address_line2": customer.address_line2,
                "city": customer.city,
                "state": customer.state,
                "postal_code": customer.postal_code,
                "country": customer.country,
                "notes": customer.notes,
                "tags": customer.tags,
                "total_orders": customer.total_orders,
                "total_spent": str(customer.total_spent) if customer.total_spent else "0",
                "marketing_consent": customer.marketing_consent,
                "data_processing_consent": customer.data_processing_consent,
                "consent_updated_at": customer.consent_updated_at.isoformat() if customer.consent_updated_at else None,
                "created_at": customer.created_at.isoformat() if customer.created_at else None,
            },
            "interactions": [
                {
                    "type": i.interaction_type.value if hasattr(i.interaction_type, "value") else i.interaction_type,
                    "notes": i.notes,
                    "created_at": i.created_at.isoformat() if i.created_at else None,
                }
                for i in self.db.query(CustomerInteraction)
                .filter(CustomerInteraction.customer_id == customer_id)
                .all()
            ],
        }

    def delete_customer_data(self, business_id: str, customer_id: str, accessed_by: str) -> dict:
        """Anonymize customer data for POPIA/GDPR right-to-erasure."""
        from app.models.customer import Customer
        from app.models.data_access_log import CustomerDataAccessLog

        customer = (
            self.db.query(Customer)
            .filter(Customer.id == customer_id, Customer.business_id == business_id)
            .first()
        )
        if not customer:
            return {"error": "Customer not found"}

        # Log the access before anonymizing
        log = CustomerDataAccessLog(
            business_id=business_id,
            customer_id=customer_id,
            accessed_by=accessed_by,
            access_type="delete",
            details="Data anonymization requested",
        )
        self.db.add(log)

        # Anonymize PII fields
        customer.first_name = "[REDACTED]"
        customer.last_name = "[REDACTED]"
        customer.email = None
        customer.phone = None
        customer.company_name = None
        customer.tax_number = None
        customer.address_line1 = None
        customer.address_line2 = None
        customer.city = None
        customer.state = None
        customer.postal_code = None
        customer.country = None
        customer.notes = None
        customer.tags = []

        self.db.commit()
        return {"status": "anonymized", "customer_id": str(customer_id)}

    def update_consent(
        self, business_id: str, customer_id: str, accessed_by: str,
        marketing_consent: Optional[bool] = None,
        data_processing_consent: Optional[bool] = None,
    ) -> dict:
        """Update customer consent preferences."""
        from app.models.customer import Customer
        from app.models.data_access_log import CustomerDataAccessLog

        customer = (
            self.db.query(Customer)
            .filter(Customer.id == customer_id, Customer.business_id == business_id)
            .first()
        )
        if not customer:
            return {"error": "Customer not found"}

        changes = []
        if marketing_consent is not None:
            customer.marketing_consent = marketing_consent
            changes.append(f"marketing_consent={marketing_consent}")
        if data_processing_consent is not None:
            customer.data_processing_consent = data_processing_consent
            changes.append(f"data_processing_consent={data_processing_consent}")

        customer.consent_updated_at = datetime.now(timezone.utc)

        log = CustomerDataAccessLog(
            business_id=business_id,
            customer_id=customer_id,
            accessed_by=accessed_by,
            access_type="consent_update",
            details=", ".join(changes),
        )
        self.db.add(log)
        self.db.commit()

        return {
            "customer_id": str(customer_id),
            "marketing_consent": customer.marketing_consent,
            "data_processing_consent": customer.data_processing_consent,
            "consent_updated_at": customer.consent_updated_at.isoformat(),
        }

    def get_access_logs(self, business_id: str, customer_id: str) -> list:
        """Get data access audit trail for a customer."""
        from app.models.data_access_log import CustomerDataAccessLog

        logs = (
            self.db.query(CustomerDataAccessLog)
            .filter(
                CustomerDataAccessLog.business_id == business_id,
                CustomerDataAccessLog.customer_id == customer_id,
            )
            .order_by(CustomerDataAccessLog.created_at.desc())
            .all()
        )
        return [
            {
                "id": str(log.id),
                "access_type": log.access_type,
                "accessed_by": str(log.accessed_by),
                "details": log.details,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ]
