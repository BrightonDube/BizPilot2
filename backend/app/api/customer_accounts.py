"""Customer account API endpoints."""

from typing import Optional
from uuid import UUID
from decimal import Decimal
from datetime import date
import io
import math

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_sync_db
from app.api.deps import get_current_active_user, get_current_business_id
from app.models.user import User
from app.models.customer_account import (
    CustomerAccount,
    AccountStatus,
    AccountTransaction,
)
from app.services.customer_account_service import CustomerAccountService
from app.schemas.customer_account import (
    AccountCreate,
    AccountUpdate,
    AccountResponse,
    AccountListResponse,
    AccountStatusUpdate,
    AccountBalance,
    ChargeCreate,
    TransactionResponse,
    TransactionListResponse,
    PaymentCreate,
    PaymentResponse,
    AgingBreakdown,
)

router = APIRouter(prefix="/customer-accounts", tags=["Customer Accounts"])


# ── Helper ────────────────────────────────────────────────────────────────


def _get_account_or_404(
    service: CustomerAccountService,
    account_id: UUID,
    business_id: str,
) -> CustomerAccount:
    """Fetch account or raise 404."""
    account = service.get_account(account_id, UUID(business_id))
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer account {account_id} not found",
        )
    return account


# ── Accounts CRUD ─────────────────────────────────────────────────────────


@router.post("", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    data: AccountCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Create a new customer account."""
    try:
        service = CustomerAccountService(db)
        account = service.create_account(business_id=UUID(business_id), data=data)
        return account
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("", response_model=AccountListResponse)
async def list_accounts(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    account_status: Optional[AccountStatus] = Query(None, alias="status"),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
):
    """List customer accounts with pagination, search, and status filter."""
    query = db.query(CustomerAccount).filter(
        CustomerAccount.business_id == UUID(business_id),
    )

    if account_status is not None:
        query = query.filter(CustomerAccount.status == account_status)

    if search:
        term = f"%{search}%"
        query = query.filter(
            or_(
                CustomerAccount.account_number.ilike(term),
                CustomerAccount.notes.ilike(term),
            )
        )

    total = query.count()
    pages = math.ceil(total / per_page) if total else 0
    items = (
        query.order_by(CustomerAccount.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return AccountListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
    )


@router.get("/aging", response_model=AgingBreakdown)
async def get_aging_report(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
):
    """Get aging report aggregated across all active accounts."""
    service = CustomerAccountService(db)
    accounts = (
        db.query(CustomerAccount)
        .filter(
            CustomerAccount.business_id == UUID(business_id),
            CustomerAccount.status == AccountStatus.ACTIVE,
        )
        .all()
    )

    totals = {
        "current": Decimal("0"),
        "days_30": Decimal("0"),
        "days_60": Decimal("0"),
        "days_90_plus": Decimal("0"),
        "total": Decimal("0"),
    }

    for account in accounts:
        aging = service.calculate_aging(account)
        for key in totals:
            totals[key] += aging.get(key, Decimal("0"))

    return AgingBreakdown(**totals)


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get a customer account by ID."""
    service = CustomerAccountService(db)
    return _get_account_or_404(service, account_id, business_id)


@router.patch("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: UUID,
    data: AccountUpdate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Update a customer account."""
    service = CustomerAccountService(db)
    account = _get_account_or_404(service, account_id, business_id)
    return service.update_account(account, data)


@router.patch("/{account_id}/status", response_model=AccountResponse)
async def update_account_status(
    account_id: UUID,
    data: AccountStatusUpdate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Activate, suspend, or close a customer account."""
    service = CustomerAccountService(db)
    account = _get_account_or_404(service, account_id, business_id)

    try:
        if data.status == AccountStatus.ACTIVE:
            return service.activate_account(account)
        elif data.status == AccountStatus.SUSPENDED:
            return service.suspend_account(account, reason=data.reason)
        elif data.status == AccountStatus.CLOSED:
            return service.close_account(account, reason=data.reason)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot set status to {data.status.value}",
            )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# ── Balance ───────────────────────────────────────────────────────────────


@router.get("/{account_id}/balance", response_model=AccountBalance)
async def get_account_balance(
    account_id: UUID,
    include_aging: bool = Query(False),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get current balance and credit information for an account."""
    service = CustomerAccountService(db)
    account = _get_account_or_404(service, account_id, business_id)
    return service.get_balance(account, include_aging=include_aging)


# ── Charges ───────────────────────────────────────────────────────────────


@router.post("/{account_id}/charge", response_model=TransactionResponse)
async def charge_to_account(
    account_id: UUID,
    data: ChargeCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Charge an amount to a customer account."""
    service = CustomerAccountService(db)
    account = _get_account_or_404(service, account_id, business_id)

    try:
        transaction = service.charge_to_account(
            account=account,
            amount=data.amount,
            user_id=current_user.id,
            reference_type=data.reference_type,
            reference_id=data.reference_id,
            description=data.description,
            due_date=data.due_date,
        )
        return transaction
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# ── Payments ──────────────────────────────────────────────────────────────


@router.post("/{account_id}/payment", response_model=PaymentResponse)
async def record_payment(
    account_id: UUID,
    data: PaymentCreate,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Record a payment and allocate to outstanding charges (FIFO)."""
    service = CustomerAccountService(db)
    account = _get_account_or_404(service, account_id, business_id)

    try:
        payment, _allocations = service.process_payment(
            account=account,
            payment_data=data,
            user_id=current_user.id,
        )
        return payment
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# ── Transactions ──────────────────────────────────────────────────────────


@router.get("/{account_id}/transactions", response_model=TransactionListResponse)
async def get_transactions(
    account_id: UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
):
    """Get transaction history for an account with pagination."""
    service = CustomerAccountService(db)
    _get_account_or_404(service, account_id, business_id)

    query = db.query(AccountTransaction).filter(
        AccountTransaction.account_id == account_id,
    )

    total = query.count()
    pages = math.ceil(total / per_page) if total else 0
    items = (
        query.order_by(AccountTransaction.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return TransactionListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
    )


# ── Statements ────────────────────────────────────────────────────────────


@router.get("/{account_id}/statement")
async def generate_statement(
    account_id: UUID,
    period_end: date = Query(..., description="Statement period end date"),
    period_start: Optional[date] = Query(None, description="Statement period start date"),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Generate an account statement for a date range."""
    service = CustomerAccountService(db)
    account = _get_account_or_404(service, account_id, business_id)

    try:
        statement = service.generate_statement(
            account=account,
            period_end=period_end,
            period_start=period_start,
        )
        transactions = service.get_statement_transactions(statement)

        return {
            "id": statement.id,
            "account_id": statement.account_id,
            "statement_date": statement.statement_date,
            "period_start": statement.period_start,
            "period_end": statement.period_end,
            "opening_balance": statement.opening_balance,
            "total_charges": statement.total_charges,
            "total_payments": statement.total_payments,
            "closing_balance": statement.closing_balance,
            "aging": {
                "current": statement.current_amount,
                "days_30": statement.days_30_amount,
                "days_60": statement.days_60_amount,
                "days_90_plus": statement.days_90_plus_amount,
                "total": (
                    Decimal(str(statement.current_amount or 0))
                    + Decimal(str(statement.days_30_amount or 0))
                    + Decimal(str(statement.days_60_amount or 0))
                    + Decimal(str(statement.days_90_plus_amount or 0))
                ),
            },
            "transactions": [
                {
                    "date": t.created_at,
                    "transaction_type": t.transaction_type,
                    "description": t.description,
                    "amount": t.amount,
                    "balance": t.balance_after,
                }
                for t in transactions
            ],
            "sent_at": statement.sent_at,
            "created_at": statement.created_at,
            "is_sent": statement.is_sent,
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{account_id}/statement/pdf")
async def generate_statement_pdf(
    account_id: UUID,
    period_end: date = Query(..., description="Statement period end date"),
    period_start: Optional[date] = Query(None, description="Statement period start date"),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Generate a PDF account statement for download.

    Renders the statement via build_report_pdf with summary,
    aging breakdown, and transaction detail sections.
    """
    from app.core.pdf import build_report_pdf, format_currency, format_date

    service = CustomerAccountService(db)
    account = _get_account_or_404(service, account_id, business_id)

    try:
        statement = service.generate_statement(
            account=account,
            period_end=period_end,
            period_start=period_start,
        )
        transactions = service.get_statement_transactions(statement)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    customer_name = ""
    if hasattr(account, "customer") and account.customer:
        customer_name = getattr(account.customer, "name", "")

    sections = [
        {
            "title": "Account Details",
            "rows": [
                {"label": "Account Number", "value": account.account_number},
                {"label": "Customer", "value": customer_name or "—"},
                {"label": "Period", "value": f"{format_date(statement.period_start)} – {format_date(statement.period_end)}"},
            ],
        },
        {
            "title": "Balance Summary",
            "rows": [
                {"label": "Opening Balance", "value": format_currency(statement.opening_balance)},
                {"label": "Total Charges", "value": format_currency(statement.total_charges)},
                {"label": "Total Payments", "value": format_currency(statement.total_payments)},
                {"label": "Closing Balance", "value": format_currency(statement.closing_balance)},
            ],
        },
        {
            "title": "Aging Breakdown",
            "rows": [
                {"label": "Current", "value": format_currency(statement.current_amount)},
                {"label": "30 Days", "value": format_currency(statement.days_30_amount)},
                {"label": "60 Days", "value": format_currency(statement.days_60_amount)},
                {"label": "90+ Days", "value": format_currency(statement.days_90_plus_amount)},
            ],
        },
    ]

    # Add transaction rows if present
    if transactions:
        tx_rows = [
            {
                "label": f"{format_date(t.created_at)} – {(t.description or '')[:35]}",
                "value": format_currency(t.amount),
            }
            for t in transactions[:50]  # cap at 50 for PDF readability
        ]
        sections.append({"title": f"Transactions ({len(transactions)} total)", "rows": tx_rows})

    pdf_bytes = build_report_pdf(
        title="Account Statement",
        business_name=customer_name or "BizPilot",
        date_range=f"{format_date(statement.period_start)} – {format_date(statement.period_end)}",
        sections=sections,
    )

    filename = f"statement_{account.account_number}_{period_end}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{account_id}/statement/email")
async def email_statement(
    account_id: UUID,
    period_end: date = Query(..., description="Statement period end date"),
    period_start: Optional[date] = Query(None, description="Statement period start date"),
    to_email: Optional[str] = Query(None, description="Override recipient email"),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Email an account statement as a PDF attachment.

    Uses the customer's email by default; override with to_email param.
    Marks the statement as sent after successful delivery.
    """
    from app.core.pdf import build_simple_pdf, format_currency, format_date
    from app.services.email_service import EmailService, EmailAttachment

    service = CustomerAccountService(db)
    account = _get_account_or_404(service, account_id, business_id)

    # Resolve recipient email
    recipient = to_email
    if not recipient and hasattr(account, "customer") and account.customer:
        recipient = getattr(account.customer, "email", None)
    if not recipient:
        raise HTTPException(status_code=400, detail="No email address available for this account")

    try:
        statement = service.generate_statement(
            account=account,
            period_end=period_end,
            period_start=period_start,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Build a simple PDF summary
    lines = [
        "ACCOUNT STATEMENT",
        "",
        f"Account: {account.account_number}",
        f"Period: {format_date(statement.period_start)} – {format_date(statement.period_end)}",
        "",
        f"Opening Balance:  {format_currency(statement.opening_balance)}",
        f"Total Charges:    {format_currency(statement.total_charges)}",
        f"Total Payments:   {format_currency(statement.total_payments)}",
        f"Closing Balance:  {format_currency(statement.closing_balance)}",
        "",
        "Aging:",
        f"  Current:   {format_currency(statement.current_amount)}",
        f"  30 Days:   {format_currency(statement.days_30_amount)}",
        f"  60 Days:   {format_currency(statement.days_60_amount)}",
        f"  90+ Days:  {format_currency(statement.days_90_plus_amount)}",
    ]
    pdf_bytes = build_simple_pdf(lines)
    filename = f"statement_{account.account_number}_{period_end}.pdf"

    email_svc = EmailService()
    try:
        email_svc.send_email(
            to_email=recipient,
            subject=f"Account Statement – {account.account_number} ({format_date(period_end)})",
            body_text=(
                f"Please find attached your account statement for the period "
                f"ending {format_date(period_end)}.\n\n"
                f"Closing Balance: {format_currency(statement.closing_balance)}\n\n"
                f"Thank you for your business."
            ),
            attachments=[
                EmailAttachment(filename=filename, content=pdf_bytes, content_type="application/pdf")
            ],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

    # Mark statement as sent
    from datetime import datetime as dt, timezone as tz
    statement.is_sent = True
    statement.sent_at = dt.now(tz.utc)
    db.commit()

    return {"message": f"Statement emailed to {recipient}", "sent_at": statement.sent_at}


@router.get("/reports/ar-summary")
async def ar_summary(
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get accounts-receivable summary across all accounts."""
    biz = UUID(business_id)

    accounts = (
        db.query(CustomerAccount)
        .filter(
            CustomerAccount.business_id == biz,
            CustomerAccount.deleted_at.is_(None),
        )
        .all()
    )

    total_balance = sum(float(a.current_balance or 0) for a in accounts)
    total_credit = sum(float(a.credit_limit or 0) for a in accounts)
    active = sum(1 for a in accounts if a.status == AccountStatus.ACTIVE)
    overdue = sum(1 for a in accounts if float(a.current_balance or 0) > float(a.credit_limit or 0))

    return {
        "total_accounts": len(accounts),
        "active_accounts": active,
        "total_outstanding": round(total_balance, 2),
        "total_credit_limit": round(total_credit, 2),
        "utilization_pct": round(total_balance / total_credit * 100, 2) if total_credit > 0 else 0,
        "overdue_accounts": overdue,
    }


@router.get("/reports/dso")
async def dso_report(
    days: int = Query(30, ge=1, le=365, description="Period in days for DSO calculation"),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Calculate Days Sales Outstanding (DSO) for the business.

    DSO = (Accounts Receivable / Total Credit Sales) x Number of Days
    """
    from sqlalchemy import func
    from datetime import datetime, timedelta, timezone
    from app.models.customer_account import TransactionType as AccTxnType

    biz = UUID(business_id)
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    ar_result = (
        db.query(func.coalesce(func.sum(CustomerAccount.current_balance), 0))
        .filter(CustomerAccount.business_id == biz, CustomerAccount.deleted_at.is_(None))
        .scalar()
    )
    total_ar = float(ar_result or 0)

    sales_result = (
        db.query(func.coalesce(func.sum(AccountTransaction.amount), 0))
        .join(CustomerAccount, AccountTransaction.account_id == CustomerAccount.id)
        .filter(
            CustomerAccount.business_id == biz,
            AccountTransaction.transaction_type == AccTxnType.CHARGE,
            AccountTransaction.created_at >= cutoff,
        )
        .scalar()
    )
    total_sales = float(sales_result or 0)

    dso = round((total_ar / total_sales) * days, 1) if total_sales > 0 else 0

    return {
        "dso": dso,
        "period_days": days,
        "total_ar": round(total_ar, 2),
        "total_credit_sales": round(total_sales, 2),
    }


# ── Collections ───────────────────────────────────────────────────────────


@router.get("/{account_id}/overdue")
async def get_overdue_details(
    account_id: UUID,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Get overdue details for an account using aging buckets."""
    service = CustomerAccountService(db)
    account = _get_account_or_404(service, account_id, business_id)
    aging = service.calculate_aging(account)
    return aging


@router.post("/{account_id}/collection-activity")
async def record_collection_activity(
    account_id: UUID,
    activity_type: str = Query(..., description="call, email, letter, visit, legal, promise"),
    notes: Optional[str] = None,
    promised_date: Optional[date] = None,
    promised_amount: Optional[float] = None,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Record a collection activity (call, email, promise-to-pay, etc.)."""
    from app.models.customer_account import CollectionActivity, ActivityType

    service = CustomerAccountService(db)
    _get_account_or_404(service, account_id, business_id)

    try:
        act_type = ActivityType(activity_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid activity type: {activity_type}")

    activity = CollectionActivity(
        account_id=account_id,
        performed_by=current_user.id,
        activity_type=act_type,
        notes=notes,
        promised_date=promised_date,
        promised_amount=Decimal(str(promised_amount)) if promised_amount else None,
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)

    return {
        "id": str(activity.id),
        "account_id": str(activity.account_id),
        "activity_type": activity.activity_type.value,
        "notes": activity.notes,
        "promised_date": activity.promised_date,
        "promised_amount": float(activity.promised_amount) if activity.promised_amount else None,
        "created_at": activity.created_at.isoformat() if activity.created_at else None,
    }


@router.post("/{account_id}/write-off")
async def create_write_off(
    account_id: UUID,
    amount: float = Query(..., gt=0),
    reason: str = Query(...),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db=Depends(get_sync_db),
):
    """Write off an amount from an account."""
    from app.models.customer_account import AccountWriteOff, TransactionType as AccTxnType

    service = CustomerAccountService(db)
    account = _get_account_or_404(service, account_id, business_id)

    write_off_amount = Decimal(str(amount))
    if write_off_amount > account.current_balance:
        raise HTTPException(status_code=400, detail="Write-off amount exceeds balance")

    wo = AccountWriteOff(
        account_id=account_id,
        amount=write_off_amount,
        reason=reason,
        approved_by=current_user.id,
    )
    db.add(wo)

    txn = AccountTransaction(
        account_id=account_id,
        transaction_type=AccTxnType.WRITE_OFF,
        amount=write_off_amount,
        description=f"Write-off: {reason}",
        balance_after=account.current_balance - write_off_amount,
    )
    db.add(txn)

    account.current_balance -= write_off_amount
    db.commit()

    return {
        "id": str(wo.id),
        "account_id": str(account_id),
        "amount": float(write_off_amount),
        "reason": reason,
        "new_balance": float(account.current_balance),
    }
