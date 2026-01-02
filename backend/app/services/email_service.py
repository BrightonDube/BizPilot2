"""Email service for sending transactional emails."""

from __future__ import annotations

from dataclasses import dataclass
from email.message import EmailMessage
from typing import Iterable, Optional
import mimetypes
import smtplib

from app.core.config import settings


@dataclass(frozen=True)
class EmailAttachment:
    filename: str
    content: bytes
    content_type: Optional[str] = None


class EmailService:
    """SMTP-based email sender."""

    def send_email(
        self,
        *,
        to_email: str,
        subject: str,
        body_text: str,
        attachments: Optional[Iterable[EmailAttachment]] = None,
        reply_to: Optional[str] = None,
    ) -> None:
        if settings.SMTP_USER and not settings.SMTP_PASSWORD:
            raise ValueError("SMTP_PASSWORD must be set when SMTP_USER is configured")

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
        msg["To"] = to_email
        if reply_to:
            msg["Reply-To"] = reply_to

        msg.set_content(body_text)

        for att in attachments or []:
            ctype = att.content_type
            if not ctype:
                guessed, _ = mimetypes.guess_type(att.filename)
                ctype = guessed or "application/octet-stream"

            maintype, subtype = ctype.split("/", 1)
            msg.add_attachment(att.content, maintype=maintype, subtype=subtype, filename=att.filename)

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=settings.SMTP_TIMEOUT) as smtp:
            if settings.SMTP_STARTTLS:
                smtp.ehlo()
                smtp.starttls()
                smtp.ehlo()

            if settings.SMTP_USER:
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)

            smtp.send_message(msg)
