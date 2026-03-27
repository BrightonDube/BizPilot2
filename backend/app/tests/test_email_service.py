"""
test_email_service.py
Tests for EmailService (app/services/email_service.py).

Root cause fixed: production emails failed with ``(502, b'5.7.0 Please
authenticate first')`` because SMTP_USER / SMTP_PASSWORD were not set in the
DigitalOcean environment.  The fix:
  1. Raises ``ValueError`` immediately if SMTP_USER is set but SMTP_PASSWORD is
     missing — fails fast instead of attempting a connection that will 502.
  2. Wraps ``SMTPAuthenticationError`` with structured logging showing which
     credentials and host were used.
  3. Re-raises all exceptions so callers know the email was NOT sent.
"""

import pytest
import smtplib
from unittest.mock import MagicMock, patch


class TestEmailServiceValidation:
    """Validate config guard-rails added to EmailService.send_email."""

    def test_missing_smtp_password_raises_value_error(self):
        """When SMTP_USER is set but SMTP_PASSWORD is empty, raise ValueError immediately."""
        from app.services.email_service import EmailService

        service = EmailService()
        with patch("app.services.email_service.settings") as mock_settings:
            mock_settings.SMTP_USER = "user@example.com"
            mock_settings.SMTP_PASSWORD = None  # missing

            with pytest.raises(ValueError, match="SMTP_PASSWORD"):
                service.send_email(
                    to_email="to@example.com",
                    subject="Test",
                    body_text="Hello",
                )

    def test_both_credentials_missing_skips_login(self):
        """When SMTP_USER is None/empty, smtp.login() must NOT be called."""
        from app.services.email_service import EmailService

        service = EmailService()
        mock_smtp_instance = MagicMock()

        with patch("app.services.email_service.settings") as mock_settings, \
             patch("smtplib.SMTP") as mock_smtp_class:

            mock_settings.SMTP_USER = None
            mock_settings.SMTP_PASSWORD = None
            mock_settings.SMTP_HOST = "localhost"
            mock_settings.SMTP_PORT = 1025
            mock_settings.SMTP_TIMEOUT = 10
            mock_settings.SMTP_STARTTLS = False
            mock_settings.EMAILS_FROM_NAME = "BizPilot"
            mock_settings.EMAILS_FROM_EMAIL = "noreply@bizpilot.app"

            mock_smtp_class.return_value.__enter__ = lambda s: mock_smtp_instance
            mock_smtp_class.return_value.__exit__ = MagicMock(return_value=False)

            service.send_email(
                to_email="to@example.com",
                subject="Test",
                body_text="Hello",
            )

            mock_smtp_instance.login.assert_not_called()

    def test_smtp_auth_error_is_reraised(self):
        """SMTPAuthenticationError must be re-raised, not swallowed."""
        from app.services.email_service import EmailService

        service = EmailService()

        with patch("app.services.email_service.settings") as mock_settings, \
             patch("smtplib.SMTP") as mock_smtp_class:

            mock_settings.SMTP_USER = "user@example.com"
            mock_settings.SMTP_PASSWORD = "wrong"
            mock_settings.SMTP_HOST = "smtp.example.com"
            mock_settings.SMTP_PORT = 587
            mock_settings.SMTP_TIMEOUT = 10
            mock_settings.SMTP_STARTTLS = True
            mock_settings.EMAILS_FROM_NAME = "BizPilot"
            mock_settings.EMAILS_FROM_EMAIL = "noreply@bizpilot.app"

            mock_smtp_instance = MagicMock()
            mock_smtp_instance.login.side_effect = smtplib.SMTPAuthenticationError(535, b"auth failed")
            mock_smtp_class.return_value.__enter__ = lambda s: mock_smtp_instance
            mock_smtp_class.return_value.__exit__ = MagicMock(return_value=False)

            with pytest.raises(smtplib.SMTPAuthenticationError):
                service.send_email(
                    to_email="to@example.com",
                    subject="Test",
                    body_text="Hello",
                )

    def test_smtp_exception_is_reraised(self):
        """Generic SMTPException must also be re-raised (not silently swallowed)."""
        from app.services.email_service import EmailService

        service = EmailService()

        with patch("app.services.email_service.settings") as mock_settings, \
             patch("smtplib.SMTP") as mock_smtp_class:

            mock_settings.SMTP_USER = None
            mock_settings.SMTP_HOST = "smtp.example.com"
            mock_settings.SMTP_PORT = 587
            mock_settings.SMTP_TIMEOUT = 10
            mock_settings.SMTP_STARTTLS = False
            mock_settings.EMAILS_FROM_NAME = "BizPilot"
            mock_settings.EMAILS_FROM_EMAIL = "noreply@bizpilot.app"

            mock_smtp_instance = MagicMock()
            mock_smtp_instance.send_message.side_effect = smtplib.SMTPException("server error")
            mock_smtp_class.return_value.__enter__ = lambda s: mock_smtp_instance
            mock_smtp_class.return_value.__exit__ = MagicMock(return_value=False)

            with pytest.raises(smtplib.SMTPException):
                service.send_email(
                    to_email="to@example.com",
                    subject="Test",
                    body_text="Hello",
                )


class TestEmailServiceStructure:
    """Verify EmailService has the correct structure and logging."""

    def test_email_service_has_send_email(self):
        """EmailService must have a send_email method."""
        from app.services.email_service import EmailService
        assert hasattr(EmailService, "send_email"), "EmailService missing send_email"

    def test_module_has_logger(self):
        """Module-level logger must be present (added as part of the fix)."""
        import app.services.email_service as mod
        import logging
        assert hasattr(mod, "logger"), "email_service module missing logger"
        assert isinstance(mod.logger, logging.Logger)

    def test_email_attachment_dataclass_exists(self):
        """EmailAttachment dataclass must exist for attachment support."""
        from app.services.email_service import EmailAttachment
        att = EmailAttachment(filename="test.pdf", content=b"data")
        assert att.filename == "test.pdf"
        assert att.content == b"data"
        assert att.content_type is None  # defaults to None
