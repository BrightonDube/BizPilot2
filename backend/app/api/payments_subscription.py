"""Paystack payment endpoints for subscription checkout and webhooks."""

import os
from typing import Optional
from uuid import UUID
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.user import User, SubscriptionStatus
from app.models.subscription_tier import SubscriptionTier
from app.models.subscription_transaction import (
    SubscriptionTransaction,
    TransactionStatus,
    TransactionType,
)
from app.services.paystack_service import paystack_service, PaystackService
from app.models.base import utc_now

router = APIRouter(prefix="/payments", tags=["payments-subscription"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


# ==================== Schemas ====================

class InitiateCheckoutRequest(BaseModel):
    tier_id: UUID
    billing_cycle: str = "monthly"  # "monthly" or "yearly"


class InitiateCheckoutResponse(BaseModel):
    reference: str
    authorization_url: str
    access_code: str


class VerifyPaymentRequest(BaseModel):
    reference: str


# ==================== Checkout Endpoints ====================

@router.post("/checkout/initiate", response_model=InitiateCheckoutResponse)
async def initiate_checkout(
    data: InitiateCheckoutRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Initialize a Paystack checkout session for a subscription.
    Returns the authorization URL to redirect the user to Paystack.
    """
    # Get the tier
    tier = db.query(SubscriptionTier).filter(
        SubscriptionTier.id == data.tier_id,
        SubscriptionTier.is_active,
        SubscriptionTier.deleted_at.is_(None)
    ).first()
    
    if not tier:
        raise HTTPException(status_code=404, detail="Tier not found")
    
    # Get the price based on billing cycle
    if data.billing_cycle == "yearly":
        amount_cents = tier.price_yearly_cents
        plan_code = tier.paystack_plan_code_yearly
    else:
        amount_cents = tier.price_monthly_cents
        plan_code = tier.paystack_plan_code_monthly
    
    if amount_cents == 0:
        raise HTTPException(
            status_code=400, 
            detail="This is a free tier. Use the select-tier endpoint instead."
        )
    
    # Create Paystack customer if not exists
    if not current_user.paystack_customer_code:
        customer = await paystack_service.create_customer(
            email=current_user.email,
            first_name=current_user.first_name,
            last_name=current_user.last_name,
            phone=current_user.phone,
        )
        if customer:
            current_user.paystack_customer_code = customer.customer_code
            db.commit()
    
    # Generate unique reference
    reference = PaystackService.generate_reference("SUB")
    
    # Create pending transaction record
    transaction = SubscriptionTransaction(
        user_id=current_user.id,
        tier_id=tier.id,
        transaction_type=TransactionType.SUBSCRIPTION,
        status=TransactionStatus.PENDING,
        amount_cents=amount_cents,
        currency=tier.currency,
        paystack_reference=reference,
    )
    db.add(transaction)
    db.commit()
    
    # Initialize Paystack transaction
    callback_url = f"{FRONTEND_URL}/subscription/callback?reference={reference}"
    
    paystack_tx = await paystack_service.initialize_transaction(
        email=current_user.email,
        amount_cents=amount_cents,
        reference=reference,
        callback_url=callback_url,
        metadata={
            "user_id": str(current_user.id),
            "tier_id": str(tier.id),
            "tier_name": tier.name,
            "billing_cycle": data.billing_cycle,
        },
        plan_code=plan_code,
    )
    
    if not paystack_tx:
        transaction.status = TransactionStatus.FAILED
        transaction.failure_reason = "Failed to initialize Paystack transaction"
        db.commit()
        raise HTTPException(
            status_code=500, 
            detail="Failed to initialize payment. Please try again."
        )
    
    return InitiateCheckoutResponse(
        reference=paystack_tx.reference,
        authorization_url=paystack_tx.authorization_url,
        access_code=paystack_tx.access_code,
    )


@router.post("/checkout/verify")
async def verify_payment(
    data: VerifyPaymentRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Verify a payment after callback from Paystack.
    This is called by the frontend after the user returns from Paystack.
    """
    # Find the transaction
    transaction = db.query(SubscriptionTransaction).filter(
        SubscriptionTransaction.paystack_reference == data.reference,
        SubscriptionTransaction.user_id == current_user.id,
    ).first()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # If already processed, return current status
    if transaction.status != TransactionStatus.PENDING:
        return {
            "status": transaction.status.value,
            "message": "Transaction already processed",
        }
    
    # Verify with Paystack
    paystack_data = await paystack_service.verify_transaction(data.reference)
    
    if not paystack_data:
        return {
            "status": "pending",
            "message": "Payment verification pending",
        }
    
    # Process based on Paystack status
    if paystack_data.get("status") == "success":
        # Update transaction
        transaction.status = TransactionStatus.SUCCESS
        transaction.paystack_transaction_id = str(paystack_data.get("id"))
        transaction.paid_at = utc_now()
        transaction.raw_response = paystack_data
        
        # Extract card info if available
        authorization = paystack_data.get("authorization", {})
        transaction.card_last_four = authorization.get("last4")
        transaction.card_brand = authorization.get("brand")
        transaction.payment_method = authorization.get("channel", "card")
        
        # Update user subscription
        tier = db.query(SubscriptionTier).filter(
            SubscriptionTier.id == transaction.tier_id
        ).first()
        
        if tier:
            current_user.current_tier_id = tier.id
            current_user.subscription_status = SubscriptionStatus.ACTIVE
            current_user.subscription_started_at = utc_now()
            
            # Set expiry based on billing cycle (from metadata)
            metadata = paystack_data.get("metadata", {})
            billing_cycle = metadata.get("billing_cycle", "monthly")
            if billing_cycle == "yearly":
                current_user.subscription_expires_at = utc_now() + timedelta(days=365)
            else:
                current_user.subscription_expires_at = utc_now() + timedelta(days=30)
        
        db.commit()
        
        return {
            "status": "success",
            "message": "Payment successful! Your subscription is now active.",
            "tier": tier.display_name if tier else None,
        }
    
    elif paystack_data.get("status") == "failed":
        transaction.status = TransactionStatus.FAILED
        transaction.failure_reason = paystack_data.get("gateway_response", "Payment failed")
        transaction.raw_response = paystack_data
        db.commit()
        
        return {
            "status": "failed",
            "message": transaction.failure_reason,
        }
    
    else:
        return {
            "status": "pending",
            "message": "Payment is still being processed",
        }


# ==================== Webhook Endpoint ====================

@router.post("/webhook/paystack")
async def paystack_webhook(
    request: Request,
    x_paystack_signature: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    Handle Paystack webhook events.
    This is called by Paystack when payment events occur.
    """
    # Get raw body for signature verification
    body = await request.body()
    
    # Verify webhook signature
    if x_paystack_signature:
        if not PaystackService.verify_webhook_signature(body, x_paystack_signature):
            raise HTTPException(status_code=401, detail="Invalid signature")
    
    # Parse event
    import json
    try:
        event = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    event_type = event.get("event")
    data = event.get("data", {})
    
    # Handle different event types
    if event_type == "charge.success":
        await handle_charge_success(data, db)
    
    elif event_type == "subscription.create":
        await handle_subscription_created(data, db)
    
    elif event_type == "subscription.disable":
        await handle_subscription_cancelled(data, db)
    
    elif event_type == "invoice.payment_failed":
        await handle_payment_failed(data, db)
    
    return {"status": "ok"}


async def handle_charge_success(data: dict, db: Session):
    """Handle successful charge event."""
    reference = data.get("reference")
    if not reference:
        return
    
    # Find transaction by reference
    transaction = db.query(SubscriptionTransaction).filter(
        SubscriptionTransaction.paystack_reference == reference
    ).first()
    
    if not transaction or transaction.status == TransactionStatus.SUCCESS:
        return
    
    # Update transaction
    transaction.status = TransactionStatus.SUCCESS
    transaction.paystack_transaction_id = str(data.get("id"))
    transaction.paid_at = utc_now()
    transaction.raw_response = data
    
    # Extract card info
    authorization = data.get("authorization", {})
    transaction.card_last_four = authorization.get("last4")
    transaction.card_brand = authorization.get("brand")
    transaction.payment_method = authorization.get("channel", "card")
    
    # Update user subscription
    user = db.query(User).filter(User.id == transaction.user_id).first()
    if user and transaction.tier_id:
        user.current_tier_id = transaction.tier_id
        user.subscription_status = SubscriptionStatus.ACTIVE
        user.subscription_started_at = utc_now()
        
        # Set expiry
        metadata = data.get("metadata", {})
        billing_cycle = metadata.get("billing_cycle", "monthly")
        if billing_cycle == "yearly":
            user.subscription_expires_at = utc_now() + timedelta(days=365)
        else:
            user.subscription_expires_at = utc_now() + timedelta(days=30)
    
    db.commit()


async def handle_subscription_created(data: dict, db: Session):
    """Handle subscription creation event."""
    customer = data.get("customer", {})
    customer_code = customer.get("customer_code")
    subscription_code = data.get("subscription_code")
    
    if not customer_code:
        return
    
    # Find user by customer code
    user = db.query(User).filter(
        User.paystack_customer_code == customer_code
    ).first()
    
    if user and subscription_code:
        user.paystack_subscription_code = subscription_code
        db.commit()


async def handle_subscription_cancelled(data: dict, db: Session):
    """Handle subscription cancellation event."""
    subscription_code = data.get("subscription_code")
    
    if not subscription_code:
        return
    
    # Find user by subscription code
    user = db.query(User).filter(
        User.paystack_subscription_code == subscription_code
    ).first()
    
    if user:
        user.subscription_status = SubscriptionStatus.CANCELLED
        user.paystack_subscription_code = None
        db.commit()


async def handle_payment_failed(data: dict, db: Session):
    """Handle failed payment event."""
    customer = data.get("customer", {})
    customer_code = customer.get("customer_code")
    
    if not customer_code:
        return
    
    # Find user by customer code
    user = db.query(User).filter(
        User.paystack_customer_code == customer_code
    ).first()
    
    if user:
        # Log failed payment but don't immediately cancel
        # Could send notification email here
        pass


# ==================== Billing History Endpoint ====================

class TransactionResponse(BaseModel):
    id: str
    amount_cents: int
    currency: str
    status: str
    created_at: str
    tier_name: Optional[str] = None
    payment_method: Optional[str] = None
    card_last_four: Optional[str] = None


class TransactionListResponse(BaseModel):
    items: list[TransactionResponse]
    total: int


@router.get("/transactions/me", response_model=TransactionListResponse)
async def get_my_transactions(
    limit: int = 10,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get the current user's subscription transaction history.
    """
    transactions = db.query(SubscriptionTransaction).filter(
        SubscriptionTransaction.user_id == current_user.id,
    ).order_by(SubscriptionTransaction.created_at.desc()).limit(limit).all()
    
    # Get tier names
    tier_ids = [str(tx.tier_id) for tx in transactions if tx.tier_id]
    tier_names = {}
    if tier_ids:
        tiers = db.query(SubscriptionTier).filter(
            SubscriptionTier.id.in_(tier_ids)
        ).all()
        for tier in tiers:
            tier_names[str(tier.id)] = tier.display_name
    
    items = []
    for tx in transactions:
        items.append(TransactionResponse(
            id=str(tx.id),
            amount_cents=tx.amount_cents,
            currency=tx.currency,
            status=tx.status.value if tx.status else "unknown",
            created_at=tx.created_at.isoformat() if tx.created_at else "",
            tier_name=tier_names.get(str(tx.tier_id)) if tx.tier_id else None,
            payment_method=tx.payment_method,
            card_last_four=tx.card_last_four,
        ))
    
    return TransactionListResponse(
        items=items,
        total=len(items),
    )
