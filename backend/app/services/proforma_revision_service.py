"""
Proforma invoice revision service.

Manages revision snapshots of proforma invoices (quotes).
Each revision captures the complete state of the quote at a point
in time, enabling audit trails and change tracking.

Why a dedicated service instead of keeping logic in the API?
Revision logic (snapshot creation, diffing, version numbering) is
business logic that should be testable independently of HTTP concerns.
Extracting it also makes it reusable from other entry points
(e.g., automatic revision on approval/conversion).
"""

from typing import Optional, List, Tuple
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.proforma import ProformaInvoiceRevision


class ProformaRevisionService:
    """Service for managing proforma invoice revisions."""

    def __init__(self, db: Session):
        self.db = db

    def create_revision(
        self,
        proforma_id: UUID,
        created_by: UUID,
        quote_number: Optional[str] = None,
        status: Optional[str] = None,
        subtotal: Optional[float] = None,
        tax_amount: Optional[float] = None,
        total: Optional[float] = None,
        items_snapshot: Optional[list] = None,
        notes: Optional[str] = None,
        terms: Optional[str] = None,
        change_summary: Optional[str] = None,
    ) -> ProformaInvoiceRevision:
        """
        Create a new revision snapshot for a proforma invoice.

        Automatically assigns the next sequential revision number.
        """
        # Get next revision number
        max_rev = (
            self.db.query(func.max(ProformaInvoiceRevision.revision_number))
            .filter(ProformaInvoiceRevision.proforma_id == proforma_id)
            .scalar()
        ) or 0

        revision = ProformaInvoiceRevision(
            proforma_id=proforma_id,
            revision_number=max_rev + 1,
            quote_number=quote_number,
            status=status,
            subtotal=subtotal,
            tax_amount=tax_amount,
            total=total,
            items_snapshot=items_snapshot,
            notes=notes,
            terms=terms,
            change_summary=change_summary,
            created_by=created_by,
        )
        self.db.add(revision)
        self.db.commit()
        self.db.refresh(revision)
        return revision

    def list_revisions(
        self,
        proforma_id: UUID,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[ProformaInvoiceRevision], int]:
        """List revisions for a proforma invoice, newest first."""
        query = self.db.query(ProformaInvoiceRevision).filter(
            ProformaInvoiceRevision.proforma_id == proforma_id,
        )
        total = query.count()
        items = (
            query.order_by(ProformaInvoiceRevision.revision_number.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def get_revision(
        self,
        proforma_id: UUID,
        revision_number: int,
    ) -> Optional[ProformaInvoiceRevision]:
        """Get a specific revision by number."""
        return (
            self.db.query(ProformaInvoiceRevision)
            .filter(
                ProformaInvoiceRevision.proforma_id == proforma_id,
                ProformaInvoiceRevision.revision_number == revision_number,
            )
            .first()
        )

    def get_latest_revision(
        self, proforma_id: UUID
    ) -> Optional[ProformaInvoiceRevision]:
        """Get the most recent revision for a proforma."""
        return (
            self.db.query(ProformaInvoiceRevision)
            .filter(ProformaInvoiceRevision.proforma_id == proforma_id)
            .order_by(ProformaInvoiceRevision.revision_number.desc())
            .first()
        )

    def get_revision_count(self, proforma_id: UUID) -> int:
        """Get total number of revisions for a proforma."""
        return (
            self.db.query(func.count(ProformaInvoiceRevision.id))
            .filter(ProformaInvoiceRevision.proforma_id == proforma_id)
            .scalar()
        ) or 0
