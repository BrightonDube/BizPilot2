"""Contact API endpoint."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.services.email_service import EmailService


router = APIRouter(prefix="/contact", tags=["Contact"])


class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    subject: str
    message: str
    topic: str | None = None
    tier: str | None = None


class ContactResponse(BaseModel):
    success: bool
    message: str | None = None


@router.post("", response_model=ContactResponse)
async def submit_contact_form(payload: ContactRequest):
    """
    Submit a contact form message.
    
    Sends an email to the configured contact email address with the user's message.
    Returns success status and optional message.
    """
    if not settings.EMAILS_ENABLED:
        raise HTTPException(status_code=400, detail="Emails are disabled")

    # Get contact email from settings (should be configured per environment)
    contact_email = getattr(settings, 'CONTACT_EMAIL', 'brightondube520@gmail.com')
    
    email_service = EmailService()

    topic = (payload.topic or "general").strip()
    tier = (payload.tier or "").strip()

    subject = f"[{topic}] {payload.subject}" if topic else payload.subject

    body_lines = [
        f"Name: {payload.name}",
        f"Email: {payload.email}",
    ]
    if tier:
        body_lines.append(f"Tier: {tier}")
    body_lines.extend(["", payload.message])

    # Run email sending in threadpool to avoid blocking the event loop
    await run_in_threadpool(
        email_service.send_email,
        to_email=contact_email,
        subject=subject,
        body_text="\n".join(body_lines),
        reply_to=str(payload.email),
    )

    return ContactResponse(success=True, message="Message sent successfully")
