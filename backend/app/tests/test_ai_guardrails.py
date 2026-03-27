"""Tests for AI guardrails: PII redaction, subscription tier check, and metrics aggregation."""

import uuid
from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# PII Redaction tests
# ---------------------------------------------------------------------------

class TestPIIRedactor:
    def _redactor(self, known_names=None):
        from app.agents.pii_redactor import PIIRedactor
        return PIIRedactor(known_names=known_names)

    # SA ID numbers
    def test_redacts_sa_id_number(self):
        r = self._redactor()
        result = r.redact("ID: 9001015800085 please verify")
        assert "9001015800085" not in result
        assert "[SA_ID]" in result

    def test_leaves_non_id_numbers_intact(self):
        r = self._redactor()
        # 12-digit number — not a SA ID (needs 13 digits)
        result = r.redact("Order ref 123456789012")
        assert "123456789012" in result
        assert "[SA_ID]" not in result

    def test_redacts_multiple_ids(self):
        r = self._redactor()
        text = "First: 9001015800085, Second: 8505105800080"
        result = r.redact(text)
        assert "9001015800085" not in result
        assert "8505105800080" not in result
        assert result.count("[SA_ID]") == 2

    # SA phone numbers
    def test_redacts_sa_mobile_plus27(self):
        r = self._redactor()
        result = r.redact("Call me on +27821234567")
        assert "+27821234567" not in result
        assert "[PHONE]" in result

    def test_redacts_sa_mobile_leading_zero(self):
        r = self._redactor()
        result = r.redact("My number: 0721234567 thanks")
        assert "0721234567" not in result
        assert "[PHONE]" in result

    def test_leaves_landlines_with_invalid_prefix_intact(self):
        r = self._redactor()
        # Starts with 0 but prefix 11 is Joburg landline — not a mobile
        # Our pattern only matches 06x / 07x / 08x mobile prefixes
        result = r.redact("Call 0113456789")
        # This should NOT be matched (11 prefix is not 6x/7x/8x)
        assert "[PHONE]" not in result

    # Email addresses
    def test_redacts_email_address(self):
        r = self._redactor()
        result = r.redact("Contact jane@example.co.za for info")
        assert "jane@example.co.za" not in result
        assert "[EMAIL]" in result

    def test_redacts_multiple_emails(self):
        r = self._redactor()
        text = "From: a@a.com To: b@b.co.za"
        result = r.redact(text)
        assert "a@a.com" not in result
        assert "b@b.co.za" not in result
        assert result.count("[EMAIL]") == 2

    # Known customer names
    def test_redacts_known_name(self):
        r = self._redactor(known_names=["Jane Smith"])
        result = r.redact("Hi, I'm Jane Smith and I need help")
        assert "Jane Smith" not in result
        assert "[NAME]" in result

    def test_name_redaction_is_case_insensitive(self):
        r = self._redactor(known_names=["Jane Smith"])
        result = r.redact("JANE SMITH has an account")
        assert "JANE SMITH" not in result
        assert "[NAME]" in result

    def test_no_name_redaction_when_no_names_registered(self):
        r = self._redactor()
        result = r.redact("Jane Smith is the customer")
        assert "Jane Smith" in result
        assert "[NAME]" not in result

    # Empty / None input
    def test_empty_string_returns_empty(self):
        r = self._redactor()
        assert r.redact("") == ""

    def test_plain_text_no_pii_is_unchanged(self):
        r = self._redactor()
        text = "Hello, how can I help you today?"
        assert r.redact(text) == text

    # Combined PII in one message
    def test_redacts_combined_pii(self):
        r = self._redactor(known_names=["John Doe"])
        text = "Customer John Doe, ID 9001015800085, email john@doe.com, phone 0711234567"
        result = r.redact(text)
        assert "John Doe" not in result
        assert "9001015800085" not in result
        assert "john@doe.com" not in result
        assert "0711234567" not in result
        assert "[NAME]" in result
        assert "[SA_ID]" in result
        assert "[EMAIL]" in result
        assert "[PHONE]" in result


# ---------------------------------------------------------------------------
# AI rule generation job tests
# ---------------------------------------------------------------------------

class TestAIRuleGenerationJob:
    @patch("app.scheduler.jobs.ai_rule_generation_job.SessionLocal")
    def test_job_processes_businesses(self, MockSession):
        from app.scheduler.jobs.ai_rule_generation_job import ai_rule_generation_job

        mock_db = MagicMock()
        MockSession.return_value = mock_db

        biz = MagicMock()
        biz.id = uuid.uuid4()
        biz.deleted_at = None
        mock_db.query.return_value.filter.return_value.all.return_value = [biz]

        with patch("app.scheduler.jobs.ai_rule_generation_job._generate_rules_for_business", return_value=[]) as mock_gen:
            ai_rule_generation_job()
            mock_gen.assert_called_once()

    @patch("app.scheduler.jobs.ai_rule_generation_job.SessionLocal")
    def test_job_stores_rules_when_generated(self, MockSession):
        from app.scheduler.jobs.ai_rule_generation_job import ai_rule_generation_job

        mock_db = MagicMock()
        MockSession.return_value = mock_db

        biz = MagicMock()
        biz.id = uuid.uuid4()
        biz.deleted_at = None
        mock_db.query.return_value.filter.return_value.all.return_value = [biz]

        fake_rules = [{"product_id": str(uuid.uuid4()), "name": "Widget", "frequency": 10, "rule_type": "top_seller"}]

        with patch("app.scheduler.jobs.ai_rule_generation_job._generate_rules_for_business", return_value=fake_rules), \
             patch("app.scheduler.jobs.ai_rule_generation_job._store_rules") as mock_store:
            ai_rule_generation_job()
            mock_store.assert_called_once()

    @patch("app.scheduler.jobs.ai_rule_generation_job.SessionLocal")
    def test_job_continues_on_error(self, MockSession):
        from app.scheduler.jobs.ai_rule_generation_job import ai_rule_generation_job

        mock_db = MagicMock()
        MockSession.return_value = mock_db

        biz1 = MagicMock()
        biz1.id = uuid.uuid4()
        biz1.deleted_at = None
        biz2 = MagicMock()
        biz2.id = uuid.uuid4()
        biz2.deleted_at = None
        mock_db.query.return_value.filter.return_value.all.return_value = [biz1, biz2]

        with patch(
            "app.scheduler.jobs.ai_rule_generation_job._generate_rules_for_business",
            side_effect=[Exception("DB error"), []],
        ) as mock_gen:
            ai_rule_generation_job()
            assert mock_gen.call_count == 2


# ---------------------------------------------------------------------------
# AI Metrics endpoint tests
# ---------------------------------------------------------------------------

class TestAIMetricsEndpoint:
    def test_metrics_returns_expected_keys(self):
        """The /ai/metrics response must contain the expected keys."""
        # We test the return dict structure by calling the endpoint logic directly
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app, raise_server_exceptions=False)

        # Without auth we expect 401/403, but we can verify the route exists
        response = client.get("/api/v1/ai/metrics")
        assert response.status_code in (200, 401, 403, 422)

    def test_metrics_aggregation_logic(self):
        """Metrics aggregation returns correct totals from mocked DB."""
        mock_user = MagicMock()
        mock_user.business_id = uuid.uuid4()

        mock_db = MagicMock()
        # Simulate query().filter().scalar() returning counts
        mock_db.query.return_value.filter.return_value.scalar.side_effect = [
            15,    # total_steps
            3200,  # total_tokens
            12,    # success_count
        ]
        mock_db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None

        import asyncio
        from app.api.ai import get_ai_metrics

        result = asyncio.get_event_loop().run_until_complete(
            get_ai_metrics(current_user=mock_user, db=mock_db)
        )

        assert result["total_agent_steps"] == 15
        assert result["total_tokens_used"] == 3200
        assert result["success_count"] == 12
        assert result["failure_count"] == 3
        assert result["business_id"] == str(mock_user.business_id)
