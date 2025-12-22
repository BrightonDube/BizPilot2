"""Tests for app-help knowledge base."""


def test_app_help_kb_scans_routes_without_reading_secrets():
    from app.services.app_help_kb import AppHelpKnowledgeBase

    kb = AppHelpKnowledgeBase()
    ctx = kb.to_context()

    assert "routes" in ctx
    assert isinstance(ctx["routes"], dict)

    # Should contain common dashboard routes if frontend is present
    if ctx["routes"]:
        assert "/dashboard" in ctx["routes"]

    # No secret leakage (we never read file contents)
    serialized = str(ctx)
    assert "SECRET_KEY" not in serialized
    assert "GROQ_API_KEY" not in serialized


def test_app_help_kb_retrieve_returns_relevant_articles():
    from app.services.app_help_kb import AppHelpKnowledgeBase

    kb = AppHelpKnowledgeBase()

    r = kb.retrieve("How do I create an invoice?")
    assert "howTo" in r
    assert "create_invoice" in r["howTo"]

    r2 = kb.retrieve("Where do I record a payment?")
    assert "record_payment" in r2["howTo"]
