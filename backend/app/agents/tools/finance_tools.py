"""
backend/app/agents/tools/finance_tools.py

Tool wrappers for General Ledger, Petty Cash, and Expenses.
"""

import asyncio
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.user import User
from app.agents.tools.common import get_business_id_for_user


async def get_gl_accounts(
    db: Session, user: User, account_type: Optional[str] = None
) -> Dict[str, Any]:
    """List general ledger chart of accounts."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    try:
        from app.services.general_ledger_service import GeneralLedgerService

        svc = GeneralLedgerService(db)
        accounts = await asyncio.to_thread(
            svc.list_accounts, business_id=business_id, account_type=account_type
        )
        return {
            "total": len(accounts),
            "accounts": [
                {
                    "id": str(a.id),
                    "code": a.code,
                    "name": a.name,
                    "account_type": a.account_type,
                    "is_active": a.is_active,
                }
                for a in accounts
            ],
        }
    except Exception as e:
        return {"error": f"Failed to list GL accounts: {str(e)}"}


async def get_gl_balance(
    db: Session, user: User, account_id: str
) -> Dict[str, Any]:
    """Get the balance of a specific GL account."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    try:
        from app.services.general_ledger_service import GeneralLedgerService

        svc = GeneralLedgerService(db)
        balance = await asyncio.to_thread(
            svc.get_account_balance, account_id=account_id, business_id=business_id
        )
        return balance
    except Exception as e:
        return {"error": f"Failed to get GL balance: {str(e)}"}


async def create_journal_entry(
    db: Session,
    user: User,
    description: str,
    lines: list,
    reference: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create a journal entry. HITL — requires approval.
    lines: [{"account_id": "...", "debit": 100.0, "credit": 0.0}, ...]
    """
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    try:
        from app.services.general_ledger_service import GeneralLedgerService

        svc = GeneralLedgerService(db)
        entry = await asyncio.to_thread(
            svc.create_journal_entry,
            business_id=business_id,
            description=description,
            lines=lines,
            user_id=str(user.id),
            reference=reference,
        )
        return {
            "created": True,
            "entry_id": str(entry.id),
            "description": description,
            "message": f"Journal entry created: {description}",
        }
    except Exception as e:
        return {"error": f"Failed to create journal entry: {str(e)}"}


async def get_petty_cash_balance(
    db: Session, user: User, fund_id: Optional[str] = None
) -> Dict[str, Any]:
    """Get petty cash fund balance."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    try:
        from app.services.petty_cash_service import PettyCashService

        svc = PettyCashService(db)
        if fund_id:
            fund = await asyncio.to_thread(
                svc.get_fund, fund_id=fund_id, business_id=business_id
            )
            if not fund:
                return {"error": f"Fund '{fund_id}' not found"}
            return {
                "fund_id": str(fund.id),
                "name": fund.name,
                "float_amount": float(fund.float_amount or 0),
                "current_balance": float(fund.current_balance or 0),
            }
        else:
            funds = await asyncio.to_thread(
                svc.list_funds, business_id=business_id
            )
            return {
                "funds": [
                    {
                        "id": str(f.id),
                        "name": f.name,
                        "float_amount": float(f.float_amount or 0),
                        "current_balance": float(f.current_balance or 0),
                    }
                    for f in funds
                ]
            }
    except Exception as e:
        return {"error": f"Failed to get petty cash: {str(e)}"}


async def record_petty_cash(
    db: Session,
    user: User,
    fund_id: str,
    amount: float,
    description: str,
    vendor: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Record a petty cash expense. HITL — requires approval.
    """
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    try:
        from app.services.petty_cash_service import PettyCashService

        svc = PettyCashService(db)
        expense = await asyncio.to_thread(
            svc.submit_expense,
            fund_id=fund_id,
            business_id=business_id,
            user_id=str(user.id),
            amount=Decimal(str(amount)),
            description=description,
            vendor=vendor,
        )
        return {
            "created": True,
            "expense_id": str(expense.id),
            "amount": float(amount),
            "description": description,
            "message": f"Petty cash expense of R{amount:,.2f} recorded.",
        }
    except Exception as e:
        return {"error": f"Failed to record petty cash: {str(e)}"}


async def get_expense_summary(
    db: Session,
    user: User,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Dict[str, Any]:
    """Get expense summary for a period."""
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    try:
        from app.services.expense_service import ExpenseService

        svc = ExpenseService(db)

        start = datetime.strptime(start_date, "%Y-%m-%d").date() if start_date else None
        end = datetime.strptime(end_date, "%Y-%m-%d").date() if end_date else None

        summary = await asyncio.to_thread(
            svc.get_summary,
            business_id=UUID(business_id),
            start_date=start,
            end_date=end,
        )
        return summary
    except Exception as e:
        return {"error": f"Failed to get expense summary: {str(e)}"}


async def create_expense(
    db: Session,
    user: User,
    amount: float,
    description: str,
    vendor: Optional[str] = None,
    payment_method: Optional[str] = None,
    expense_date: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create an expense record. HITL — requires approval.
    """
    business_id = await asyncio.to_thread(get_business_id_for_user, db, user)
    if not business_id:
        return {"error": "No business found for user"}

    try:
        from app.services.expense_service import ExpenseService

        svc = ExpenseService(db)
        exp_date = datetime.strptime(expense_date, "%Y-%m-%d").date() if expense_date else None

        expense = await asyncio.to_thread(
            svc.create_expense,
            business_id=UUID(business_id),
            submitted_by=UUID(str(user.id)),
            amount=Decimal(str(amount)),
            description=description,
            vendor=vendor,
            expense_date=exp_date,
            payment_method=payment_method,
        )
        return {
            "created": True,
            "expense_id": str(expense.id),
            "amount": float(amount),
            "description": description,
            "message": f"Expense of R{amount:,.2f} created.",
        }
    except Exception as e:
        return {"error": f"Failed to create expense: {str(e)}"}
