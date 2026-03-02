"""Petty cash service for business logic."""

from decimal import Decimal
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.petty_cash import (
    ExpenseCategory,
    ExpenseStatus,
    FundReplenishment,
    FundStatus,
    PettyCashExpense,
    PettyCashFund,
    CashDisbursement,
    DisbursementStatus,
    ExpenseReceipt,
    FundReconciliation,
    ReconciliationStatus,
)


class PettyCashService:
    """Service for petty cash operations."""

    def __init__(self, db: Session):
        self.db = db

    # ---- Fund operations ----

    def create_fund(
        self,
        business_id: str,
        name: str,
        initial_amount: Decimal,
        custodian_id: Optional[str] = None,
    ) -> PettyCashFund:
        """Create a new petty cash fund."""
        fund = PettyCashFund(
            business_id=business_id,
            name=name,
            initial_amount=initial_amount,
            current_balance=initial_amount,
            custodian_id=custodian_id,
            status=FundStatus.ACTIVE,
        )
        self.db.add(fund)
        self.db.commit()
        self.db.refresh(fund)
        return fund

    def get_fund(self, fund_id: str, business_id: str) -> Optional[PettyCashFund]:
        """Get a fund by ID."""
        return self.db.query(PettyCashFund).filter(
            PettyCashFund.id == fund_id,
            PettyCashFund.business_id == business_id,
            PettyCashFund.deleted_at.is_(None),
        ).first()

    def list_funds(
        self, business_id: str, page: int = 1, per_page: int = 20
    ) -> Tuple[List[PettyCashFund], int]:
        """List funds with pagination."""
        query = self.db.query(PettyCashFund).filter(
            PettyCashFund.business_id == business_id,
            PettyCashFund.deleted_at.is_(None),
        )
        total = query.count()
        offset = (page - 1) * per_page
        items = query.order_by(PettyCashFund.created_at.desc()).offset(offset).limit(per_page).all()
        return items, total

    # ---- Category operations ----

    def create_category(
        self,
        business_id: str,
        name: str,
        description: Optional[str] = None,
        gl_account_code: Optional[str] = None,
    ) -> ExpenseCategory:
        """Create an expense category."""
        category = ExpenseCategory(
            business_id=business_id,
            name=name,
            description=description,
            gl_account_code=gl_account_code,
            is_active=True,
        )
        self.db.add(category)
        self.db.commit()
        self.db.refresh(category)
        return category

    def list_categories(self, business_id: str) -> List[ExpenseCategory]:
        """List active expense categories."""
        return self.db.query(ExpenseCategory).filter(
            ExpenseCategory.business_id == business_id,
            ExpenseCategory.is_active.is_(True),
            ExpenseCategory.deleted_at.is_(None),
        ).order_by(ExpenseCategory.name).all()

    # ---- Expense operations ----

    def submit_expense(
        self,
        fund_id: str,
        business_id: str,
        user_id: str,
        amount: Decimal,
        description: str,
        category_id: Optional[str] = None,
        vendor: Optional[str] = None,
        receipt_number: Optional[str] = None,
    ) -> PettyCashExpense:
        """Submit a new expense request."""
        fund = self.get_fund(fund_id, business_id)
        if not fund:
            raise ValueError("Fund not found")
        if fund.status != FundStatus.ACTIVE:
            raise ValueError("Fund is not active")

        expense = PettyCashExpense(
            fund_id=fund_id,
            business_id=business_id,
            requested_by_id=user_id,
            amount=amount,
            description=description,
            category_id=category_id,
            vendor=vendor,
            receipt_number=receipt_number,
            status=ExpenseStatus.PENDING,
        )
        self.db.add(expense)
        self.db.commit()
        self.db.refresh(expense)
        return expense

    def approve_expense(
        self, expense_id: str, business_id: str, approver_id: str
    ) -> PettyCashExpense:
        """Approve an expense and deduct from fund balance."""
        expense = self.db.query(PettyCashExpense).filter(
            PettyCashExpense.id == expense_id,
            PettyCashExpense.business_id == business_id,
            PettyCashExpense.deleted_at.is_(None),
        ).first()
        if not expense:
            raise ValueError("Expense not found")
        if expense.status != ExpenseStatus.PENDING:
            raise ValueError("Expense is not in pending status")

        fund = self.get_fund(str(expense.fund_id), business_id)
        if not fund:
            raise ValueError("Fund not found")
        if fund.current_balance < expense.amount:
            raise ValueError("Insufficient fund balance")

        expense.status = ExpenseStatus.APPROVED
        expense.approved_by_id = approver_id
        fund.current_balance -= expense.amount

        self.db.commit()
        self.db.refresh(expense)
        return expense

    def reject_expense(
        self, expense_id: str, business_id: str, approver_id: str, reason: str
    ) -> PettyCashExpense:
        """Reject an expense."""
        expense = self.db.query(PettyCashExpense).filter(
            PettyCashExpense.id == expense_id,
            PettyCashExpense.business_id == business_id,
            PettyCashExpense.deleted_at.is_(None),
        ).first()
        if not expense:
            raise ValueError("Expense not found")
        if expense.status != ExpenseStatus.PENDING:
            raise ValueError("Expense is not in pending status")

        expense.status = ExpenseStatus.REJECTED
        expense.approved_by_id = approver_id
        expense.rejection_reason = reason

        self.db.commit()
        self.db.refresh(expense)
        return expense

    def list_expenses(
        self,
        fund_id: str,
        business_id: str,
        status: Optional[ExpenseStatus] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[PettyCashExpense], int]:
        """List expenses for a fund with optional status filter."""
        query = self.db.query(PettyCashExpense).filter(
            PettyCashExpense.fund_id == fund_id,
            PettyCashExpense.business_id == business_id,
            PettyCashExpense.deleted_at.is_(None),
        )
        if status:
            query = query.filter(PettyCashExpense.status == status)
        total = query.count()
        offset = (page - 1) * per_page
        items = query.order_by(PettyCashExpense.created_at.desc()).offset(offset).limit(per_page).all()
        return items, total

    # ---- Replenishment ----

    def replenish_fund(
        self,
        fund_id: str,
        business_id: str,
        amount: Decimal,
        user_id: str,
        notes: Optional[str] = None,
    ) -> FundReplenishment:
        """Replenish a fund."""
        fund = self.get_fund(fund_id, business_id)
        if not fund:
            raise ValueError("Fund not found")

        replenishment = FundReplenishment(
            fund_id=fund_id,
            business_id=business_id,
            amount=amount,
            replenished_by_id=user_id,
            notes=notes,
        )
        fund.current_balance += amount

        self.db.add(replenishment)
        self.db.commit()
        self.db.refresh(replenishment)
        return replenishment

    # ---- Summaries / Reports ----

    def get_fund_summary(self, fund_id: str, business_id: str) -> Dict:
        """Get summary for a specific fund."""
        fund = self.get_fund(fund_id, business_id)
        if not fund:
            raise ValueError("Fund not found")

        total_expenses = (
            self.db.query(func.coalesce(func.sum(PettyCashExpense.amount), 0))
            .filter(
                PettyCashExpense.fund_id == fund_id,
                PettyCashExpense.business_id == business_id,
                PettyCashExpense.status == ExpenseStatus.APPROVED,
                PettyCashExpense.deleted_at.is_(None),
            )
            .scalar()
        )

        total_replenishments = (
            self.db.query(func.coalesce(func.sum(FundReplenishment.amount), 0))
            .filter(
                FundReplenishment.fund_id == fund_id,
                FundReplenishment.business_id == business_id,
                FundReplenishment.deleted_at.is_(None),
            )
            .scalar()
        )

        pending_count = (
            self.db.query(func.count(PettyCashExpense.id))
            .filter(
                PettyCashExpense.fund_id == fund_id,
                PettyCashExpense.business_id == business_id,
                PettyCashExpense.status == ExpenseStatus.PENDING,
                PettyCashExpense.deleted_at.is_(None),
            )
            .scalar()
        )

        approved_count = (
            self.db.query(func.count(PettyCashExpense.id))
            .filter(
                PettyCashExpense.fund_id == fund_id,
                PettyCashExpense.business_id == business_id,
                PettyCashExpense.status == ExpenseStatus.APPROVED,
                PettyCashExpense.deleted_at.is_(None),
            )
            .scalar()
        )

        return {
            "fund_id": fund.id,
            "fund_name": fund.name,
            "initial_amount": fund.initial_amount,
            "current_balance": fund.current_balance,
            "total_expenses": total_expenses,
            "total_replenishments": total_replenishments,
            "pending_expenses": pending_count,
            "approved_expenses": approved_count,
        }

    def get_expense_report(
        self, business_id: str, date_from: datetime, date_to: datetime
    ) -> Dict:
        """Expense report grouped by category for a date range."""
        rows = (
            self.db.query(
                PettyCashExpense.category_id,
                ExpenseCategory.name.label("category_name"),
                func.sum(PettyCashExpense.amount).label("total"),
                func.count(PettyCashExpense.id).label("count"),
            )
            .outerjoin(ExpenseCategory, PettyCashExpense.category_id == ExpenseCategory.id)
            .filter(
                PettyCashExpense.business_id == business_id,
                PettyCashExpense.status == ExpenseStatus.APPROVED,
                PettyCashExpense.expense_date >= date_from,
                PettyCashExpense.expense_date <= date_to,
                PettyCashExpense.deleted_at.is_(None),
            )
            .group_by(PettyCashExpense.category_id, ExpenseCategory.name)
            .all()
        )

        by_category = []
        grand_total = Decimal("0")
        for row in rows:
            total = row.total or Decimal("0")
            grand_total += total
            by_category.append(
                {
                    "category_id": row.category_id,
                    "category_name": row.category_name or "Uncategorized",
                    "total": total,
                    "count": row.count,
                }
            )

        return {
            "business_id": business_id,
            "date_from": date_from,
            "date_to": date_to,
            "total_expenses": grand_total,
            "by_category": by_category,
        }

    # ------------------------------------------------------------------
    # Disbursement operations (migration 097)
    # ------------------------------------------------------------------

    def create_disbursement(
        self,
        fund_id: str,
        expense_id: Optional[str],
        amount: Decimal,
        recipient_id: str,
        disbursed_by: str,
        notes: Optional[str] = None,
    ) -> CashDisbursement:
        """
        Record a cash disbursement from a fund.

        Generates a sequential disbursement number and links to the
        expense record if provided.
        """
        # Generate disbursement number
        count = self.db.query(func.count(CashDisbursement.id)).filter(
            CashDisbursement.fund_id == fund_id
        ).scalar() or 0
        disb_number = f"DISB-{count + 1:05d}"

        disbursement = CashDisbursement(
            fund_id=fund_id,
            expense_id=expense_id,
            disbursement_number=disb_number,
            amount=amount,
            recipient_id=recipient_id,
            disbursed_by=disbursed_by,
            disbursed_at=datetime.utcnow(),
            status=DisbursementStatus.PENDING.value,
            notes=notes,
        )
        self.db.add(disbursement)
        self.db.commit()
        self.db.refresh(disbursement)
        return disbursement

    def list_disbursements(
        self,
        fund_id: str,
        status: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[CashDisbursement], int]:
        """List disbursements for a fund with optional status filter."""
        query = self.db.query(CashDisbursement).filter(
            CashDisbursement.fund_id == fund_id,
            CashDisbursement.deleted_at.is_(None),
        )
        if status:
            query = query.filter(CashDisbursement.status == status)

        total = query.count()
        items = (
            query.order_by(CashDisbursement.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def complete_disbursement(self, disbursement_id: str) -> Optional[CashDisbursement]:
        """Mark a disbursement as completed (cash received by recipient)."""
        disb = self.db.query(CashDisbursement).filter(
            CashDisbursement.id == disbursement_id,
            CashDisbursement.deleted_at.is_(None),
        ).first()
        if not disb or disb.status != DisbursementStatus.PENDING.value:
            return None
        disb.status = DisbursementStatus.COMPLETED.value
        disb.completed_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(disb)
        return disb

    # ------------------------------------------------------------------
    # Receipt operations (migration 097)
    # ------------------------------------------------------------------

    def add_receipt(
        self,
        expense_id: str,
        receipt_number: Optional[str] = None,
        vendor_name: Optional[str] = None,
        receipt_amount: Optional[Decimal] = None,
        tax_amount: Optional[Decimal] = None,
        image_url: Optional[str] = None,
        image_filename: Optional[str] = None,
    ) -> ExpenseReceipt:
        """Attach a receipt to an expense for verification."""
        receipt = ExpenseReceipt(
            expense_id=expense_id,
            receipt_number=receipt_number,
            vendor_name=vendor_name,
            receipt_amount=receipt_amount,
            tax_amount=tax_amount,
            image_url=image_url,
            image_filename=image_filename,
            status="pending",
        )
        self.db.add(receipt)
        self.db.commit()
        self.db.refresh(receipt)
        return receipt

    def validate_receipt(
        self,
        receipt_id: str,
        validated_by: str,
        is_valid: bool,
        notes: Optional[str] = None,
    ) -> Optional[ExpenseReceipt]:
        """Validate or reject a receipt."""
        receipt = self.db.query(ExpenseReceipt).filter(
            ExpenseReceipt.id == receipt_id,
            ExpenseReceipt.deleted_at.is_(None),
        ).first()
        if not receipt:
            return None
        receipt.is_validated = is_valid
        receipt.validated_by = validated_by
        receipt.validated_at = datetime.utcnow()
        receipt.validation_notes = notes
        receipt.status = "validated" if is_valid else "rejected"
        self.db.commit()
        self.db.refresh(receipt)
        return receipt

    def list_receipts(self, expense_id: str) -> List[ExpenseReceipt]:
        """List all receipts for an expense."""
        return (
            self.db.query(ExpenseReceipt)
            .filter(
                ExpenseReceipt.expense_id == expense_id,
                ExpenseReceipt.deleted_at.is_(None),
            )
            .order_by(ExpenseReceipt.created_at.asc())
            .all()
        )

    # ------------------------------------------------------------------
    # Reconciliation operations (migration 097)
    # ------------------------------------------------------------------

    def create_reconciliation(
        self,
        fund_id: str,
        actual_balance: Decimal,
        performed_by: str,
        notes: Optional[str] = None,
    ) -> FundReconciliation:
        """
        Create a fund reconciliation by comparing expected vs actual balance.

        Expected balance is computed from the fund's current balance field.
        Variance = actual - expected (positive = surplus, negative = shortage).
        """
        fund = self.db.query(PettyCashFund).filter(
            PettyCashFund.id == fund_id,
        ).first()
        expected = fund.current_balance if fund else Decimal("0")
        variance = actual_balance - expected

        # Generate reconciliation number
        count = self.db.query(func.count(FundReconciliation.id)).filter(
            FundReconciliation.fund_id == fund_id,
        ).scalar() or 0
        recon_number = f"RECON-{count + 1:05d}"

        status = (
            ReconciliationStatus.APPROVED.value
            if variance == Decimal("0")
            else ReconciliationStatus.DISCREPANCY.value
        )

        recon = FundReconciliation(
            fund_id=fund_id,
            reconciliation_number=recon_number,
            reconciliation_date=datetime.utcnow().date(),
            expected_balance=expected,
            actual_balance=actual_balance,
            variance=variance,
            status=status,
            performed_by=performed_by,
            notes=notes,
        )
        self.db.add(recon)
        self.db.commit()
        self.db.refresh(recon)
        return recon

    def list_reconciliations(
        self,
        fund_id: str,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[FundReconciliation], int]:
        """List reconciliations for a fund, most recent first."""
        query = self.db.query(FundReconciliation).filter(
            FundReconciliation.fund_id == fund_id,
            FundReconciliation.deleted_at.is_(None),
        )
        total = query.count()
        items = (
            query.order_by(FundReconciliation.reconciliation_date.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def approve_reconciliation_variance(
        self,
        reconciliation_id: str,
        approved_by: str,
        reason: Optional[str] = None,
    ) -> Optional[FundReconciliation]:
        """Approve a reconciliation variance (e.g., manager sign-off on shortage)."""
        recon = self.db.query(FundReconciliation).filter(
            FundReconciliation.id == reconciliation_id,
            FundReconciliation.deleted_at.is_(None),
        ).first()
        if not recon or recon.status != ReconciliationStatus.DISCREPANCY.value:
            return None
        recon.status = ReconciliationStatus.APPROVED.value
        recon.variance_approved_by = approved_by
        recon.variance_approved_at = datetime.utcnow()
        if reason:
            recon.variance_reason = reason
        self.db.commit()
        self.db.refresh(recon)
        return recon
