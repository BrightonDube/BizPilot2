"""
Comprehensive tests for the Marketing AI Context module.

Tests cover:
- MARKETING_AI_CONTEXT dict structure and content
- AI_RESPONSE_CONFIG dict structure
- MarketingAIValidator static methods
- MarketingAIContextManager class methods
"""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

import pytest
from app.services.marketing_ai_context import (
    MARKETING_AI_CONTEXT,
    AI_RESPONSE_CONFIG,
    MarketingAIValidator,
    MarketingAIContextManager,
)


# ---------------------------------------------------------------------------
# MARKETING_AI_CONTEXT structure tests
# ---------------------------------------------------------------------------
class TestMarketingAIContext:
    """Tests for the MARKETING_AI_CONTEXT dictionary."""

    def test_type_is_marketing(self):
        assert MARKETING_AI_CONTEXT["type"] == "marketing"

    def test_has_all_top_level_keys(self):
        expected_keys = {
            "type",
            "knowledge_base",
            "capabilities",
            "restrictions",
            "fallback_responses",
            "response_templates",
            "contact_routing",
        }
        assert expected_keys.issubset(MARKETING_AI_CONTEXT.keys())

    # -- knowledge_base --
    def test_knowledge_base_is_nonempty_list_of_strings(self):
        kb = MARKETING_AI_CONTEXT["knowledge_base"]
        assert isinstance(kb, list)
        assert len(kb) > 0
        assert all(isinstance(item, str) for item in kb)

    def test_knowledge_base_includes_pricing_info(self):
        kb_text = " ".join(MARKETING_AI_CONTEXT["knowledge_base"])
        for tier in ["Pilot Solo", "Pilot Lite", "Pilot Core", "Pilot Pro", "Enterprise"]:
            assert tier in kb_text, f"Missing pricing tier: {tier}"

    def test_knowledge_base_mentions_south_africa(self):
        kb_text = " ".join(MARKETING_AI_CONTEXT["knowledge_base"])
        assert "South Africa" in kb_text

    # -- capabilities --
    def test_capabilities_is_nonempty_list(self):
        caps = MARKETING_AI_CONTEXT["capabilities"]
        assert isinstance(caps, list) and len(caps) > 0

    # -- restrictions --
    def test_restrictions_is_nonempty_list(self):
        r = MARKETING_AI_CONTEXT["restrictions"]
        assert isinstance(r, list) and len(r) > 0

    # -- fallback_responses --
    def test_fallback_responses_has_expected_categories(self):
        fb = MARKETING_AI_CONTEXT["fallback_responses"]
        for cat in ["business_specific", "technical_support", "pricing_negotiation", "account_access"]:
            assert cat in fb
            assert isinstance(fb[cat], list) and len(fb[cat]) > 0

    # -- response_templates --
    def test_response_templates_have_pattern_and_response(self):
        templates = MARKETING_AI_CONTEXT["response_templates"]
        assert len(templates) > 0
        for key, tmpl in templates.items():
            assert "pattern" in tmpl, f"Template '{key}' missing 'pattern'"
            assert "response" in tmpl, f"Template '{key}' missing 'response'"
            assert isinstance(tmpl["pattern"], list)
            assert isinstance(tmpl["response"], str)

    def test_response_templates_expected_keys(self):
        templates = MARKETING_AI_CONTEXT["response_templates"]
        expected = {"pricing_inquiry", "feature_inquiry", "comparison_inquiry", "industry_inquiry", "getting_started"}
        assert expected == set(templates.keys())

    # -- contact_routing --
    def test_contact_routing_has_expected_keys(self):
        cr = MARKETING_AI_CONTEXT["contact_routing"]
        expected = {"sales_inquiries", "support_inquiries", "general_inquiries"}
        assert expected == set(cr.keys())

    def test_contact_routing_entries_have_triggers_and_contact(self):
        for key, route in MARKETING_AI_CONTEXT["contact_routing"].items():
            assert "triggers" in route, f"Route '{key}' missing 'triggers'"
            assert "contact" in route, f"Route '{key}' missing 'contact'"
            assert isinstance(route["triggers"], list)
            assert isinstance(route["contact"], dict)

    def test_sales_contact_has_email_and_phone(self):
        sales = MARKETING_AI_CONTEXT["contact_routing"]["sales_inquiries"]["contact"]
        assert "email" in sales
        assert "phone" in sales

    def test_general_contact_has_urls(self):
        general = MARKETING_AI_CONTEXT["contact_routing"]["general_inquiries"]["contact"]
        assert "signup_url" in general
        assert "demo_url" in general


# ---------------------------------------------------------------------------
# AI_RESPONSE_CONFIG tests
# ---------------------------------------------------------------------------
class TestAIResponseConfig:
    """Tests for the AI_RESPONSE_CONFIG dictionary."""

    def test_has_expected_keys(self):
        expected = {
            "max_response_length",
            "tone",
            "style",
            "include_next_steps",
            "include_contact_info",
            "personalization_level",
        }
        assert expected == set(AI_RESPONSE_CONFIG.keys())

    def test_max_response_length_is_positive_int(self):
        assert isinstance(AI_RESPONSE_CONFIG["max_response_length"], int)
        assert AI_RESPONSE_CONFIG["max_response_length"] > 0

    def test_booleans(self):
        assert AI_RESPONSE_CONFIG["include_next_steps"] is True
        assert AI_RESPONSE_CONFIG["include_contact_info"] is True

    def test_personalization_level_is_general(self):
        assert AI_RESPONSE_CONFIG["personalization_level"] == "general"


# ---------------------------------------------------------------------------
# MarketingAIValidator tests
# ---------------------------------------------------------------------------
class TestMarketingAIValidator:
    """Tests for MarketingAIValidator static methods."""

    # -- validate_marketing_response --
    class TestValidateMarketingResponse:
        @pytest.mark.parametrize(
            "text",
            [
                "BizPilot offers five pricing tiers.",
                "Our POS system supports offline capability.",
                "",
                "   ",
            ],
        )
        def test_valid_responses(self, text):
            assert MarketingAIValidator.validate_marketing_response(text) is True

        @pytest.mark.parametrize(
            "restricted_phrase",
            [
                "your business data",
                "your account",
                "your orders",
                "your customers",
                "your inventory",
                "your sales",
                "login to see",
                "in your dashboard",
            ],
        )
        def test_restricted_terms_rejected(self, restricted_phrase):
            response = f"Here is {restricted_phrase} information."
            assert MarketingAIValidator.validate_marketing_response(response) is False

        def test_case_insensitive_rejection(self):
            assert MarketingAIValidator.validate_marketing_response("YOUR BUSINESS DATA is here") is False
            assert MarketingAIValidator.validate_marketing_response("Your Account details") is False

        def test_partial_match_passes(self):
            # "your" alone should NOT trigger; only the full phrase should
            assert MarketingAIValidator.validate_marketing_response("We value your feedback") is True

        def test_multiple_restricted_terms(self):
            text = "Check your account and your orders"
            assert MarketingAIValidator.validate_marketing_response(text) is False

    # -- is_marketing_question --
    class TestIsMarketingQuestion:
        @pytest.mark.parametrize(
            "question",
            [
                "What are the features of BizPilot?",
                "How much does it cost?",
                "Tell me about pricing",
                "Can BizPilot help restaurants?",
                "How does BizPilot compare to competitors?",
                "Is there a demo?",
                "Tell me about enterprise plans",
                "What support options are available?",
                "How do I start?",
                "about bizpilot",
            ],
        )
        def test_marketing_questions_accepted(self, question):
            assert MarketingAIValidator.is_marketing_question(question) is True

        @pytest.mark.parametrize(
            "question",
            [
                "Show me my business data",
                "What are my sales today?",
                "Access my account",
                "Show me my customers",
                "Where is my inventory report?",
                "View my dashboard",
                "Show me my analytics",
                "What is my performance?",
                "See my reports",
                "Access data for my store",
            ],
        )
        def test_business_specific_questions_rejected(self, question):
            assert MarketingAIValidator.is_marketing_question(question) is False

        def test_case_insensitive_marketing_keyword(self):
            assert MarketingAIValidator.is_marketing_question("WHAT ARE THE FEATURES?") is True
            assert MarketingAIValidator.is_marketing_question("Pricing Information") is True

        def test_case_insensitive_business_rejection(self):
            assert MarketingAIValidator.is_marketing_question("MY BUSINESS data") is False
            assert MarketingAIValidator.is_marketing_question("Show Me My Orders") is False

        def test_business_specific_wins_over_marketing(self):
            """If a question contains both business-specific and marketing terms,
            business-specific takes priority and the question is rejected."""
            assert MarketingAIValidator.is_marketing_question("Show me my business features") is False
            assert MarketingAIValidator.is_marketing_question("What is the pricing of my account?") is False
            assert MarketingAIValidator.is_marketing_question("My dashboard demo") is False

        def test_empty_string_returns_false(self):
            assert MarketingAIValidator.is_marketing_question("") is False

        def test_no_keywords_returns_false(self):
            # "What is" is a marketing keyword, so avoid it here
            assert MarketingAIValidator.is_marketing_question("Good morning") is False
            assert MarketingAIValidator.is_marketing_question("The sky is blue") is False

    # -- get_response_template --
    class TestGetResponseTemplate:
        def test_pricing_template(self):
            for keyword in ["price", "cost", "pricing", "how much", "tier", "plan"]:
                result = MarketingAIValidator.get_response_template(f"What is the {keyword}?")
                assert result is not None
                assert "Pilot Solo" in result

        def test_feature_template(self):
            result = MarketingAIValidator.get_response_template("What features does BizPilot have?")
            assert result is not None
            assert "POS" in result

        def test_comparison_template(self):
            result = MarketingAIValidator.get_response_template("How does BizPilot compare?")
            assert result is not None
            assert "integrated" in result.lower()

        def test_industry_template(self):
            result = MarketingAIValidator.get_response_template("Can BizPilot work for a restaurant?")
            assert result is not None
            assert "restaurant" in result.lower()

        def test_getting_started_template(self):
            result = MarketingAIValidator.get_response_template("How do I start?")
            assert result is not None
            assert "free" in result.lower()

        def test_no_match_returns_none(self):
            assert MarketingAIValidator.get_response_template("What is the weather?") is None
            assert MarketingAIValidator.get_response_template("") is None

        def test_case_insensitive_template_match(self):
            result = MarketingAIValidator.get_response_template("PRICING INFO")
            assert result is not None

        def test_first_matching_template_wins(self):
            """'price' matches pricing_inquiry; the function should return the
            pricing template, not a later one even if another also matches."""
            result = MarketingAIValidator.get_response_template("price")
            assert result is not None
            assert "5 tiers" in result  # pricing template text

    # -- get_contact_info --
    class TestGetContactInfo:
        def test_sales_trigger(self):
            for trigger in ["enterprise", "custom pricing", "franchise", "demo"]:
                info = MarketingAIValidator.get_contact_info(f"I want {trigger} details")
                assert "email" in info
                assert "sales@bizpilot.co.za" in info.get("email", "")

        def test_support_trigger(self):
            for trigger in ["technical", "account", "login", "problem", "issue"]:
                info = MarketingAIValidator.get_contact_info(f"I have a {trigger}")
                assert "email" in info
                assert "support@bizpilot.co.za" in info.get("email", "")

        def test_general_trigger(self):
            info = MarketingAIValidator.get_contact_info("I want more information")
            assert "signup_url" in info

        def test_no_trigger_falls_back_to_general(self):
            info = MarketingAIValidator.get_contact_info("Random query with no triggers")
            assert "signup_url" in info
            assert info == MARKETING_AI_CONTEXT["contact_routing"]["general_inquiries"]["contact"]

        def test_empty_string_falls_back_to_general(self):
            info = MarketingAIValidator.get_contact_info("")
            assert "signup_url" in info

        def test_case_insensitive_trigger(self):
            info = MarketingAIValidator.get_contact_info("ENTERPRISE quote please")
            assert "sales@bizpilot.co.za" in info.get("email", "")

        def test_first_matching_route_wins(self):
            """If question contains triggers from multiple routes, the first
            route in iteration order wins (sales before support)."""
            info = MarketingAIValidator.get_contact_info("enterprise account issue")
            assert "email" in info
            # sales_inquiries comes first in the dict
            assert "sales@bizpilot.co.za" in info.get("email", "")

    # -- get_fallback_response --
    class TestGetFallbackResponse:
        @pytest.mark.parametrize(
            "qtype",
            ["business_specific", "technical_support", "pricing_negotiation", "account_access"],
        )
        def test_known_types_return_first_response(self, qtype):
            result = MarketingAIValidator.get_fallback_response(qtype)
            expected_first = MARKETING_AI_CONTEXT["fallback_responses"][qtype][0]
            assert result == expected_first

        def test_unknown_type_returns_default_message(self):
            result = MarketingAIValidator.get_fallback_response("nonexistent_category")
            assert "general BizPilot questions" in result

        def test_empty_string_type_returns_default(self):
            result = MarketingAIValidator.get_fallback_response("")
            assert "general BizPilot questions" in result


# ---------------------------------------------------------------------------
# MarketingAIContextManager tests
# ---------------------------------------------------------------------------
class TestMarketingAIContextManager:
    """Tests for the MarketingAIContextManager class."""

    @pytest.fixture()
    def manager(self):
        return MarketingAIContextManager()

    # -- __init__ --
    def test_init_sets_context_and_config(self, manager):
        assert manager.context is MARKETING_AI_CONTEXT
        assert manager.config is AI_RESPONSE_CONFIG
        assert isinstance(manager.validator, MarketingAIValidator)

    # -- get_knowledge_base --
    def test_get_knowledge_base_returns_list(self, manager):
        kb = manager.get_knowledge_base()
        assert isinstance(kb, list)
        assert kb is MARKETING_AI_CONTEXT["knowledge_base"]

    # -- get_capabilities --
    def test_get_capabilities(self, manager):
        caps = manager.get_capabilities()
        assert isinstance(caps, list)
        assert caps is MARKETING_AI_CONTEXT["capabilities"]

    # -- get_restrictions --
    def test_get_restrictions(self, manager):
        r = manager.get_restrictions()
        assert isinstance(r, list)
        assert r is MARKETING_AI_CONTEXT["restrictions"]

    # -- process_question (valid marketing question) --
    def test_process_valid_marketing_question(self, manager):
        result = manager.process_question("What are the features?")
        assert result["is_valid"] is True
        assert "template_response" in result
        assert "contact_info" in result
        assert "knowledge_base" in result
        assert isinstance(result["knowledge_base"], list)

    def test_process_valid_question_with_template(self, manager):
        result = manager.process_question("How much does it cost?")
        assert result["is_valid"] is True
        assert result["template_response"] is not None
        assert "Pilot Solo" in result["template_response"]

    def test_process_valid_question_without_template(self, manager):
        result = manager.process_question("Tell me about bizpilot")
        assert result["is_valid"] is True
        # "tell me about" matches marketing keywords, but the word doesn't
        # match any template pattern ⇒ template_response is None
        assert result["template_response"] is None

    # -- process_question (invalid / business-specific question) --
    def test_process_business_specific_question(self, manager):
        result = manager.process_question("Show me my sales data")
        assert result["is_valid"] is False
        assert "response" in result
        assert "contact_info" in result
        # Should NOT have knowledge_base
        assert "knowledge_base" not in result

    def test_process_business_question_returns_fallback(self, manager):
        result = manager.process_question("My business analytics")
        assert result["is_valid"] is False
        expected_fb = MARKETING_AI_CONTEXT["fallback_responses"]["business_specific"][0]
        assert result["response"] == expected_fb

    def test_process_empty_string(self, manager):
        """Empty string has no marketing keywords → treated as invalid."""
        result = manager.process_question("")
        assert result["is_valid"] is False

    def test_process_non_marketing_non_business(self, manager):
        """Generic question with no keywords → invalid."""
        result = manager.process_question("Good morning, nice weather")
        assert result["is_valid"] is False

    def test_process_question_contact_info_for_sales(self, manager):
        result = manager.process_question("Tell me about enterprise plans")
        assert result["is_valid"] is True
        assert "sales@bizpilot.co.za" in result["contact_info"].get("email", "")

    def test_process_question_mixed_triggers(self, manager):
        """Business-specific keyword should reject even with marketing terms."""
        result = manager.process_question("Show me my account features and pricing")
        assert result["is_valid"] is False

    # -- validate_response --
    def test_validate_response_clean(self, manager):
        assert manager.validate_response("BizPilot has great features.") is True

    def test_validate_response_restricted(self, manager):
        assert manager.validate_response("Check your account for details.") is False

    def test_validate_response_empty(self, manager):
        assert manager.validate_response("") is True
