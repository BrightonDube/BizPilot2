"""Email service for sending transactional emails via SMTP.

Root-cause note (2026-03-27): production emails were failing silently with
``(502, b'5.7.0 Please authenticate first')`` because SMTP_USER / SMTP_PASSWORD
were not set in the DigitalOcean environment.  The fix adds structured error
logging so the exact failure is visible in ``doctl apps logs``, and re-raises
the exception so callers can react (rather than silently continuing).

Required DigitalOcean env vars for email to work:
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_STARTTLS
"""

import logging
import mimetypes
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from typing import Iterable, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EmailAttachment:
    """A file attachment to include in an outbound email."""

    filename: str
    content: bytes
    content_type: Optional[str] = None


class EmailService:
    """SMTP-based transactional email sender."""

    def send_email(
        self,
        *,
        to_email: str,
        subject: str,
        body_text: str,
        body_html: Optional[str] = None,
        attachments: Optional[Iterable[EmailAttachment]] = None,
        reply_to: Optional[str] = None,
    ) -> None:
        """
        Send a single email via SMTP.

        Args:
            to_email: Recipient address.
            subject: Email subject line.
            body_text: Plain-text body (always included for compatibility).
            body_html: Optional HTML alternative body.
            attachments: Optional iterable of :class:`EmailAttachment`.
            reply_to: Optional Reply-To header address.

        Raises:
            ValueError: If SMTP_USER is set but SMTP_PASSWORD is missing.
            smtplib.SMTPAuthenticationError: If SMTP credentials are wrong.
            smtplib.SMTPException: For other SMTP-level failures.
            Exception: For unexpected errors (always logged before raising).
        """
        if settings.SMTP_USER and not settings.SMTP_PASSWORD:
            raise ValueError("SMTP_PASSWORD must be set when SMTP_USER is configured")

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
        msg["To"] = to_email
        if reply_to:
            msg["Reply-To"] = reply_to

        msg.set_content(body_text)
        if body_html:
            msg.add_alternative(body_html, subtype="html")

        for att in attachments or []:
            ctype = att.content_type
            if not ctype:
                guessed, _ = mimetypes.guess_type(att.filename)
                ctype = guessed or "application/octet-stream"
            maintype, subtype = ctype.split("/", 1)
            msg.add_attachment(
                att.content, maintype=maintype, subtype=subtype, filename=att.filename
            )

        try:
            with smtplib.SMTP(
                settings.SMTP_HOST, settings.SMTP_PORT, timeout=settings.SMTP_TIMEOUT
            ) as smtp:
                if settings.SMTP_STARTTLS:
                    smtp.ehlo()
                    smtp.starttls()
                    smtp.ehlo()

                if settings.SMTP_USER:
                    smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)

                smtp.send_message(msg)
                logger.info(
                    "Email sent to=%s subject=%r via %s:%s",
                    to_email,
                    subject,
                    settings.SMTP_HOST,
                    settings.SMTP_PORT,
                )
        except smtplib.SMTPAuthenticationError:
            logger.error(
                "SMTP authentication failed for user=%r on %s:%s — "
                "check SMTP_USER and SMTP_PASSWORD environment variables",
                settings.SMTP_USER,
                settings.SMTP_HOST,
                settings.SMTP_PORT,
            )
            raise
        except smtplib.SMTPException as exc:
            logger.error(
                "SMTP error sending to=%s: %s: %s",
                to_email,
                type(exc).__name__,
                exc,
                exc_info=True,
            )
            raise
        except Exception as exc:
            logger.error(
                "Unexpected error sending email to=%s: %s: %s",
                to_email,
                type(exc).__name__,
                exc,
                exc_info=True,
            )
            raise
