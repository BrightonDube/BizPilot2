"""
Marketing AI Context Configuration for Python Backend

This module defines the AI context, capabilities, and restrictions for the guest AI widget.
It provides structured information for AI responses and ensures marketing-only content.

Requirements: 4.1, 4.2, 4.3, 4.4, 2.3, 4.5, 4.6
"""

from typing import Dict, List, Any, Optional, Literal
import re

# Type definitions
AIContextType = Literal['marketing', 'business']
AICapability = Literal['features', 'pricing', 'use_cases', 'support', 'comparison']
AIRestriction = Literal['no_business_data', 'no_user_info', 'no_operations', 'marketing_only']

# Marketing AI Context Configuration
MARKETING_AI_CONTEXT = {
    "type": "marketing",
    
    # Core knowledge base for AI responses
    "knowledge_base": [
        # Company and Platform Information
        "BizPilot is a comprehensive business management platform launched in 2023, based in South Africa.",
        "BizPilot combines POS (Point of Sale), inventory management, CRM, and business analytics in one integrated solution.",
        "The platform is designed to help businesses of all sizes streamline operations and increase profitability.",
        "BizPilot works on tablets, smartphones, computers, and dedicated POS terminals with offline capability.",
        "The platform uses enterprise-grade security with data encryption, secure cloud hosting, and regular backups.",
        
        # Pricing Structure - All 5 Tiers
        "BizPilot offers 5 pricing tiers to match different business needs and sizes:",
        "Pilot Solo (Free): Perfect for solo entrepreneurs and market stalls. Includes 1 user, up to 50 orders/month, basic POS functionality.",
        "Pilot Lite (R199/month): Ideal for coffee shops and food trucks. Includes up to 3 users, unlimited orders, basic reports, customer management.",
        "Pilot Core (R799/month): Perfect for restaurants and retail stores. Includes unlimited users, full inventory management, cost calculations, integrations.",
        "Pilot Pro (R1,499/month): For growing businesses and chains. Includes AI insights, multi-location management, priority support, API access.",
        "Enterprise (Custom Pricing): For large businesses and franchises. Includes unlimited everything, white labeling, custom development, dedicated support.",
        
        # Enterprise Tier Details
        "Enterprise tier includes 99.9% uptime SLA guarantee with financial compensation for downtime.",
        "Enterprise customers get dedicated account managers and 24/7 support with guaranteed response times.",
        "Enterprise tier supports white labeling with custom branding, logos, colors, and domain names.",
        "Enterprise includes custom feature development and specialized integrations with existing systems.",
        "Enterprise pricing is customized based on specific requirements - contact sales team for personalized quote.",
        
        # Core Features Available Across Tiers
        "POS System: Touch-friendly interface, offline capability, multiple payment methods (cash, card, digital wallets).",
        "Customer Management: Customer profiles, purchase history, loyalty programs, communication tools.",
        "Reporting & Analytics: Real-time dashboards, customizable reports, profit analysis, staff performance tracking.",
        "Team Collaboration: Multi-user access, role-based permissions, staff scheduling, performance monitoring.",
        
        # Advanced Features (Higher Tiers)
        "Inventory Management (Core+): Real-time stock tracking, automated reordering, supplier management, barcode scanning.",
        "AI Insights (Pro+): Sales forecasting, inventory optimization, customer behavior analysis, pricing recommendations.",
        "Multi-Location (Pro+): Centralized management, location-specific reporting, inventory transfers, consolidated analytics.",
        "Integrations (Core+): Xero and Sage accounting, PayStack payments, email marketing, delivery services.",
        
        # Industry Applications
        "Restaurants & Cafes: Recipe management, ingredient tracking, kitchen integration, food cost analysis.",
        "Retail Stores: Product catalogs, supplier management, customer loyalty, sales trend analysis.",
        "Coffee Shops & Food Trucks: Fast service, mobile POS, peak time analytics, payment flexibility.",
        "Multi-Location Businesses: Centralized control, cross-location reporting, inventory balancing.",
        "Enterprise & Franchises: Custom workflows, compliance tools, brand consistency, scalable operations.",
        
        # Key Benefits and Value Propositions
        "Cost Savings: Reduce staff time on admin tasks by 40%, minimize inventory waste, lower accounting costs.",
        "Revenue Growth: Faster service increases turnover, loyalty programs boost repeat business, AI optimizes pricing.",
        "Time Savings: Automated inventory management, integrated reporting, streamlined operations.",
        "Better Insights: Real-time dashboards, AI forecasting, customer analytics, profitability analysis.",
        "Scalability: Add locations and users without limits, centralized management, enterprise customization.",
        
        # Support and Training
        "All tiers include email support with comprehensive training materials and video tutorials.",
        "Pilot Pro includes priority support with faster response times.",
        "Enterprise customers get dedicated account managers, 24/7 support, and on-site training.",
        "Free data migration assistance available for customers upgrading from other systems.",
        
        # Getting Started Information
        "Start immediately with free Pilot Solo tier - no credit card required, no time limit.",
        "Upgrade or downgrade plans anytime with immediate effect and prorated billing.",
        "Comprehensive onboarding process guides setup within minutes of signup.",
        "Demo available to see BizPilot in action before committing to any paid tier."
    ],
    
    # AI Capabilities - What the marketing AI can do
    "capabilities": [
        "Answer questions about BizPilot features and benefits across all tiers",
        "Provide detailed pricing information and plan comparisons including Enterprise tier",
        "Explain industry use cases and applications for different business types",
        "Help with feature selection and tier recommendations based on business needs",
        "Provide contact information and next steps for sales or support",
        "Compare BizPilot with other business management solutions",
        "Explain integration capabilities and technical requirements",
        "Discuss security features and compliance capabilities",
        "Provide information about support levels and training options",
        "Help understand Enterprise tier benefits and custom pricing process"
    ],
    
    # AI Restrictions - What the marketing AI cannot do
    "restrictions": [
        "Cannot access any business data or user information",
        "Cannot provide business-specific advice or analysis",
        "Cannot perform business operations or transactions",
        "Cannot access authenticated user accounts or settings",
        "Cannot provide technical support for existing customers",
        "Cannot make pricing commitments or negotiate contracts",
        "Cannot access or modify any business configurations",
        "Cannot provide specific implementation timelines or guarantees"
    ],
    
    # Fallback responses for out-of-scope questions
    "fallback_responses": {
        "business_specific": [
            "For detailed business analysis and specific advice about your operations, please sign up for a free Pilot Solo account to access our full AI capabilities.",
            "I can help with general BizPilot questions, but for business-specific guidance, our AI works best when it has access to your business data through a registered account.",
            "To get personalized recommendations for your specific business needs, I'd recommend starting with our free tier or scheduling a demo with our sales team."
        ],
        "technical_support": [
            "For technical support with your BizPilot account, please contact our support team at support@bizpilot.co.za or use the support chat in your dashboard.",
            "I can provide general information about BizPilot features, but for account-specific technical issues, our support team can help you directly.",
            "Technical support is available through your BizPilot dashboard or by contacting support@bizpilot.co.za."
        ],
        "pricing_negotiation": [
            "For Enterprise pricing and custom arrangements, please contact our sales team at sales@bizpilot.co.za or call +27 (0) 21 123 4567.",
            "Enterprise pricing is customized based on your specific needs. Our sales team can provide a personalized quote after understanding your requirements.",
            "I can explain our standard pricing tiers, but for custom Enterprise pricing, our sales team will work with you to create a tailored proposal."
        ],
        "account_access": [
            "I don't have access to account information or settings. For account-related questions, please log into your BizPilot dashboard or contact support.",
            "Account management and settings are handled through your BizPilot dashboard. If you need help accessing your account, contact support@bizpilot.co.za.",
            "For account-specific questions, please use the AI chat within your BizPilot dashboard where I can access your business context."
        ]
    },
    
    # Common question patterns and responses
    "response_templates": {
        "pricing_inquiry": {
            "pattern": ["price", "cost", "pricing", "how much", "tier", "plan"],
            "response": "BizPilot offers 5 tiers: Pilot Solo (Free), Pilot Lite (R199/month), Pilot Core (R799/month), Pilot Pro (R1,499/month), and Enterprise (Custom pricing). Each tier is designed for different business sizes and needs. Would you like me to explain which tier might be best for your type of business?"
        },
        "feature_inquiry": {
            "pattern": ["features", "what does", "capabilities", "functionality"],
            "response": "BizPilot includes POS, inventory management, customer management, reporting, and team collaboration. Higher tiers add AI insights, multi-location management, and advanced integrations. Enterprise tier includes custom development and white labeling. What specific features are you most interested in?"
        },
        "comparison_inquiry": {
            "pattern": ["compare", "difference", "vs", "versus", "better than"],
            "response": "BizPilot stands out with its integrated approach - combining POS, inventory, CRM, and analytics in one platform. Unlike basic POS systems, we offer AI insights, multi-location management, and enterprise customization. Our South African focus means local payment integration and support. What specific comparisons would help you?"
        },
        "industry_inquiry": {
            "pattern": ["restaurant", "retail", "coffee", "business type", "industry"],
            "response": "BizPilot works great for restaurants, retail stores, coffee shops, and multi-location businesses. Each industry has specific needs - restaurants benefit from recipe management, retail from inventory tracking, coffee shops from fast POS. What type of business are you running?"
        },
        "getting_started": {
            "pattern": ["start", "begin", "signup", "trial", "demo"],
            "response": "You can start immediately with our free Pilot Solo tier - no credit card required! This gives you access to basic POS functionality for up to 50 orders per month. You can also schedule a demo to see the full platform in action. Would you like me to explain the signup process?"
        }
    },
    
    # Contact information for different inquiries
    "contact_routing": {
        "sales_inquiries": {
            "triggers": ["enterprise", "custom pricing", "large business", "franchise", "demo"],
            "contact": {
                "email": "sales@bizpilot.co.za",
                "phone": "+27 (0) 21 123 4567",
                "message": "For Enterprise inquiries and custom pricing, our sales team can provide a personalized consultation."
            }
        },
        "support_inquiries": {
            "triggers": ["technical", "account", "login", "problem", "issue"],
            "contact": {
                "email": "support@bizpilot.co.za",
                "phone": "+27 (0) 21 123 4568",
                "message": "For technical support and account help, our support team is ready to assist you."
            }
        },
        "general_inquiries": {
            "triggers": ["information", "learn more", "questions"],
            "contact": {
                "signup_url": "https://bizpilot.co.za/signup",
                "demo_url": "https://bizpilot.co.za/demo",
                "message": "Start with our free tier or schedule a demo to see BizPilot in action."
            }
        }
    }
}

# AI Response Configuration
AI_RESPONSE_CONFIG = {
    "max_response_length": 500,
    "tone": "helpful and professional",
    "style": "conversational but informative",
    "include_next_steps": True,
    "include_contact_info": True,
    "personalization_level": "general"  # No personal data access
}

class MarketingAIValidator:
    """Validation functions for AI responses"""
    
    @staticmethod
    def validate_marketing_response(response: str) -> bool:
        """Validate that response contains only marketing content"""
        restricted_terms = [
            'your business data',
            'your account',
            'your orders',
            'your customers',
            'your inventory',
            'your sales',
            'login to see',
            'in your dashboard'
        ]
        
        response_lower = response.lower()
        return not any(term.lower() in response_lower for term in restricted_terms)
    
    @staticmethod
    def is_marketing_question(question: str) -> bool:
        """Check if question is appropriate for marketing AI"""
        marketing_keywords = [
            'features', 'pricing', 'cost', 'price', 'tier', 'plan',
            'what is', 'how does', 'can bizpilot', 'does bizpilot',
            'restaurant', 'retail', 'coffee', 'business',
            'demo', 'trial', 'signup', 'start', 'begin',
            'compare', 'difference', 'better', 'vs',
            'enterprise', 'custom', 'support', 'help'
        ]
        
        question_lower = question.lower()
        return any(keyword.lower() in question_lower for keyword in marketing_keywords)
    
    @staticmethod
    def get_response_template(question: str) -> Optional[str]:
        """Get appropriate response template for question"""
        templates = MARKETING_AI_CONTEXT["response_templates"]
        question_lower = question.lower()
        
        for template_key, template in templates.items():
            if any(pattern.lower() in question_lower for pattern in template["pattern"]):
                return template["response"]
        
        return None
    
    @staticmethod
    def get_contact_info(question: str) -> Dict[str, Any]:
        """Get appropriate contact information based on question"""
        routing = MARKETING_AI_CONTEXT["contact_routing"]
        question_lower = question.lower()
        
        for route_key, route in routing.items():
            if any(trigger.lower() in question_lower for trigger in route["triggers"]):
                return route["contact"]
        
        return routing["general_inquiries"]["contact"]
    
    @staticmethod
    def get_fallback_response(question_type: str) -> str:
        """Get appropriate fallback response"""
        fallbacks = MARKETING_AI_CONTEXT["fallback_responses"]
        
        if question_type in fallbacks:
            responses = fallbacks[question_type]
            # Return first response for simplicity, could be randomized
            return responses[0] if responses else "I can help with general BizPilot questions. For specific assistance, please contact our support team."
        
        return "I can help with general BizPilot questions. For specific assistance, please contact our support team."

class MarketingAIContextManager:
    """Manager class for marketing AI context operations"""
    
    def __init__(self):
        self.context = MARKETING_AI_CONTEXT
        self.config = AI_RESPONSE_CONFIG
        self.validator = MarketingAIValidator()
    
    def get_knowledge_base(self) -> List[str]:
        """Get the complete knowledge base"""
        return self.context["knowledge_base"]
    
    def get_capabilities(self) -> List[str]:
        """Get AI capabilities"""
        return self.context["capabilities"]
    
    def get_restrictions(self) -> List[str]:
        """Get AI restrictions"""
        return self.context["restrictions"]
    
    def process_question(self, question: str) -> Dict[str, Any]:
        """Process a question and return appropriate response data"""
        if not self.validator.is_marketing_question(question):
            return {
                "is_valid": False,
                "response": self.validator.get_fallback_response("business_specific"),
                "contact_info": self.validator.get_contact_info(question)
            }
        
        template_response = self.validator.get_response_template(question)
        contact_info = self.validator.get_contact_info(question)
        
        return {
            "is_valid": True,
            "template_response": template_response,
            "contact_info": contact_info,
            "knowledge_base": self.get_knowledge_base()
        }
    
    def validate_response(self, response: str) -> bool:
        """Validate AI response for marketing compliance"""
        return self.validator.validate_marketing_response(response)

# Export the main components
__all__ = [
    'MARKETING_AI_CONTEXT',
    'AI_RESPONSE_CONFIG',
    'MarketingAIValidator',
    'MarketingAIContextManager'
]