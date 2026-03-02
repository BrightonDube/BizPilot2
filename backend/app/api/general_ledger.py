"""General ledger API endpoints."""

import math
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.database import get_sync_db
from app.api.deps import get_current_active_user, get_current_business_id
from app.models.user import User
from app.schemas.general_ledger import (
    AccountBalanceResponse,
    AccountBalanceListResponse,
    AccountCreate,
    AccountListResponse,
    AccountResponse,
    BalanceSheetResponse,
    IncomeStatementResponse,
    JournalEntryCreate,
    JournalEntryListResponse,
    JournalEntryResponse,
    JournalLineResponse,
    RecurringEntryCreate,
    RecurringEntryUpdate,
    RecurringEntryResponse,
    RecurringEntryListResponse,
    GLAuditLogResponse,
    GLAuditLogListResponse,
    TrialBalanceResponse,
)
from app.services.general_ledger_service import GeneralLedgerService

router = APIRouter(prefix="/ledger", tags=["General Ledger"])


def _account_to_response(account) -> AccountResponse:
    return AccountResponse(
        id=str(account.id),
        business_id=str(account.business_id),
        account_code=account.account_code,
        name=account.name,
        account_type=account.account_type.value if hasattr(account.account_type, "value") else account.account_type,
        parent_id=str(account.parent_id) if account.parent_id else None,
        description=account.description,
        is_active=account.is_active,
        normal_balance=account.normal_balance,
        created_at=account.created_at,
        updated_at=account.updated_at,
    )


def _entry_to_response(entry) -> JournalEntryResponse:
    lines = []
    for ln in (entry.lines or []):
        lines.append(JournalLineResponse(
            id=str(ln.id),
            account_id=str(ln.account_id),
            account_code=ln.account.account_code if ln.account else None,
            account_name=ln.account.name if ln.account else None,
            debit=ln.debit,
            credit=ln.credit,
            description=ln.description,
        ))
    return JournalEntryResponse(
        id=str(entry.id),
        business_id=str(entry.business_id),
        entry_number=entry.entry_number,
        entry_date=entry.entry_date,
        description=entry.description,
        reference=entry.reference,
        status=entry.status.value if hasattr(entry.status, "value") else entry.status,
        is_auto=entry.is_auto,
        created_by_id=str(entry.created_by_id) if entry.created_by_id else None,
        posted_by_id=str(entry.posted_by_id) if entry.posted_by_id else None,
        posted_at=entry.posted_at,
        lines=lines,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


# --- Chart of Accounts ---

@router.post("/accounts", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    data: AccountCreate,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Create a new account in the chart of accounts."""
    service = GeneralLedgerService(db)
    account = service.create_account(
        business_id=business_id,
        code=data.account_code,
        name=data.name,
        account_type=data.account_type,
        parent_id=data.parent_id,
        description=data.description,
        normal_balance=data.normal_balance,
    )
    return _account_to_response(account)


@router.get("/accounts", response_model=AccountListResponse)
async def list_accounts(
    account_type: Optional[str] = Query(None, pattern="^(asset|liability|equity|revenue|expense)$"),
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """List all accounts in the chart of accounts."""
    service = GeneralLedgerService(db)
    accounts = service.list_accounts(business_id=business_id, account_type=account_type)
    return AccountListResponse(
        items=[_account_to_response(a) for a in accounts],
        total=len(accounts),
    )


@router.get("/accounts/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get a single account by ID."""
    service = GeneralLedgerService(db)
    account = service.get_account(account_id, business_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return _account_to_response(account)


@router.get("/accounts/{account_id}/balance", response_model=AccountBalanceResponse)
async def get_account_balance(
    account_id: str,
    as_of: Optional[datetime] = None,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Get the balance for a specific account."""
    service = GeneralLedgerService(db)
    account = service.get_account(account_id, business_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    result = service.get_account_balance(account_id, business_id, as_of=as_of)
    return AccountBalanceResponse(**result)


# --- Journal Entries ---

@router.post("/journal-entries", response_model=JournalEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_journal_entry(
    data: JournalEntryCreate,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Create a new journal entry with balanced debit/credit lines."""
    service = GeneralLedgerService(db)
    lines = [ln.model_dump() for ln in data.lines]
    try:
        entry = service.create_journal_entry(
            business_id=business_id,
            description=data.description,
            lines=lines,
            user_id=str(current_user.id),
            reference=data.reference,
            is_auto=data.is_auto,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return _entry_to_response(entry)


@router.get("/journal-entries", response_model=JournalEntryListResponse)
async def list_journal_entries(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    entry_status: Optional[str] = Query(None, alias="status", pattern="^(draft|posted|voided)$"),
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """List journal entries with optional filters."""
    service = GeneralLedgerService(db)
    entries, total = service.list_journal_entries(
        business_id=business_id,
        status=entry_status,
        date_from=date_from,
        date_to=date_to,
        page=page,
        per_page=per_page,
    )
    return JournalEntryListResponse(
        items=[_entry_to_response(e) for e in entries],
        total=total,
        page=page,
        per_page=per_page,
        pages=math.ceil(total / per_page) if total > 0 else 0,
    )


@router.patch("/journal-entries/{entry_id}/post", response_model=JournalEntryResponse)
async def post_journal_entry(
    entry_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Post a draft journal entry."""
    service = GeneralLedgerService(db)
    try:
        entry = service.post_journal_entry(entry_id, business_id, str(current_user.id))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return _entry_to_response(entry)


@router.patch("/journal-entries/{entry_id}/void", response_model=JournalEntryResponse)
async def void_journal_entry(
    entry_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Void a journal entry."""
    service = GeneralLedgerService(db)
    try:
        entry = service.void_journal_entry(entry_id, business_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return _entry_to_response(entry)


# --- Reports ---

@router.get("/trial-balance", response_model=TrialBalanceResponse)
async def get_trial_balance(
    as_of: Optional[datetime] = None,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Generate trial balance report."""
    service = GeneralLedgerService(db)
    return service.get_trial_balance(business_id, as_of=as_of)


@router.get("/income-statement", response_model=IncomeStatementResponse)
async def get_income_statement(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Generate income statement (P&L) for a date range."""
    service = GeneralLedgerService(db)
    return service.get_income_statement(business_id, start_date, end_date)


@router.get("/balance-sheet", response_model=BalanceSheetResponse)
async def get_balance_sheet(
    as_of: Optional[datetime] = None,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Generate balance sheet report."""
    service = GeneralLedgerService(db)
    return service.get_balance_sheet(business_id, as_of=as_of)


# --- Seed ---

@router.post("/seed-accounts", status_code=status.HTTP_201_CREATED)
async def seed_accounts(
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Seed default chart of accounts for the current business."""
    service = GeneralLedgerService(db)
    created = service.seed_default_accounts(business_id)
    return {
        "message": f"Seeded {len(created)} default accounts.",
        "accounts_created": len(created),
    }


# --- Recurring Entries ---

@router.get("/recurring-entries", response_model=RecurringEntryListResponse)
async def list_recurring_entries(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """List recurring journal entry templates with pagination."""
    service = GeneralLedgerService(db)
    items, total = service.list_recurring_entries(business_id, page=page, per_page=per_page)
    pages = max(1, math.ceil(total / per_page))
    return RecurringEntryListResponse(
        items=[RecurringEntryResponse.model_validate(i) for i in items],
        total=total, page=page, per_page=per_page, pages=pages,
    )


@router.post("/recurring-entries", response_model=RecurringEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_recurring_entry(
    payload: RecurringEntryCreate,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Create a new recurring journal entry template."""
    service = GeneralLedgerService(db)
    entry = service.create_recurring_entry(business_id, payload.model_dump())
    return RecurringEntryResponse.model_validate(entry)


@router.put("/recurring-entries/{entry_id}", response_model=RecurringEntryResponse)
async def update_recurring_entry(
    entry_id: str,
    payload: RecurringEntryUpdate,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Update a recurring entry template."""
    service = GeneralLedgerService(db)
    entry = service.update_recurring_entry(entry_id, business_id, payload.model_dump(exclude_unset=True))
    if not entry:
        raise HTTPException(status_code=404, detail="Recurring entry not found.")
    return RecurringEntryResponse.model_validate(entry)


@router.delete("/recurring-entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recurring_entry(
    entry_id: str,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """Soft-delete a recurring entry template."""
    service = GeneralLedgerService(db)
    success = service.delete_recurring_entry(entry_id, business_id)
    if not success:
        raise HTTPException(status_code=404, detail="Recurring entry not found.")


# --- GL Audit Log ---

@router.get("/audit-log", response_model=GLAuditLogListResponse)
async def list_gl_audit_log(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """List GL audit log entries with optional filters."""
    service = GeneralLedgerService(db)
    items, total = service.list_audit_log(
        business_id, entity_type=entity_type, entity_id=entity_id,
        page=page, per_page=per_page,
    )
    pages = max(1, math.ceil(total / per_page))
    return GLAuditLogListResponse(
        items=[GLAuditLogResponse.model_validate(i) for i in items],
        total=total, page=page, per_page=per_page, pages=pages,
    )


# --- Account Balances ---

@router.get("/account-balances", response_model=AccountBalanceListResponse)
async def list_account_balances(
    account_id: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_sync_db),
    business_id: str = Depends(get_current_business_id),
):
    """List pre-aggregated account balances by period."""
    service = GeneralLedgerService(db)
    items, total = service.list_account_balances(
        business_id, account_id=account_id, year=year, month=month,
        page=page, per_page=per_page,
    )
    pages = max(1, math.ceil(total / per_page))
    return AccountBalanceListResponse(
        items=[AccountBalanceResponse.model_validate(i) for i in items],
        total=total, page=page, per_page=per_page, pages=pages,
    )
