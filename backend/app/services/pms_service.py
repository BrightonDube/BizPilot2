"""Service layer for PMS (Property Management System) integration.

Handles connection management, charge posting, guest cache,
reconciliation, and audit logging.

Why a unified service?
Different PMS adapters (Opera, Protel, Mews, Cloudbeds) each have
their own API.  This service provides a unified interface, delegating
to adapters for the actual PMS communication.  Currently, charges are
recorded locally with status tracking — actual PMS API calls will be
added when adapter implementations are complete.
"""

from datetime import datetime, timezone, date
from decimal import Decimal
from typing import Optional, Tuple, List
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.pms import (
    PMSConnection,
    PMSGuestCache,
    PMSCharge,
    PMSChargeReversal,
    PMSReconciliationSession,
    PMSReconciliationItem,
    PMSAuditLog,
)


def _utc_now() -> datetime:
    """Return timezone-aware UTC timestamp."""
    return datetime.now(timezone.utc)


class PMSService:
    """Business logic for PMS integration operations."""

    def __init__(self, db: Session) -> None:
        self.db = db

    # -------------------------------------------------------------------
    # Audit helper — call after every mutation
    # -------------------------------------------------------------------

    def _audit(
        self,
        business_id: UUID,
        action: str,
        entity_type: str,
        entity_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
        connection_id: Optional[UUID] = None,
        details: Optional[dict] = None,
    ) -> None:
        """Insert an immutable audit log entry.

        Why inline instead of a decorator?
        Audit entries need contextual data (entity_id, action) that
        varies per call.  A decorator can't capture that cleanly.
        """
        log = PMSAuditLog(
            business_id=business_id,
            connection_id=connection_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            user_id=user_id,
            details=details,
        )
        self.db.add(log)

    # -------------------------------------------------------------------
    # Connections
    # -------------------------------------------------------------------

    def create_connection(
        self,
        business_id: UUID,
        adapter_type: str,
        connection_name: str,
        host_url: str,
        config: Optional[dict] = None,
    ) -> PMSConnection:
        """Create a new PMS connection."""
        conn = PMSConnection(
            business_id=business_id,
            adapter_type=adapter_type,
            connection_name=connection_name,
            host_url=host_url,
            config=config,
            health_status="unknown",
        )
        self.db.add(conn)
        self.db.flush()
        self._audit(
            business_id=business_id,
            action="connection_created",
            entity_type="connection",
            entity_id=conn.id,
            connection_id=conn.id,
        )
        self.db.commit()
        self.db.refresh(conn)
        return conn

    def get_connection(
        self, business_id: UUID, connection_id: UUID
    ) -> Optional[PMSConnection]:
        """Get a connection scoped to business."""
        return (
            self.db.query(PMSConnection)
            .filter(
                PMSConnection.id == connection_id,
                PMSConnection.business_id == business_id,
                PMSConnection.deleted_at.is_(None),
            )
            .first()
        )

    def list_connections(
        self,
        business_id: UUID,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[PMSConnection], int]:
        """List connections for a business."""
        query = self.db.query(PMSConnection).filter(
            PMSConnection.business_id == business_id,
            PMSConnection.deleted_at.is_(None),
        )
        total = query.count()
        items = (
            query.order_by(PMSConnection.connection_name)
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def update_connection(
        self,
        business_id: UUID,
        connection_id: UUID,
        **kwargs,
    ) -> Optional[PMSConnection]:
        """Update a PMS connection."""
        conn = self.get_connection(business_id, connection_id)
        if not conn:
            return None
        for key, value in kwargs.items():
            if value is not None:
                setattr(conn, key, value)
        conn.updated_at = _utc_now()
        self._audit(
            business_id=business_id,
            action="connection_updated",
            entity_type="connection",
            entity_id=connection_id,
            connection_id=connection_id,
            details=kwargs,
        )
        self.db.commit()
        self.db.refresh(conn)
        return conn

    def delete_connection(
        self, business_id: UUID, connection_id: UUID
    ) -> bool:
        """Soft-delete a PMS connection."""
        conn = self.get_connection(business_id, connection_id)
        if not conn:
            return False
        conn.soft_delete()
        self._audit(
            business_id=business_id,
            action="connection_deleted",
            entity_type="connection",
            entity_id=connection_id,
            connection_id=connection_id,
        )
        self.db.commit()
        return True

    # -------------------------------------------------------------------
    # Charges
    # -------------------------------------------------------------------

    def create_charge(
        self,
        business_id: UUID,
        connection_id: UUID,
        room_number: str,
        amount: Decimal,
        currency: str = "ZAR",
        guest_name: Optional[str] = None,
        folio_number: Optional[str] = None,
        description: Optional[str] = None,
        order_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
    ) -> PMSCharge:
        """Create a pending charge for posting to PMS.

        Why pending-first?
        The charge is validated and recorded locally before attempting
        the PMS API call.  This ensures we have a record even if the
        PMS is unreachable (offline-first pattern).
        """
        charge = PMSCharge(
            connection_id=connection_id,
            business_id=business_id,
            room_number=room_number,
            amount=amount,
            currency=currency,
            guest_name=guest_name,
            folio_number=folio_number,
            description=description,
            order_id=order_id,
            status="pending",
            posted_by=user_id,
        )
        self.db.add(charge)
        self.db.flush()
        self._audit(
            business_id=business_id,
            action="charge_created",
            entity_type="charge",
            entity_id=charge.id,
            user_id=user_id,
            connection_id=connection_id,
            details={"room": room_number, "amount": str(amount)},
        )
        self.db.commit()
        self.db.refresh(charge)
        return charge

    def get_charge(
        self, business_id: UUID, charge_id: UUID
    ) -> Optional[PMSCharge]:
        """Get a charge by ID."""
        return (
            self.db.query(PMSCharge)
            .filter(
                PMSCharge.id == charge_id,
                PMSCharge.business_id == business_id,
                PMSCharge.deleted_at.is_(None),
            )
            .first()
        )

    def list_charges(
        self,
        business_id: UUID,
        connection_id: Optional[UUID] = None,
        status: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[PMSCharge], int]:
        """List charges with optional filters."""
        query = self.db.query(PMSCharge).filter(
            PMSCharge.business_id == business_id,
            PMSCharge.deleted_at.is_(None),
        )
        if connection_id:
            query = query.filter(PMSCharge.connection_id == connection_id)
        if status:
            query = query.filter(PMSCharge.status == status)
        total = query.count()
        items = (
            query.order_by(PMSCharge.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    # -------------------------------------------------------------------
    # Reversals
    # -------------------------------------------------------------------

    def create_reversal(
        self,
        business_id: UUID,
        charge_id: UUID,
        reason: str,
        user_id: Optional[UUID] = None,
    ) -> Optional[PMSChargeReversal]:
        """Request reversal of a posted charge.

        Why require reason?
        Reversals affect guest billing.  A mandatory reason ensures
        accountability and supports dispute resolution.
        """
        charge = self.get_charge(business_id, charge_id)
        if not charge or charge.status != "posted":
            return None
        reversal = PMSChargeReversal(
            charge_id=charge_id,
            reason=reason,
            status="pending",
        )
        self.db.add(reversal)
        self.db.flush()
        self._audit(
            business_id=business_id,
            action="reversal_requested",
            entity_type="reversal",
            entity_id=reversal.id,
            user_id=user_id,
            connection_id=charge.connection_id,
            details={"charge_id": str(charge_id), "reason": reason},
        )
        self.db.commit()
        self.db.refresh(reversal)
        return reversal

    # -------------------------------------------------------------------
    # Guest Cache
    # -------------------------------------------------------------------

    def search_guests(
        self,
        connection_id: UUID,
        search: Optional[str] = None,
        room_number: Optional[str] = None,
    ) -> Tuple[List[PMSGuestCache], int]:
        """Search cached guests by name or room number."""
        query = self.db.query(PMSGuestCache).filter(
            PMSGuestCache.connection_id == connection_id,
            PMSGuestCache.deleted_at.is_(None),
        )
        if search:
            query = query.filter(
                PMSGuestCache.guest_name.ilike(f"%{search}%")
            )
        if room_number:
            query = query.filter(PMSGuestCache.room_number == room_number)
        items = query.order_by(PMSGuestCache.guest_name).limit(50).all()
        return items, len(items)

    # -------------------------------------------------------------------
    # Reconciliation
    # -------------------------------------------------------------------

    def start_reconciliation(
        self,
        business_id: UUID,
        connection_id: UUID,
        session_date: date,
        user_id: Optional[UUID] = None,
    ) -> PMSReconciliationSession:
        """Start a new EOD reconciliation session.

        Why separate start/complete?
        Reconciliation may take time (comparing hundreds of charges).
        Starting it creates a record immediately, and the process
        updates it as it progresses.
        """
        session = PMSReconciliationSession(
            connection_id=connection_id,
            business_id=business_id,
            session_date=session_date,
            status="in_progress",
            started_by=user_id,
        )
        self.db.add(session)
        self.db.flush()
        self._audit(
            business_id=business_id,
            action="reconciliation_started",
            entity_type="reconciliation",
            entity_id=session.id,
            user_id=user_id,
            connection_id=connection_id,
        )
        self.db.commit()
        self.db.refresh(session)
        return session

    def get_reconciliation_session(
        self, business_id: UUID, session_id: UUID
    ) -> Optional[PMSReconciliationSession]:
        """Get a reconciliation session."""
        return (
            self.db.query(PMSReconciliationSession)
            .filter(
                PMSReconciliationSession.id == session_id,
                PMSReconciliationSession.business_id == business_id,
            )
            .first()
        )

    def resolve_reconciliation_item(
        self,
        item_id: UUID,
        resolution_note: str,
        user_id: Optional[UUID] = None,
    ) -> Optional[PMSReconciliationItem]:
        """Resolve a reconciliation discrepancy."""
        item = (
            self.db.query(PMSReconciliationItem)
            .filter(PMSReconciliationItem.id == item_id)
            .first()
        )
        if not item:
            return None
        item.status = "resolved"
        item.resolution_note = resolution_note
        item.resolved_by = user_id
        item.resolved_at = _utc_now()
        item.updated_at = _utc_now()
        self.db.commit()
        self.db.refresh(item)
        return item

    # -------------------------------------------------------------------
    # Audit
    # -------------------------------------------------------------------

    def list_audit_logs(
        self,
        business_id: UUID,
        entity_type: Optional[str] = None,
        page: int = 1,
        per_page: int = 50,
    ) -> Tuple[List[PMSAuditLog], int]:
        """List audit logs with optional entity type filter."""
        query = self.db.query(PMSAuditLog).filter(
            PMSAuditLog.business_id == business_id,
        )
        if entity_type:
            query = query.filter(PMSAuditLog.entity_type == entity_type)
        total = query.count()
        items = (
            query.order_by(PMSAuditLog.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total
