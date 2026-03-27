"""PII redaction utilities for the AI agent pipeline.

Removes Personally Identifiable Information from text before it is sent to
external LLM providers, ensuring POPIA / GDPR compliance.

Patterns covered:
- South African ID numbers (13 digits, YYMMDD + 4-digit gender/sequence + 2 check digits)
- South African mobile numbers (+27 or 0, followed by 9 digits)
- Email addresses (RFC-5321 local@domain pattern)
- Customer names — redacted when the context object exposes known names
"""

from __future__ import annotations

import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Compiled regex patterns
# ---------------------------------------------------------------------------

_SA_ID_PATTERN = re.compile(r"\b\d{13}\b")

_SA_PHONE_PATTERN = re.compile(
    r"(?<!\d)"
    r"(?:\+27|0)"          # country code or leading zero
    r"[6-8]\d"             # mobile prefix (6x / 7x / 8x)
    r"[\s\-]?"
    r"\d{3}"
    r"[\s\-]?"
    r"\d{4}"
    r"(?!\d)"
)

_EMAIL_PATTERN = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
)


class PIIRedactor:
    """
    Strips South African PII from text before forwarding to an external LLM.

    Usage::

        redactor = PIIRedactor()
        safe_text = redactor.redact(user_message)

    Customer names can be registered so they are replaced inline::

        redactor = PIIRedactor(known_names=["Jane Smith", "John Doe"])
        safe_text = redactor.redact("Hi, I'm Jane Smith")
        # → "Hi, I'm [NAME]"
    """

    def __init__(self, known_names: Optional[list[str]] = None) -> None:
        self._name_patterns: list[re.Pattern] = []
        for name in (known_names or []):
            if name and len(name.strip()) >= 2:
                escaped = re.escape(name.strip())
                self._name_patterns.append(
                    re.compile(escaped, re.IGNORECASE)
                )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def redact(self, text: str) -> str:
        """Return a copy of *text* with all detected PII replaced by tokens."""
        if not text:
            return text

        original_len = len(text)
        text = self._redact_sa_ids(text)
        text = self._redact_phones(text)
        text = self._redact_emails(text)
        text = self._redact_known_names(text)

        redacted_count = self._count_tokens(text)
        if redacted_count:
            logger.debug(
                "PIIRedactor: redacted %d token(s) from %d-char input.",
                redacted_count, original_len,
            )

        return text

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _redact_sa_ids(text: str) -> str:
        return _SA_ID_PATTERN.sub("[SA_ID]", text)

    @staticmethod
    def _redact_phones(text: str) -> str:
        return _SA_PHONE_PATTERN.sub("[PHONE]", text)

    @staticmethod
    def _redact_emails(text: str) -> str:
        return _EMAIL_PATTERN.sub("[EMAIL]", text)

    def _redact_known_names(self, text: str) -> str:
        for pattern in self._name_patterns:
            text = pattern.sub("[NAME]", text)
        return text

    @staticmethod
    def _count_tokens(text: str) -> int:
        return text.count("[SA_ID]") + text.count("[PHONE]") + text.count("[EMAIL]") + text.count("[NAME]")
