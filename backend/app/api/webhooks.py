from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import get_current_business_id
from app.services.webhook_service import create_webhook_subscription
from app.models.webhook import WebhookSubscription

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

class WebhookSubscriptionCreate(BaseModel):
    url: str
    events: List[str]

class WebhookSubscriptionResponse(BaseModel):
    id: UUID
    url: str
    events: List[str]
    is_active: bool
    secret: str # Returned on creation

class WebhookSubscriptionListResponse(BaseModel):
    id: UUID
    url: str
    events: List[str]
    is_active: bool

    class Config:
        from_attributes = True

@router.post("/", response_model=WebhookSubscriptionResponse)
async def create_subscription(
    data: WebhookSubscriptionCreate,
    business_id: UUID = Depends(get_current_business_id),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new webhook subscription.
    """
    sub = await create_webhook_subscription(
        url=data.url,
        events=data.events,
        business_id=business_id,
        db=db
    )
    return sub

@router.get("/", response_model=List[WebhookSubscriptionListResponse])
async def list_subscriptions(
    business_id: UUID = Depends(get_current_business_id),
    db: AsyncSession = Depends(get_db)
):
    """
    List all webhook subscriptions for the business.
    """
    from sqlalchemy import select
    stmt = select(WebhookSubscription).where(WebhookSubscription.business_id == business_id)
    result = await db.execute(stmt)
    subs = result.scalars().all()
    
    # We should NOT return the secret in the list view
    # But for simplicity in this task, I'll follow the requirement:
    # "Returns subscription with secret shown ONCE — not stored retrievably."
    # Wait, if it's NOT stored retrievably, how do I sign payloads later?
    # Usually we store a HASH of the secret if we want it to be one-way,
    # but for HMAC signing we need the PLAINTEXT secret.
    # The requirement likely means "Don't show it again in GET requests after creation".
    
    # I'll create a different schema for list view that excludes secret.
    return subs
