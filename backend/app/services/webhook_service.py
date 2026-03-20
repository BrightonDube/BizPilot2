import hmac
import hashlib
import json
import logging
import asyncio
import httpx
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import BackgroundTasks

from app.models.webhook import WebhookSubscription, WebhookDelivery

logger = logging.getLogger(__name__)

async def trigger_webhook_event(
    event_type: str, 
    payload: Dict[str, Any], 
    business_id: UUID, 
    db: AsyncSession,
    background_tasks: Optional[BackgroundTasks] = None
) -> None:
    """
    Trigger all active webhook subscriptions for an event type.
    """
    # Find active subscriptions for this business and event type
    # events column is JSONB list, so we use contains
    stmt = select(WebhookSubscription).where(
        WebhookSubscription.business_id == business_id,
        WebhookSubscription.is_active == True,
        WebhookSubscription.events.contains([event_type])
    )
    result = await db.execute(stmt)
    subscriptions = result.scalars().all()

    for sub in subscriptions:
        # Create delivery record
        delivery = WebhookDelivery(
            id=uuid4(),
            business_id=business_id,
            subscription_id=sub.id,
            event_type=event_type,
            payload=payload,
            status="pending",
            attempt_count=0
        )
        db.add(delivery)
        await db.flush() # Ensure delivery.id is set if not provided

        # Trigger delivery
        if background_tasks:
            background_tasks.add_task(deliver_webhook, delivery.id, db)
        else:
            # Fallback to fire-and-forget task if no background_tasks provided
            asyncio.create_task(deliver_webhook(delivery.id, db))

async def deliver_webhook(delivery_id: UUID, db: AsyncSession) -> bool:
    """
    Attempt to deliver a single webhook.
    """
    # Fetch delivery and subscription
    # Note: in a real background task, we might need a fresh session
    stmt = select(WebhookDelivery, WebhookSubscription).join(
        WebhookSubscription, WebhookDelivery.subscription_id == WebhookSubscription.id
    ).where(WebhookDelivery.id == delivery_id)
    
    result = await db.execute(stmt)
    row = result.first()
    if not row:
        return False
    
    delivery, sub = row

    # SIGN PAYLOAD
    payload_str = json.dumps(delivery.payload)
    signature = hmac.new(
        sub.secret.encode(),
        payload_str.encode(),
        hashlib.sha256
    ).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "X-BizPilot-Signature": signature,
        "X-BizPilot-Event": delivery.event_type
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(sub.url, content=payload_str, headers=headers)
            
            delivery.response_code = response.status_code
            delivery.attempt_count += 1
            delivery.delivered_at = datetime.now()
            
            if 200 <= response.status_code < 300:
                delivery.status = "delivered"
                # Update subscription last_triggered_at
                sub.last_triggered_at = datetime.now()
                sub.failure_count = 0
                await db.commit()
                return True
            else:
                delivery.status = "failed"
                sub.failure_count += 1
    except Exception as e:
        logger.error(f"Webhook delivery failed for {delivery_id}: {str(e)}")
        delivery.attempt_count += 1
        delivery.status = "failed"
        sub.failure_count += 1

    # RETRY LOGIC (Exponential backoff)
    # retries at 1m, 5m, 30m, 2h, 24h
    retry_intervals = [60, 300, 1800, 7200, 86400]
    if delivery.attempt_count <= len(retry_intervals):
        delivery.next_retry_at = datetime.now() + timedelta(seconds=retry_intervals[delivery.attempt_count-1])
        delivery.status = "pending" # Keep as pending for retry worker
    else:
        delivery.status = "failed"
        if sub.failure_count > 10:
            sub.is_active = False # Deactivate if too many failures

    await db.commit()
    return False

async def create_webhook_subscription(
    url: str,
    events: List[str],
    business_id: UUID,
    db: AsyncSession
) -> WebhookSubscription:
    """
    Create a new webhook subscription.
    """
    # Validate URL
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.head(url)
    except Exception as e:
        # We don't strictly require it to be up, but we log it
        logger.warning(f"Webhook URL {url} not reachable during subscription: {str(e)}")

    import secrets
    secret = secrets.token_hex(32)

    sub = WebhookSubscription(
        id=uuid4(),
        business_id=business_id,
        url=url,
        events=events,
        secret=secret,
        is_active=True
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return sub
