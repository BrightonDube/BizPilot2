"""Invoice query service for scheduler."""

import logging
from typing import List, Optional, Set
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import and_
from uuid import UUID

from app.models.invoice import Invoice, InvoiceStatus
from app.models.notification import Notification, NotificationType

logger = logging.getLogger(__name__)


class InvoiceQueryService:
    """Service for querying invoices for scheduler jobs."""
    
    def __init__(self, db_session: Session):
        """
        Initialize with database session.
        
        Args:
            db_session: SQLAlchemy database session
        """
        self.db = db_session
    
    def get_overdue_invoices(
        self,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> List[Invoice]:
        """
        Query invoices that are overdue.
        
        Returns invoices where:
        - due_date < current_date
        - status not in [PAID, CANCELLED]
        - deleted_at is None
        
        Args:
            limit: Maximum number of invoices to return
            offset: Number of invoices to skip
            
        Returns:
            List of overdue invoices
        """
        today = date.today()
        
        query = self.db.query(Invoice).filter(
            and_(
                Invoice.due_date < today,
                Invoice.status.notin_([InvoiceStatus.PAID, InvoiceStatus.CANCELLED]),
                Invoice.deleted_at.is_(None)
            )
        )
        
        # Apply pagination if specified
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
        
        invoices = query.all()
        
        logger.info(f"Found {len(invoices)} overdue invoices")
        return invoices
    
    def get_overdue_invoices_count(self) -> int:
        """
        Get total count of overdue invoices.
        
        Returns:
            Count of overdue invoices
        """
        today = date.today()
        
        count = self.db.query(Invoice).filter(
            and_(
                Invoice.due_date < today,
                Invoice.status.notin_([InvoiceStatus.PAID, InvoiceStatus.CANCELLED]),
                Invoice.deleted_at.is_(None)
            )
        ).count()
        
        return count
    
    def get_existing_notification_invoice_ids(
        self,
        invoice_ids: List[UUID]
    ) -> Set[UUID]:
        """
        Get invoice IDs that already have overdue notifications.
        
        Args:
            invoice_ids: List of invoice IDs to check
            
        Returns:
            Set of invoice IDs with existing notifications
        """
        if not invoice_ids:
            return set()
        
        # Query notifications for these invoices
        notifications = self.db.query(Notification).filter(
            and_(
                Notification.reference_id.in_(invoice_ids),
                Notification.notification_type == NotificationType.PAYMENT_OVERDUE,
                Notification.is_read == False
            )
        ).all()
        
        # Extract invoice IDs from notifications
        existing_ids = {notif.reference_id for notif in notifications if notif.reference_id}
        
        logger.info(f"Found {len(existing_ids)} invoices with existing notifications out of {len(invoice_ids)}")
        return existing_ids
    
    def calculate_days_overdue(self, invoice: Invoice) -> int:
        """
        Calculate number of days an invoice is overdue.
        
        Args:
            invoice: Invoice to calculate days overdue for
            
        Returns:
            Number of days overdue (0 if not overdue)
        """
        if not invoice.due_date:
            return 0
        
        today = date.today()
        if invoice.due_date >= today:
            return 0
        
        delta = today - invoice.due_date
        return delta.days
