"""Unit tests for EmailService."""

from types import SimpleNamespace

import pytest


def test_email_service_starttls_and_login(monkeypatch):
    from app.core.config import settings
    from app.services.email_service import EmailService

    calls = {"init": None, "ehlo": 0, "starttls": 0, "login": None, "send": 0}

    class FakeSMTP:
        def __init__(self, host, port, timeout=None):
            calls["init"] = {"host": host, "port": port, "timeout": timeout}

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def ehlo(self):
            calls["ehlo"] += 1

        def starttls(self):
            calls["starttls"] += 1

        def login(self, user, password):
            calls["login"] = {"user": user, "password": password}

        def send_message(self, msg):
            calls["send"] += 1

    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(settings, "SMTP_PORT", 587)
    monkeypatch.setattr(settings, "SMTP_TIMEOUT", 12)
    monkeypatch.setattr(settings, "SMTP_STARTTLS", True)
    monkeypatch.setattr(settings, "SMTP_USER", "user")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "pass")

    import app.services.email_service as email_mod

    monkeypatch.setattr(email_mod.smtplib, "SMTP", FakeSMTP)

    EmailService().send_email(to_email="a@b.com", subject="Hi", body_text="Body")

    assert calls["init"] == {"host": "smtp.example.com", "port": 587, "timeout": 12}
    assert calls["starttls"] == 1
    assert calls["login"] == {"user": "user", "password": "pass"}
    assert calls["send"] == 1


def test_email_service_requires_password_when_user_set(monkeypatch):
    from app.core.config import settings
    from app.services.email_service import EmailService

    monkeypatch.setattr(settings, "SMTP_USER", "user")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "")

    with pytest.raises(ValueError):
        EmailService().send_email(to_email="a@b.com", subject="Hi", body_text="Body")
