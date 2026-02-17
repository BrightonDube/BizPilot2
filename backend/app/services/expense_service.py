"""Expense tracking service."""

from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from app.models.expense import Expense, ExpenseTrackingCategory, ExpenseTrackingStatus


class ExpenseService:
    """Service for expense tracking operations."""

    def __init__(self, db: Session):
        self.db = db

    # ---- Categories ----

    def create_category(
        self,
        business_id: UUID,
        name: str,
        description: Optional[str] = None,
        budget_limit: Optional[Decimal] = None,
    ) -> ExpenseTrackingCategory:
        """Create an expense category."""
        category = ExpenseTrackingCategory(
            business_id=business_id,
            name=name,
            description=description,
            budget_limit=budget_limit,
        )
        self.db.add(category)
        self.db.commit()
        self.db.refresh(category)
        return category

    def list_categories(self, business_id: UUID) -> List[ExpenseTrackingCategory]:
        """List active expense categories for a business."""
        return (
            self.db.query(ExpenseTrackingCategory)
            .filter(
                ExpenseTrackingCategory.business_id == business_id,
                ExpenseTrackingCategory.is_active.is_(True),
                ExpenseTrackingCategory.deleted_at.is_(None),
            )
            .order_by(ExpenseTrackingCategory.name)
            .all()
        )

    def update_category(
        self,
        category_id: UUID,
        business_id: UUID,
        **kwargs: Any,
    ) -> Optional[ExpenseTrackingCategory]:
        """Update an expense category."""
        category = (
            self.db.query(ExpenseTrackingCategory)
            .filter(
                ExpenseTrackingCategory.id == category_id,
                ExpenseTrackingCategory.business_id == business_id,
                ExpenseTrackingCategory.deleted_at.is_(None),
            )
            .first()
        )
        if not category:
            return None
        for key, value in kwargs.items():
            if hasattr(category, key):
                setattr(category, key, value)
        self.db.commit()
        self.db.refresh(category)
        return category

    def delete_category(
        self, category_id: UUID, business_id: UUID
    ) -> bool:
        """Soft-delete an expense category."""
        category = (
            self.db.query(ExpenseTrackingCategory)
            .filter(
                ExpenseTrackingCategory.id == category_id,
                ExpenseTrackingCategory.business_id == business_id,
                ExpenseTrackingCategory.deleted_at.is_(None),
            )
            .first()
        )
        if not category:
            return False
        category.soft_delete()
        self.db.commit()
        return True

    # ---- Expenses ----

    def create_expense(
        self,
        business_id: UUID,
        submitted_by: UUID,
        amount: Decimal,
        description: str,
        category_id: Optional[UUID] = None,
        vendor: Optional[str] = None,
        expense_date: Optional[date] = None,
        payment_method: Optional[str] = None,
        receipt_url: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> Expense:
        """Create a new expense."""
        expense = Expense(
            business_id=business_id,
            submitted_by=submitted_by,
            amount=amount,
            description=description,
            category_id=category_id,
            vendor=vendor,
            expense_date=expense_date or date.today(),
            payment_method=payment_method,
            receipt_url=receipt_url,
            notes=notes,
        )
        self.db.add(expense)
        self.db.commit()
        self.db.refresh(expense)
        return expense

    def list_expenses(
        self,
        business_id: UUID,
        category_id: Optional[UUID] = None,
        status: Optional[ExpenseTrackingStatus] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[Expense], int]:
        """List expenses with filters and pagination."""
        query = self.db.query(Expense).filter(
            Expense.business_id == business_id,
            Expense.deleted_at.is_(None),
        )
        if category_id:
            query = query.filter(Expense.category_id == category_id)
        if status:
            query = query.filter(Expense.status == status)
        if start_date:
            query = query.filter(Expense.expense_date >= start_date)
        if end_date:
            query = query.filter(Expense.expense_date <= end_date)

        total = query.count()
        items = (
            query.order_by(Expense.expense_date.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def get_expense(
        self, expense_id: UUID, business_id: UUID
    ) -> Optional[Expense]:
        """Get a single expense by ID."""
        return (
            self.db.query(Expense)
            .filter(
                Expense.id == expense_id,
                Expense.business_id == business_id,
                Expense.deleted_at.is_(None),
            )
            .first()
        )

    def update_expense(
        self,
        expense_id: UUID,
        business_id: UUID,
        **kwargs: Any,
    ) -> Optional[Expense]:
        """Update an expense."""
        expense = self.get_expense(expense_id, business_id)
        if not expense:
            return None
        for key, value in kwargs.items():
            if hasattr(expense, key):
                setattr(expense, key, value)
        self.db.commit()
        self.db.refresh(expense)
        return expense

    def approve_expense(
        self,
        expense_id: UUID,
        business_id: UUID,
        approved_by: UUID,
    ) -> Optional[Expense]:
        """Approve an expense."""
        expense = self.get_expense(expense_id, business_id)
        if not expense:
            return None
        expense.status = ExpenseTrackingStatus.APPROVED
        expense.approved_by = approved_by
        self.db.commit()
        self.db.refresh(expense)
        return expense

    def reject_expense(
        self, expense_id: UUID, business_id: UUID
    ) -> Optional[Expense]:
        """Reject an expense."""
        expense = self.get_expense(expense_id, business_id)
        if not expense:
            return None
        expense.status = ExpenseTrackingStatus.REJECTED
        self.db.commit()
        self.db.refresh(expense)
        return expense

    def mark_paid(
        self, expense_id: UUID, business_id: UUID
    ) -> Optional[Expense]:
        """Mark an expense as paid."""
        expense = self.get_expense(expense_id, business_id)
        if not expense:
            return None
        expense.status = ExpenseTrackingStatus.PAID
        self.db.commit()
        self.db.refresh(expense)
        return expense

    def delete_expense(
        self, expense_id: UUID, business_id: UUID
    ) -> bool:
        """Soft-delete an expense."""
        expense = self.get_expense(expense_id, business_id)
        if not expense:
            return False
        expense.soft_delete()
        self.db.commit()
        return True

    def get_summary(
        self,
        business_id: UUID,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> Dict[str, Any]:
        """Get expense summary with totals by category, status, and month."""
        base = self.db.query(Expense).filter(
            Expense.business_id == business_id,
            Expense.deleted_at.is_(None),
        )
        if start_date:
            base = base.filter(Expense.expense_date >= start_date)
        if end_date:
            base = base.filter(Expense.expense_date <= end_date)

        # Total
        total = base.with_entities(func.coalesce(func.sum(Expense.amount), 0)).scalar()

        # By category
        by_category_rows = (
            base.with_entities(
                ExpenseTrackingCategory.name,
                func.sum(Expense.amount),
            )
            .outerjoin(ExpenseTrackingCategory, Expense.category_id == ExpenseTrackingCategory.id)
            .group_by(ExpenseTrackingCategory.name)
            .all()
        )
        by_category = [
            {"category": name or "Uncategorised", "total": float(amt)}
            for name, amt in by_category_rows
        ]

        # By status
        by_status_rows = (
            base.with_entities(Expense.status, func.sum(Expense.amount))
            .group_by(Expense.status)
            .all()
        )
        by_status = [
            {"status": s.value, "total": float(amt)}
            for s, amt in by_status_rows
        ]

        # By month
        by_month_rows = (
            base.with_entities(
                extract("year", Expense.expense_date),
                extract("month", Expense.expense_date),
                func.sum(Expense.amount),
            )
            .group_by(
                extract("year", Expense.expense_date),
                extract("month", Expense.expense_date),
            )
            .order_by(
                extract("year", Expense.expense_date),
                extract("month", Expense.expense_date),
            )
            .all()
        )
        by_month = [
            {"year": int(y), "month": int(m), "total": float(amt)}
            for y, m, amt in by_month_rows
        ]

        return {
            "total": float(total),
            "by_category": by_category,
            "by_status": by_status,
            "by_month": by_month,
        }
