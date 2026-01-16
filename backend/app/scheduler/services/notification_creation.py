"""Notification creation service for scheduler."""

import logging
from sqlalchemy.orm import Session

from app.models.invoice import Invoice
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)


class NotificationCreationService:
    """Service for creating notifications from scheduler jobs."""
    
    def __init__(
        self,
        notification_service: NotificationService,
        db_session: Session
    ):
        """
        Initialize with notification service and database session.
        
        Args:
            notification_service: NotificationService instance
            db_session: SQLAlchemy database session
        """
        self.notification_service = notification_service
        self.db = db_session
    
    def create_overdue_notification(
        self,
        invoice: Invoice,
        days_overdue: int
    ) -> bool:
        """
        Create an overdue notification for an invoice.
        
        Args:
            invoice: The overdue invoice
            days_overdue: Number of days past due date
            
        Returns:
            True if notification created successfully, False otherwise
        """
        try:
            # Get customer name
            customer_name = "Unknown Customer"
            if invoice.customer_id:
                from app.models.customer import Customer
                customer = self.db.query(Customer).filter(
                    Customer.id == invoice.customer_id
                ).first()
                if customer:
                    customer_name = customer.name
            
            # Create notification using existing service
            self.notification_service.create_payment_overdue_notification(
                business_id=str(invoice.business_id),
                invoice_id=str(invoice.id),
                invoice_number=invoice.invoice_number,
                customer_name=customer_name,
                amount=float(invoice.balance_due),
                days_overdue=days_overdue,
                user_id=None  # Broadcast to all users in business
            )
            
            logger.info(
                f"Created overdue notification for invoice {invoice.invoice_number} "
                f"({days_overdue} days overdue)"
            )
            return True
        
        except Exception as e:
            logger.error(
                f"Failed to create notification for invoice {invoice.id}: {e}",
                exc_info=True
            )
            return False
