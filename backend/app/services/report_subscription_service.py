"""Service for managing report subscriptions."""

import logging
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.report_subscription import (
    ReportSubscription,
    ReportDeliveryLog,
    ReportType,
    DeliveryFrequency,
    DeliveryStatus,
)

logger = logging.getLogger(__name__)


class ReportSubscriptionService:
    """Service for managing user report subscriptions."""

    def __init__(self, db: Session):
        self.db = db

    def create_subscription(
        self,
        user_id: UUID,
        report_type: ReportType,
        frequency: DeliveryFrequency,
    ) -> ReportSubscription:
        """
        Create or activate a report subscription.
        
        If subscription exists but is inactive, reactivates it.
        If subscription doesn't exist, creates a new one.
        
        Args:
            user_id: The user's ID
            report_type: Type of report to subscribe to
            frequency: Delivery frequency (weekly/monthly)
            
        Returns:
            The created or updated subscription
        """
        existing = self.db.query(ReportSubscription).filter(
            and_(
                ReportSubscription.user_id == user_id,
                ReportSubscription.report_type == report_type.value,
                ReportSubscription.frequency == frequency.value,
                ReportSubscription.deleted_at.is_(None),
            )
        ).first()

        if existing:
            if not existing.is_active:
                existing.is_active = True
                self.db.commit()
                self.db.refresh(existing)
                logger.info(f"Reactivated subscription {existing.id} for user {user_id}")
            return existing

        subscription = ReportSubscription(
            user_id=user_id,
            report_type=report_type.value,
            frequency=frequency.value,
            is_active=True,
        )
        self.db.add(subscription)
        self.db.commit()
        self.db.refresh(subscription)
        
        logger.info(f"Created subscription {subscription.id} for user {user_id}")
        return subscription

    def deactivate_subscription(
        self,
        user_id: UUID,
        report_type: ReportType,
        frequency: DeliveryFrequency,
    ) -> bool:
        """
        Deactivate a report subscription.
        
        Args:
            user_id: The user's ID
            report_type: Type of report
            frequency: Delivery frequency
            
        Returns:
            True if subscription was deactivated, False if not found
        """
        subscription = self.db.query(ReportSubscription).filter(
            and_(
                ReportSubscription.user_id == user_id,
                ReportSubscription.report_type == report_type.value,
                ReportSubscription.frequency == frequency.value,
                ReportSubscription.deleted_at.is_(None),
            )
        ).first()

        if not subscription:
            return False

        subscription.is_active = False
        self.db.commit()
        
        logger.info(f"Deactivated subscription {subscription.id} for user {user_id}")
        return True

    def get_user_subscriptions(
        self,
        user_id: UUID,
        active_only: bool = False,
    ) -> List[ReportSubscription]:
        """
        Get all subscriptions for a user.
        
        Args:
            user_id: The user's ID
            active_only: If True, return only active subscriptions
            
        Returns:
            List of subscriptions
        """
        query = self.db.query(ReportSubscription).filter(
            and_(
                ReportSubscription.user_id == user_id,
                ReportSubscription.deleted_at.is_(None),
            )
        )

        if active_only:
            query = query.filter(ReportSubscription.is_active)

        return query.all()

    def get_subscription(
        self,
        user_id: UUID,
        report_type: ReportType,
        frequency: DeliveryFrequency,
    ) -> Optional[ReportSubscription]:
        """
        Get a specific subscription.
        
        Args:
            user_id: The user's ID
            report_type: Type of report
            frequency: Delivery frequency
            
        Returns:
            The subscription if found, None otherwise
        """
        return self.db.query(ReportSubscription).filter(
            and_(
                ReportSubscription.user_id == user_id,
                ReportSubscription.report_type == report_type.value,
                ReportSubscription.frequency == frequency.value,
                ReportSubscription.deleted_at.is_(None),
            )
        ).first()

    def get_active_subscriptions_by_frequency(
        self,
        frequency: DeliveryFrequency,
        batch_size: int = 50,
        offset: int = 0,
    ) -> List[ReportSubscription]:
        """
        Get active subscriptions for a specific frequency in batches.
        
        Args:
            frequency: Delivery frequency to filter by
            batch_size: Number of subscriptions per batch
            offset: Offset for pagination
            
        Returns:
            List of active subscriptions
        """
        return self.db.query(ReportSubscription).filter(
            and_(
                ReportSubscription.frequency == frequency.value,
                ReportSubscription.is_active,
                ReportSubscription.deleted_at.is_(None),
            )
        ).offset(offset).limit(batch_size).all()

    def count_active_subscriptions_by_frequency(
        self,
        frequency: DeliveryFrequency,
    ) -> int:
        """
        Count active subscriptions for a specific frequency.
        
        Args:
            frequency: Delivery frequency to filter by
            
        Returns:
            Count of active subscriptions
        """
        return self.db.query(ReportSubscription).filter(
            and_(
                ReportSubscription.frequency == frequency.value,
                ReportSubscription.is_active,
                ReportSubscription.deleted_at.is_(None),
            )
        ).count()

    def update_last_sent(
        self,
        subscription_id: UUID,
        sent_at: datetime,
    ) -> None:
        """
        Update the last_sent_at timestamp for a subscription.
        
        Args:
            subscription_id: The subscription's ID
            sent_at: When the report was sent
        """
        subscription = self.db.query(ReportSubscription).filter(
            ReportSubscription.id == subscription_id
        ).first()

        if subscription:
            subscription.last_sent_at = sent_at
            self.db.commit()

    def log_delivery(
        self,
        user_id: UUID,
        report_type: ReportType,
        frequency: DeliveryFrequency,
        period_start: datetime,
        period_end: datetime,
        status: DeliveryStatus,
        error_message: Optional[str] = None,
        retry_count: int = 0,
        delivered_at: Optional[datetime] = None,
    ) -> ReportDeliveryLog:
        """
        Log a report delivery attempt.
        
        Args:
            user_id: The user's ID
            report_type: Type of report
            frequency: Delivery frequency
            period_start: Start of reporting period
            period_end: End of reporting period
            status: Delivery status
            error_message: Error message if failed
            retry_count: Number of retry attempts
            delivered_at: When successfully delivered
            
        Returns:
            The created delivery log
        """
        log = ReportDeliveryLog(
            user_id=user_id,
            report_type=report_type.value,
            frequency=frequency.value,
            reporting_period_start=period_start,
            reporting_period_end=period_end,
            status=status.value,
            error_message=error_message,
            retry_count=retry_count,
            delivered_at=delivered_at,
        )
        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)
        
        return log

    def get_delivery_logs(
        self,
        user_id: UUID,
        limit: int = 50,
    ) -> List[ReportDeliveryLog]:
        """
        Get delivery logs for a user.
        
        Args:
            user_id: The user's ID
            limit: Maximum number of logs to return
            
        Returns:
            List of delivery logs, most recent first
        """
        return self.db.query(ReportDeliveryLog).filter(
            ReportDeliveryLog.user_id == user_id
        ).order_by(ReportDeliveryLog.created_at.desc()).limit(limit).all()

    def toggle_subscription(
        self,
        user_id: UUID,
        report_type: ReportType,
        frequency: DeliveryFrequency,
    ) -> Optional[ReportSubscription]:
        """
        Toggle subscription active status.
        
        Args:
            user_id: The user's ID
            report_type: Type of report
            frequency: Delivery frequency
            
        Returns:
            The updated subscription, or None if not found
        """
        subscription = self.get_subscription(user_id, report_type, frequency)
        
        if not subscription:
            return None
            
        subscription.is_active = not subscription.is_active
        self.db.commit()
        self.db.refresh(subscription)
        
        logger.info(
            f"Toggled subscription {subscription.id} to "
            f"{'active' if subscription.is_active else 'inactive'}"
        )
        return subscription
