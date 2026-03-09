"""Unit tests for AIService (synchronous methods only; async mocked)."""
import os
os.environ.setdefault("SECRET_KEY", "test-secret-key")

from unittest.mock import MagicMock, patch, AsyncMock
from uuid import uuid4

import pytest

from app.services.ai_service import AIService
from app.models.user_settings import AIDataSharingLevel
from fastapi import HTTPException


USR = uuid4()
CONV = uuid4()
BIZ_ID = uuid4()


def _svc():
    db = MagicMock()
    return AIService(db), db


def _chain(first=None, rows=None, count=0, scalar=None):
    c = MagicMock()
    c.filter.return_value = c
    c.join.return_value = c
    c.order_by.return_value = c
    c.offset.return_value = c
    c.limit.return_value = c
    c.all.return_value = rows if rows is not None else []
    c.first.return_value = first
    c.count.return_value = count
    c.scalar.return_value = scalar
    return c


# ── User settings ────────────────────────────────────────────────────


class TestUserSettings:
    def test_get_existing(self):
        svc, db = _svc()
        settings = MagicMock()
        db.query.return_value = _chain(first=settings)
        assert svc.get_or_create_user_settings(USR) == settings
        db.add.assert_not_called()

    def test_create_new(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        result = svc.get_or_create_user_settings(USR)
        db.add.assert_called_once()
        db.commit.assert_called()

    def test_update(self):
        svc, db = _svc()
        settings = MagicMock()
        db.query.return_value = _chain(first=settings)
        result = svc.update_user_settings(USR, AIDataSharingLevel.METRICS_ONLY)
        assert result.ai_data_sharing_level == AIDataSharingLevel.METRICS_ONLY


# ── Conversations ────────────────────────────────────────────────────


class TestConversations:
    def test_list(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[MagicMock()])
        result = svc.list_conversations(USR)
        assert len(result) == 1

    def test_create(self):
        svc, db = _svc()
        result = svc.create_conversation(USR, title="Test")
        assert db.add.call_count >= 2  # conversation + welcome msg
        db.commit.assert_called()

    def test_delete(self):
        svc, db = _svc()
        convo = MagicMock()
        db.query.return_value = _chain(first=convo)
        svc.delete_conversation(USR, CONV)
        convo.soft_delete.assert_called_once()

    def test_delete_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        with pytest.raises(HTTPException) as exc:
            svc.delete_conversation(USR, CONV)
        assert exc.value.status_code == 404


# ── Messages ─────────────────────────────────────────────────────────


class TestMessages:
    def test_list(self):
        svc, db = _svc()
        convo = MagicMock()
        convo.id = CONV
        msg = MagicMock()
        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(first=convo)
            return _chain(rows=[msg])
        db.query.side_effect = side_effect
        result = svc.list_messages(USR, CONV)
        assert len(result) == 1

    def test_add(self):
        svc, db = _svc()
        convo = MagicMock()
        convo.id = CONV
        db.query.return_value = _chain(first=convo)
        result = svc.add_message(USR, CONV, "Hello", True)
        db.add.assert_called()


# ── Business context ─────────────────────────────────────────────────


class TestBusinessContext:
    def test_no_business(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        user = MagicMock()
        user.id = USR
        ctx = svc.build_business_context(user, AIDataSharingLevel.FULL_BUSINESS)
        assert ctx["businessName"] == ""
        assert ctx["totalProducts"] == 0

    def test_none_level(self):
        svc, db = _svc()
        bu = MagicMock()
        bu.business_id = BIZ_ID
        biz = MagicMock()
        biz.id = BIZ_ID
        biz.name = "Acme"
        biz.currency = "ZAR"
        call_count = [0]
        def side_effect(*args):
            call_count[0] += 1
            if call_count[0] == 1:
                return _chain(first=bu)
            return _chain(first=biz)
        db.query.side_effect = side_effect
        user = MagicMock()
        user.id = USR
        ctx = svc.build_business_context(user, AIDataSharingLevel.NONE)
        assert ctx["businessName"] == "Acme"
        assert ctx["totalProducts"] == 0  # not fetched for NONE level


# ── Context mode detection ───────────────────────────────────────────


class TestContextModeDetection:
    def test_app_help(self):
        svc, _ = _svc()
        assert svc.detect_context_mode("How do I navigate to settings?") == "app_help"

    def test_business(self):
        svc, _ = _svc()
        assert svc.detect_context_mode("What are my total sales?") == "business"

    def test_mixed(self):
        svc, _ = _svc()
        assert svc.detect_context_mode("How do I check my revenue?") == "mixed"

    def test_default_mixed(self):
        svc, _ = _svc()
        assert svc.detect_context_mode("Hello there") == "mixed"


# ── System prompt builder ────────────────────────────────────────────


class TestSystemPrompt:
    def test_no_context(self):
        svc, _ = _svc()
        prompt = svc._build_grounded_system_prompt(None, None)
        assert "BizPilot AI" in prompt

    def test_with_app_context(self):
        svc, _ = _svc()
        prompt = svc._build_grounded_system_prompt({"appName": "BizPilot"}, None)
        assert "APP CONTEXT" in prompt

    def test_with_biz_context(self):
        svc, _ = _svc()
        prompt = svc._build_grounded_system_prompt(None, {"businessName": "Acme"})
        assert "BUSINESS CONTEXT" in prompt


# ── Async methods (Groq call) ────────────────────────────────────────


class TestAsyncMethods:
    @pytest.mark.asyncio
    async def test_generate_title_no_key(self):
        svc, _ = _svc()
        with patch("app.services.ai_service.settings") as mock_settings:
            mock_settings.GROQ_API_KEY = ""
            result = await svc.generate_conversation_title("Hello")
            assert result == "New Conversation"

    @pytest.mark.asyncio
    async def test_generate_title_success(self):
        svc, _ = _svc()
        with patch.object(svc, "_call_groq", new_callable=AsyncMock) as mock_groq:
            mock_groq.return_value = '"Sales Overview"'
            with patch("app.services.ai_service.settings") as mock_settings:
                mock_settings.GROQ_API_KEY = "test-key"
                result = await svc.generate_conversation_title("Show me sales")
                assert result == "Sales Overview"

    @pytest.mark.asyncio
    async def test_generate_title_error(self):
        svc, _ = _svc()
        with patch.object(svc, "_call_groq", new_callable=AsyncMock) as mock_groq:
            mock_groq.side_effect = Exception("API error")
            with patch("app.services.ai_service.settings") as mock_settings:
                mock_settings.GROQ_API_KEY = "test-key"
                result = await svc.generate_conversation_title("Hello")
                assert result == "New Conversation"

    @pytest.mark.asyncio
    async def test_call_groq_no_key(self):
        svc, _ = _svc()
        with patch("app.services.ai_service.settings") as mock_settings:
            mock_settings.GROQ_API_KEY = ""
            with pytest.raises(RuntimeError, match="Groq API key not configured"):
                await svc._call_groq([{"role": "user", "content": "hi"}])
