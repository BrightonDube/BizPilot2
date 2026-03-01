"""Cash register service for business logic."""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.cash_register import (
    CashMovement,
    CashRegister,
    RegisterSession,
    RegisterStatus,
)


class CashRegisterService:
    """Service for cash register operations."""

    def __init__(self, db: Session):
        self.db = db

    # ---- Register CRUD ----

    def create_register(
        self,
        business_id: str,
        name: str,
        location_id: Optional[str] = None,
    ) -> CashRegister:
        """Create a new cash register."""
        register = CashRegister(
            business_id=business_id,
            name=name,
            location_id=location_id,
            is_active=True,
        )
        self.db.add(register)
        self.db.commit()
        self.db.refresh(register)
        return register

    def list_registers(self, business_id: str) -> List[CashRegister]:
        """List all active registers for a business."""
        return (
            self.db.query(CashRegister)
            .filter(
                CashRegister.business_id == business_id,
                CashRegister.deleted_at.is_(None),
            )
            .order_by(CashRegister.name)
            .all()
        )

    def update_register(
        self, register_id: str, business_id: str, **kwargs: Any
    ) -> CashRegister:
        """Update a cash register."""
        register = (
            self.db.query(CashRegister)
            .filter(
                CashRegister.id == register_id,
                CashRegister.business_id == business_id,
                CashRegister.deleted_at.is_(None),
            )
            .first()
        )
        if not register:
            raise ValueError("Register not found")
        for key, value in kwargs.items():
            if hasattr(register, key) and value is not None:
                setattr(register, key, value)
        self.db.commit()
        self.db.refresh(register)
        return register

    def delete_register(self, register_id: str, business_id: str) -> CashRegister:
        """Soft delete a cash register."""
        register = (
            self.db.query(CashRegister)
            .filter(
                CashRegister.id == register_id,
                CashRegister.business_id == business_id,
                CashRegister.deleted_at.is_(None),
            )
            .first()
        )
        if not register:
            raise ValueError("Register not found")
        register.soft_delete()
        self.db.commit()
        return register

    # ---- Session operations ----

    def open_session(
        self,
        register_id: str,
        business_id: str,
        opened_by: str,
        opening_float: Decimal = Decimal("0"),
    ) -> RegisterSession:
        """Open a new register session. Only one open session per register."""
        # Verify register exists
        register = (
            self.db.query(CashRegister)
            .filter(
                CashRegister.id == register_id,
                CashRegister.business_id == business_id,
                CashRegister.deleted_at.is_(None),
            )
            .first()
        )
        if not register:
            raise ValueError("Register not found")

        # Check no other open session on this register
        existing = (
            self.db.query(RegisterSession)
            .filter(
                RegisterSession.register_id == register_id,
                RegisterSession.status == RegisterStatus.OPEN,
                RegisterSession.deleted_at.is_(None),
            )
            .first()
        )
        if existing:
            raise ValueError("Register already has an open session")

        session = RegisterSession(
            register_id=register_id,
            business_id=business_id,
            opened_by=opened_by,
            status=RegisterStatus.OPEN,
            opening_float=opening_float,
            total_sales=Decimal("0"),
            total_refunds=Decimal("0"),
            total_cash_payments=Decimal("0"),
            total_card_payments=Decimal("0"),
            transaction_count=0,
            opened_at=datetime.now(timezone.utc),
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def close_session(
        self,
        session_id: str,
        business_id: str,
        closed_by: str,
        actual_cash: Decimal,
        notes: Optional[str] = None,
    ) -> RegisterSession:
        """Close a register session and calculate cash difference."""
        session = (
            self.db.query(RegisterSession)
            .filter(
                RegisterSession.id == session_id,
                RegisterSession.business_id == business_id,
                RegisterSession.status == RegisterStatus.OPEN,
                RegisterSession.deleted_at.is_(None),
            )
            .first()
        )
        if not session:
            raise ValueError("Open session not found")

        # Sum cash_in and cash_out movements
        cash_in = (
            self.db.query(func.coalesce(func.sum(CashMovement.amount), 0))
            .filter(
                CashMovement.session_id == session_id,
                CashMovement.movement_type.in_(["cash_in", "pay_in"]),
                CashMovement.deleted_at.is_(None),
            )
            .scalar()
        )
        cash_out = (
            self.db.query(func.coalesce(func.sum(CashMovement.amount), 0))
            .filter(
                CashMovement.session_id == session_id,
                CashMovement.movement_type.in_(["cash_out", "pay_out"]),
                CashMovement.deleted_at.is_(None),
            )
            .scalar()
        )

        expected_cash = (
            session.opening_float
            + session.total_cash_payments
            - session.total_refunds
            + Decimal(str(cash_in))
            - Decimal(str(cash_out))
        )

        session.closed_by = closed_by
        session.status = RegisterStatus.CLOSED
        session.actual_cash = actual_cash
        session.expected_cash = expected_cash
        session.cash_difference = actual_cash - expected_cash
        session.closing_float = actual_cash
        session.closed_at = datetime.now(timezone.utc)
        session.notes = notes

        self.db.commit()
        self.db.refresh(session)
        return session

    def get_session(
        self, session_id: str, business_id: str
    ) -> Optional[RegisterSession]:
        """Get a session with movements."""
        return (
            self.db.query(RegisterSession)
            .filter(
                RegisterSession.id == session_id,
                RegisterSession.business_id == business_id,
                RegisterSession.deleted_at.is_(None),
            )
            .first()
        )

    def get_active_session(
        self, register_id: str, business_id: str
    ) -> Optional[RegisterSession]:
        """Get the current open session for a register."""
        return (
            self.db.query(RegisterSession)
            .filter(
                RegisterSession.register_id == register_id,
                RegisterSession.business_id == business_id,
                RegisterSession.status == RegisterStatus.OPEN,
                RegisterSession.deleted_at.is_(None),
            )
            .first()
        )

    def list_sessions(
        self,
        business_id: str,
        register_id: Optional[str] = None,
        status: Optional[RegisterStatus] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[RegisterSession], int]:
        """List sessions with optional filters and pagination."""
        query = self.db.query(RegisterSession).filter(
            RegisterSession.business_id == business_id,
            RegisterSession.deleted_at.is_(None),
        )
        if register_id:
            query = query.filter(RegisterSession.register_id == register_id)
        if status:
            query = query.filter(RegisterSession.status == status)
        total = query.count()
        offset = (page - 1) * per_page
        items = (
            query.order_by(RegisterSession.created_at.desc())
            .offset(offset)
            .limit(per_page)
            .all()
        )
        return items, total

    # ---- Cash movement ----

    def add_cash_movement(
        self,
        session_id: str,
        business_id: str,
        movement_type: str,
        amount: Decimal,
        reason: str,
        performed_by: str,
    ) -> CashMovement:
        """Record a cash movement in a session."""
        session = (
            self.db.query(RegisterSession)
            .filter(
                RegisterSession.id == session_id,
                RegisterSession.business_id == business_id,
                RegisterSession.status == RegisterStatus.OPEN,
                RegisterSession.deleted_at.is_(None),
            )
            .first()
        )
        if not session:
            raise ValueError("Open session not found")

        movement = CashMovement(
            session_id=session_id,
            business_id=business_id,
            movement_type=movement_type,
            amount=amount,
            reason=reason,
            performed_by=performed_by,
        )
        self.db.add(movement)
        self.db.commit()
        self.db.refresh(movement)
        return movement

    # ---- Sale recording ----

    def record_sale(
        self,
        session_id: str,
        amount: Decimal,
        payment_method: str,
    ) -> RegisterSession:
        """Update session totals after a sale."""
        session = (
            self.db.query(RegisterSession)
            .filter(
                RegisterSession.id == session_id,
                RegisterSession.status == RegisterStatus.OPEN,
                RegisterSession.deleted_at.is_(None),
            )
            .first()
        )
        if not session:
            raise ValueError("Open session not found")

        session.total_sales += amount
        session.transaction_count += 1

        if payment_method == "cash":
            session.total_cash_payments += amount
        elif payment_method == "card":
            session.total_card_payments += amount

        self.db.commit()
        self.db.refresh(session)
        return session

    # ---- Reporting ----

    def get_register_report(
        self,
        business_id: str,
        register_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """Generate a register report."""
        query = self.db.query(RegisterSession).filter(
            RegisterSession.business_id == business_id,
            RegisterSession.status == RegisterStatus.CLOSED,
            RegisterSession.deleted_at.is_(None),
        )
        if register_id:
            query = query.filter(RegisterSession.register_id == register_id)
        if start_date:
            query = query.filter(RegisterSession.opened_at >= start_date)
        if end_date:
            query = query.filter(RegisterSession.closed_at <= end_date)

        total_sessions = query.count()
        total_sales = (
            self.db.query(func.coalesce(func.sum(RegisterSession.total_sales), 0))
            .filter(
                RegisterSession.business_id == business_id,
                RegisterSession.status == RegisterStatus.CLOSED,
                RegisterSession.deleted_at.is_(None),
                *([RegisterSession.register_id == register_id] if register_id else []),
                *([RegisterSession.opened_at >= start_date] if start_date else []),
                *([RegisterSession.closed_at <= end_date] if end_date else []),
            )
            .scalar()
        )
        avg_cash_difference = (
            self.db.query(func.coalesce(func.avg(RegisterSession.cash_difference), 0))
            .filter(
                RegisterSession.business_id == business_id,
                RegisterSession.status == RegisterStatus.CLOSED,
                RegisterSession.deleted_at.is_(None),
                *([RegisterSession.register_id == register_id] if register_id else []),
                *([RegisterSession.opened_at >= start_date] if start_date else []),
                *([RegisterSession.closed_at <= end_date] if end_date else []),
            )
            .scalar()
        )
        sessions_with_discrepancy = (
            self.db.query(func.count(RegisterSession.id))
            .filter(
                RegisterSession.business_id == business_id,
                RegisterSession.status == RegisterStatus.CLOSED,
                RegisterSession.cash_difference != 0,
                RegisterSession.cash_difference.isnot(None),
                RegisterSession.deleted_at.is_(None),
                *([RegisterSession.register_id == register_id] if register_id else []),
                *([RegisterSession.opened_at >= start_date] if start_date else []),
                *([RegisterSession.closed_at <= end_date] if end_date else []),
            )
            .scalar()
        )

        return {
            "business_id": business_id,
            "total_sessions": total_sessions,
            "total_sales": Decimal(str(total_sales)),
            "avg_cash_difference": Decimal(str(avg_cash_difference)),
            "sessions_with_discrepancy": sessions_with_discrepancy,
        }
