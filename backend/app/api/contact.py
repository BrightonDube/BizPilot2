"""Contact API endpoint."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

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


@router.post("")
async def submit_contact_form(payload: ContactRequest):
    if not settings.EMAILS_ENABLED:
        raise HTTPException(status_code=400, detail="Emails are disabled")

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

    email_service.send_email(
        to_email="brightondube520@gmail.com",
        subject=subject,
        body_text="\n".join(body_lines),
        reply_to=str(payload.email),
    )

    return {"success": True}
