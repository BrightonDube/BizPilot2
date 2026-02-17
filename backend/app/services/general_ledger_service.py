"""General ledger service for accounting business logic."""

from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.general_ledger import (
    AccountType,
    ChartOfAccount,
    JournalEntry,
    JournalEntryStatus,
    JournalLine,
)


class GeneralLedgerService:
    """Service for general ledger operations."""

    def __init__(self, db: Session):
        self.db = db

    # --- Chart of Accounts ---

    def create_account(
        self,
        business_id: str,
        code: str,
        name: str,
        account_type: str,
        parent_id: Optional[str] = None,
        description: Optional[str] = None,
        normal_balance: str = "debit",
    ) -> ChartOfAccount:
        """Create a new account in the chart of accounts."""
        account = ChartOfAccount(
            business_id=business_id,
            account_code=code,
            name=name,
            account_type=AccountType(account_type),
            parent_id=parent_id,
            description=description,
            normal_balance=normal_balance,
        )
        self.db.add(account)
        self.db.commit()
        self.db.refresh(account)
        return account

    def list_accounts(
        self,
        business_id: str,
        account_type: Optional[str] = None,
    ) -> List[ChartOfAccount]:
        """List accounts, optionally filtered by type."""
        query = self.db.query(ChartOfAccount).filter(
            ChartOfAccount.business_id == business_id,
            ChartOfAccount.deleted_at.is_(None),
        )
        if account_type:
            query = query.filter(ChartOfAccount.account_type == AccountType(account_type))
        return query.order_by(ChartOfAccount.account_code).all()

    def get_account(self, account_id: str, business_id: str) -> Optional[ChartOfAccount]:
        """Get a single account by ID."""
        return self.db.query(ChartOfAccount).filter(
            ChartOfAccount.id == account_id,
            ChartOfAccount.business_id == business_id,
            ChartOfAccount.deleted_at.is_(None),
        ).first()

    def get_account_balance(
        self,
        account_id: str,
        business_id: str,
        as_of: Optional[datetime] = None,
    ) -> dict:
        """Calculate an account's balance from posted journal lines."""
        account = self.get_account(account_id, business_id)
        if not account:
            return {"debit_total": Decimal("0"), "credit_total": Decimal("0"), "balance": Decimal("0")}

        query = (
            self.db.query(
                func.coalesce(func.sum(JournalLine.debit), 0).label("debit_total"),
                func.coalesce(func.sum(JournalLine.credit), 0).label("credit_total"),
            )
            .join(JournalEntry, JournalLine.entry_id == JournalEntry.id)
            .filter(
                JournalLine.account_id == account_id,
                JournalEntry.business_id == business_id,
                JournalEntry.status == JournalEntryStatus.POSTED,
                JournalEntry.deleted_at.is_(None),
                JournalLine.deleted_at.is_(None),
            )
        )
        if as_of:
            query = query.filter(JournalEntry.entry_date <= as_of)

        row = query.one()
        debit_total = Decimal(str(row.debit_total))
        credit_total = Decimal(str(row.credit_total))

        # Normal balance determines sign
        if account.normal_balance == "debit":
            balance = debit_total - credit_total
        else:
            balance = credit_total - debit_total

        return {
            "account_id": str(account.id),
            "account_code": account.account_code,
            "account_name": account.name,
            "account_type": account.account_type.value if isinstance(account.account_type, AccountType) else account.account_type,
            "debit_total": debit_total,
            "credit_total": credit_total,
            "balance": balance,
        }

    # --- Journal Entries ---

    def _next_entry_number(self, business_id: str) -> str:
        """Generate next journal entry number."""
        count = self.db.query(func.count(JournalEntry.id)).filter(
            JournalEntry.business_id == business_id,
        ).scalar() or 0
        return f"JE-{count + 1:06d}"

    def create_journal_entry(
        self,
        business_id: str,
        description: str,
        lines: list,
        user_id: Optional[str] = None,
        reference: Optional[str] = None,
        is_auto: bool = False,
    ) -> JournalEntry:
        """Create a journal entry with balanced lines.

        Args:
            lines: list of dicts with account_id, debit, credit, description.

        Raises:
            ValueError: If debits != credits or fewer than 2 lines.
        """
        if len(lines) < 2:
            raise ValueError("A journal entry must have at least 2 lines.")

        total_debit = sum(Decimal(str(ln.get("debit", 0))) for ln in lines)
        total_credit = sum(Decimal(str(ln.get("credit", 0))) for ln in lines)

        if total_debit != total_credit:
            raise ValueError(
                f"Journal entry is not balanced: debits={total_debit}, credits={total_credit}"
            )

        if total_debit == 0:
            raise ValueError("Journal entry must have non-zero amounts.")

        entry = JournalEntry(
            business_id=business_id,
            entry_number=self._next_entry_number(business_id),
            description=description,
            reference=reference,
            created_by_id=user_id,
            is_auto=is_auto,
            status=JournalEntryStatus.DRAFT,
        )
        self.db.add(entry)
        self.db.flush()  # Get entry.id

        for ln in lines:
            line = JournalLine(
                entry_id=entry.id,
                account_id=ln["account_id"],
                debit=Decimal(str(ln.get("debit", 0))),
                credit=Decimal(str(ln.get("credit", 0))),
                description=ln.get("description"),
            )
            self.db.add(line)

        self.db.commit()
        self.db.refresh(entry)
        return entry

    def post_journal_entry(
        self, entry_id: str, business_id: str, user_id: str,
    ) -> JournalEntry:
        """Post a draft journal entry."""
        entry = self.db.query(JournalEntry).filter(
            JournalEntry.id == entry_id,
            JournalEntry.business_id == business_id,
            JournalEntry.deleted_at.is_(None),
        ).first()
        if not entry:
            raise ValueError("Journal entry not found.")
        if entry.status != JournalEntryStatus.DRAFT:
            raise ValueError(f"Cannot post entry with status '{entry.status.value}'.")

        entry.status = JournalEntryStatus.POSTED
        entry.posted_by_id = user_id
        entry.posted_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def void_journal_entry(self, entry_id: str, business_id: str) -> JournalEntry:
        """Void a journal entry."""
        entry = self.db.query(JournalEntry).filter(
            JournalEntry.id == entry_id,
            JournalEntry.business_id == business_id,
            JournalEntry.deleted_at.is_(None),
        ).first()
        if not entry:
            raise ValueError("Journal entry not found.")
        if entry.status == JournalEntryStatus.VOIDED:
            raise ValueError("Entry is already voided.")

        entry.status = JournalEntryStatus.VOIDED
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def list_journal_entries(
        self,
        business_id: str,
        status: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[JournalEntry], int]:
        """List journal entries with optional filters and pagination."""
        query = self.db.query(JournalEntry).filter(
            JournalEntry.business_id == business_id,
            JournalEntry.deleted_at.is_(None),
        )
        if status:
            query = query.filter(JournalEntry.status == JournalEntryStatus(status))
        if date_from:
            query = query.filter(JournalEntry.entry_date >= date_from)
        if date_to:
            query = query.filter(JournalEntry.entry_date <= date_to)

        total = query.count()
        entries = (
            query.order_by(JournalEntry.entry_date.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return entries, total

    # --- Reports ---

    def _posted_lines_query(self, business_id: str, as_of: Optional[datetime] = None):
        """Base query for posted journal lines with account info."""
        query = (
            self.db.query(
                ChartOfAccount.id.label("account_id"),
                ChartOfAccount.account_code,
                ChartOfAccount.name.label("account_name"),
                ChartOfAccount.account_type,
                ChartOfAccount.normal_balance,
                func.coalesce(func.sum(JournalLine.debit), 0).label("total_debit"),
                func.coalesce(func.sum(JournalLine.credit), 0).label("total_credit"),
            )
            .join(JournalLine, JournalLine.account_id == ChartOfAccount.id)
            .join(JournalEntry, JournalLine.entry_id == JournalEntry.id)
            .filter(
                ChartOfAccount.business_id == business_id,
                JournalEntry.status == JournalEntryStatus.POSTED,
                JournalEntry.deleted_at.is_(None),
                JournalLine.deleted_at.is_(None),
                ChartOfAccount.deleted_at.is_(None),
            )
        )
        if as_of:
            query = query.filter(JournalEntry.entry_date <= as_of)
        return query.group_by(
            ChartOfAccount.id,
            ChartOfAccount.account_code,
            ChartOfAccount.name,
            ChartOfAccount.account_type,
            ChartOfAccount.normal_balance,
        )

    def get_trial_balance(self, business_id: str, as_of: Optional[datetime] = None) -> dict:
        """Generate trial balance report."""
        rows = self._posted_lines_query(business_id, as_of).order_by(ChartOfAccount.account_code).all()

        result_rows = []
        total_debit = Decimal("0")
        total_credit = Decimal("0")

        for row in rows:
            debit = Decimal(str(row.total_debit))
            credit = Decimal(str(row.total_credit))
            net = debit - credit
            row_debit = net if net > 0 else Decimal("0")
            row_credit = abs(net) if net < 0 else Decimal("0")
            total_debit += row_debit
            total_credit += row_credit
            acct_type = row.account_type.value if isinstance(row.account_type, AccountType) else row.account_type
            result_rows.append({
                "account_id": str(row.account_id),
                "account_code": row.account_code,
                "account_name": row.account_name,
                "account_type": acct_type,
                "debit": row_debit,
                "credit": row_credit,
            })

        return {
            "as_of": as_of or datetime.now(timezone.utc),
            "rows": result_rows,
            "total_debit": total_debit,
            "total_credit": total_credit,
        }

    def get_income_statement(
        self, business_id: str, start_date: datetime, end_date: datetime,
    ) -> dict:
        """Generate income statement (P&L) for a date range."""
        query = (
            self.db.query(
                ChartOfAccount.id.label("account_id"),
                ChartOfAccount.account_code,
                ChartOfAccount.name.label("account_name"),
                ChartOfAccount.account_type,
                ChartOfAccount.normal_balance,
                func.coalesce(func.sum(JournalLine.debit), 0).label("total_debit"),
                func.coalesce(func.sum(JournalLine.credit), 0).label("total_credit"),
            )
            .join(JournalLine, JournalLine.account_id == ChartOfAccount.id)
            .join(JournalEntry, JournalLine.entry_id == JournalEntry.id)
            .filter(
                ChartOfAccount.business_id == business_id,
                JournalEntry.status == JournalEntryStatus.POSTED,
                JournalEntry.entry_date >= start_date,
                JournalEntry.entry_date <= end_date,
                JournalEntry.deleted_at.is_(None),
                JournalLine.deleted_at.is_(None),
                ChartOfAccount.deleted_at.is_(None),
                ChartOfAccount.account_type.in_([AccountType.REVENUE, AccountType.EXPENSE]),
            )
            .group_by(
                ChartOfAccount.id,
                ChartOfAccount.account_code,
                ChartOfAccount.name,
                ChartOfAccount.account_type,
                ChartOfAccount.normal_balance,
            )
            .order_by(ChartOfAccount.account_code)
        )

        rows = query.all()
        revenue_items = []
        expense_items = []
        total_revenue = Decimal("0")
        total_expenses = Decimal("0")

        for row in rows:
            debit = Decimal(str(row.total_debit))
            credit = Decimal(str(row.total_credit))
            acct_type = row.account_type.value if isinstance(row.account_type, AccountType) else row.account_type

            if acct_type == AccountType.REVENUE.value:
                balance = credit - debit  # Revenue normal balance is credit
                total_revenue += balance
                revenue_items.append({
                    "account_id": str(row.account_id),
                    "account_code": row.account_code,
                    "account_name": row.account_name,
                    "balance": balance,
                })
            else:
                balance = debit - credit  # Expense normal balance is debit
                total_expenses += balance
                expense_items.append({
                    "account_id": str(row.account_id),
                    "account_code": row.account_code,
                    "account_name": row.account_name,
                    "balance": balance,
                })

        return {
            "start_date": start_date,
            "end_date": end_date,
            "revenue": revenue_items,
            "expenses": expense_items,
            "total_revenue": total_revenue,
            "total_expenses": total_expenses,
            "net_income": total_revenue - total_expenses,
        }

    def get_balance_sheet(self, business_id: str, as_of: Optional[datetime] = None) -> dict:
        """Generate balance sheet as of a date."""
        rows = self._posted_lines_query(business_id, as_of).order_by(ChartOfAccount.account_code).all()

        assets = []
        liabilities = []
        equity = []
        total_assets = Decimal("0")
        total_liabilities = Decimal("0")
        total_equity = Decimal("0")

        for row in rows:
            debit = Decimal(str(row.total_debit))
            credit = Decimal(str(row.total_credit))
            acct_type = row.account_type.value if isinstance(row.account_type, AccountType) else row.account_type

            item = {
                "account_id": str(row.account_id),
                "account_code": row.account_code,
                "account_name": row.account_name,
            }

            if acct_type == AccountType.ASSET.value:
                balance = debit - credit
                item["balance"] = balance
                total_assets += balance
                assets.append(item)
            elif acct_type == AccountType.LIABILITY.value:
                balance = credit - debit
                item["balance"] = balance
                total_liabilities += balance
                liabilities.append(item)
            elif acct_type == AccountType.EQUITY.value:
                balance = credit - debit
                item["balance"] = balance
                total_equity += balance
                equity.append(item)

        return {
            "as_of": as_of or datetime.now(timezone.utc),
            "assets": assets,
            "liabilities": liabilities,
            "equity": equity,
            "total_assets": total_assets,
            "total_liabilities": total_liabilities,
            "total_equity": total_equity,
        }

    # --- Seed Default Accounts ---

    def seed_default_accounts(self, business_id: str) -> List[ChartOfAccount]:
        """Seed a default chart of accounts for a business."""
        defaults = [
            # Assets
            ("1000", "Cash", AccountType.ASSET, "debit"),
            ("1100", "Accounts Receivable", AccountType.ASSET, "debit"),
            ("1200", "Inventory", AccountType.ASSET, "debit"),
            ("1300", "Prepaid Expenses", AccountType.ASSET, "debit"),
            ("1500", "Equipment", AccountType.ASSET, "debit"),
            ("1600", "Accumulated Depreciation", AccountType.ASSET, "credit"),
            # Liabilities
            ("2000", "Accounts Payable", AccountType.LIABILITY, "credit"),
            ("2100", "Accrued Liabilities", AccountType.LIABILITY, "credit"),
            ("2200", "VAT Payable", AccountType.LIABILITY, "credit"),
            ("2500", "Long-Term Loans", AccountType.LIABILITY, "credit"),
            # Equity
            ("3000", "Owner's Equity", AccountType.EQUITY, "credit"),
            ("3100", "Retained Earnings", AccountType.EQUITY, "credit"),
            # Revenue
            ("4000", "Sales Revenue", AccountType.REVENUE, "credit"),
            ("4100", "Service Revenue", AccountType.REVENUE, "credit"),
            ("4200", "Other Income", AccountType.REVENUE, "credit"),
            # Expenses
            ("5000", "Cost of Goods Sold", AccountType.EXPENSE, "debit"),
            ("5100", "Salaries & Wages", AccountType.EXPENSE, "debit"),
            ("5200", "Rent Expense", AccountType.EXPENSE, "debit"),
            ("5300", "Utilities Expense", AccountType.EXPENSE, "debit"),
            ("5400", "Depreciation Expense", AccountType.EXPENSE, "debit"),
            ("5500", "Office Supplies", AccountType.EXPENSE, "debit"),
            ("5600", "Marketing Expense", AccountType.EXPENSE, "debit"),
            ("5700", "Insurance Expense", AccountType.EXPENSE, "debit"),
            ("5800", "Bank Charges", AccountType.EXPENSE, "debit"),
        ]

        created = []
        for code, name, acct_type, normal_bal in defaults:
            # Skip if already exists
            existing = self.db.query(ChartOfAccount).filter(
                ChartOfAccount.business_id == business_id,
                ChartOfAccount.account_code == code,
                ChartOfAccount.deleted_at.is_(None),
            ).first()
            if existing:
                continue

            account = ChartOfAccount(
                business_id=business_id,
                account_code=code,
                name=name,
                account_type=acct_type,
                normal_balance=normal_bal,
            )
            self.db.add(account)
            created.append(account)

        if created:
            self.db.commit()
            for a in created:
                self.db.refresh(a)

        return created
