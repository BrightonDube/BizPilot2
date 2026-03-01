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
            self.notification_service.notify_business_users(
                business_id=str(invoice.business_id),
                title=f"Payment Overdue: Invoice #{invoice.invoice_number}",
                message=f"Invoice from {customer_name} for ${float(invoice.balance_due):.2f} is {days_overdue} days overdue",
                notification_type="payment",
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
