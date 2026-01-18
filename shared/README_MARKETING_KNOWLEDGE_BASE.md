# Marketing Knowledge Base Documentation

This document describes the comprehensive marketing knowledge base created for the BizPilot guest AI widget. The knowledge base provides structured information about BizPilot features, pricing, use cases, and benefits for potential customers visiting marketing pages.

## Overview

The marketing knowledge base consists of several interconnected modules that provide comprehensive information about BizPilot to the guest AI widget. This ensures consistent, accurate, and helpful responses to potential customers without exposing any business-specific data.

## Files Structure

### Core Knowledge Base Files

1. **`marketing_knowledge_base.py`** - Python version of the complete knowledge base
2. **`marketing-knowledge-base.ts`** - TypeScript version for frontend use
3. **`marketing_ai_context.py`** - Python AI context configuration and validation
4. **`marketing-ai-context.ts`** - TypeScript AI context configuration

## Knowledge Base Components

### 1. BizPilot Features (`BIZPILOT_FEATURES`)

Comprehensive information about core BizPilot features available across different tiers:

- **POS System**: Touch-friendly interface, offline capability, multi-payment support
- **Inventory Management**: Stock tracking, automated reordering, supplier management
- **Customer Management**: CRM, loyalty programs, purchase history
- **Reporting & Analytics**: Real-time dashboards, customizable reports
- **AI Insights**: Sales forecasting, optimization recommendations (Pro+ tiers)
- **Multi-Location**: Centralized management for multiple locations (Pro+ tiers)
- **Integrations**: Third-party connections (Xero, Sage, PayStack)
- **Team Collaboration**: Multi-user access, role-based permissions

### 2. Enterprise Features (`ENTERPRISE_FEATURES`)

Specialized features available only in the Enterprise tier:

- **White Labeling**: Custom branding, logos, colors, domain
- **Custom Development**: Tailored features and integrations
- **Dedicated Account Manager**: Personal support representative
- **SLA Guarantee**: 99.9% uptime with financial penalties
- **Advanced Security**: SSO, audit logs, compliance tools
- **Custom Workflows**: Automated business processes

### 3. Pricing Information (`PRICING_INFORMATION`)

Detailed pricing structure for all 5 tiers:

#### Pilot Solo (Free)
- **Target**: Solo entrepreneurs, market stalls
- **Features**: 1 user, 50 orders/month, basic POS
- **Limitations**: No advanced features, single user only

#### Pilot Lite (R199/month)
- **Target**: Coffee shops, food trucks
- **Features**: 3 users, unlimited orders, basic reports
- **Limitations**: No inventory tracking, 1 terminal

#### Pilot Core (R799/month)
- **Target**: Restaurants, retail stores
- **Features**: Unlimited users, full inventory, integrations
- **Limitations**: No AI insights, 2 terminals max

#### Pilot Pro (R1,499/month)
- **Target**: Growing businesses, chains
- **Features**: AI insights, multi-location, priority support
- **Limitations**: Standard branding, no custom development

#### Enterprise (Custom Pricing)
- **Target**: Large businesses, franchises
- **Features**: Unlimited everything, white labeling, custom development
- **Contact**: Sales team for personalized quote

### 4. Industry Use Cases (`INDUSTRY_USE_CASES`)

Specific applications for different business types:

- **Restaurants & Cafes**: Recipe management, ingredient tracking
- **Retail Stores**: Product catalogs, inventory management
- **Coffee Shops & Food Trucks**: Fast service, mobile POS
- **Multi-Location Businesses**: Centralized management
- **Enterprise & Franchises**: Custom solutions, compliance

### 5. Frequently Asked Questions (`FREQUENTLY_ASKED_QUESTIONS`)

Organized by category:

- **General**: Platform overview, security, device support
- **Pricing**: Cost structure, trials, plan changes
- **Features**: Payment methods, inventory, integrations
- **Support**: Available support levels, training
- **Enterprise**: Custom pricing, white labeling, SLA

### 6. Business Benefits (`BUSINESS_BENEFITS`)

Value propositions organized by benefit type:

- **Cost Savings**: Reduce operational costs by up to 40%
- **Revenue Growth**: Increase sales through better service
- **Time Savings**: Automate routine tasks
- **Better Insights**: Data-driven decision making
- **Scalability**: Grow from single to multi-location

### 7. Contact Information (`CONTACT_INFORMATION`)

Appropriate contact details for different inquiries:

- **Sales**: Enterprise inquiries, custom pricing
- **Support**: Technical help, account assistance
- **Demo**: Schedule product demonstrations
- **Signup**: Start free account immediately

## AI Context Configuration

### Marketing AI Context (`MARKETING_AI_CONTEXT`)

Defines what the guest AI can and cannot do:

#### Capabilities
- Answer feature and pricing questions
- Provide plan comparisons and recommendations
- Explain industry use cases
- Help with tier selection
- Provide contact information

#### Restrictions
- No access to business data or user information
- No business-specific advice or analysis
- No business operations or transactions
- No account access or modifications

#### Fallback Responses
- Business-specific questions → Redirect to signup
- Technical support → Contact support team
- Pricing negotiation → Contact sales team
- Account access → Use dashboard AI

### Response Templates

Pre-configured responses for common question patterns:

- **Pricing Inquiry**: Tier overview with recommendation prompt
- **Feature Inquiry**: Core features with follow-up questions
- **Comparison Inquiry**: BizPilot differentiators
- **Industry Inquiry**: Industry-specific benefits
- **Getting Started**: Free tier and demo options

### Contact Routing

Intelligent routing based on question content:

- **Sales Inquiries**: Enterprise, custom pricing, demos
- **Support Inquiries**: Technical issues, account problems
- **General Inquiries**: Information requests, learning more

## Validation and Security

### Response Validation

The system includes validation to ensure marketing-only responses:

```python
def validate_marketing_response(response: str) -> bool:
    restricted_terms = [
        'your business data', 'your account', 'your orders',
        'your customers', 'your inventory', 'login to see'
    ]
    return not any(term in response.lower() for term in restricted_terms)
```

### Question Classification

Determines if questions are appropriate for marketing AI:

```python
def is_marketing_question(question: str) -> bool:
    marketing_keywords = [
        'features', 'pricing', 'cost', 'demo', 'trial',
        'restaurant', 'retail', 'compare', 'enterprise'
    ]
    return any(keyword in question.lower() for keyword in marketing_keywords)
```

## Usage Guidelines

### For AI Responses

1. **Always validate responses** using the provided validation functions
2. **Use response templates** for common question patterns
3. **Include contact information** when appropriate
4. **Redirect business-specific questions** to signup or support
5. **Stay within marketing context** - no business data access

### For Frontend Integration

```typescript
import { MARKETING_KNOWLEDGE_BASE, MARKETING_AI_CONTEXT } from './shared/marketing-knowledge-base';

// Use knowledge base for AI responses
const features = MARKETING_KNOWLEDGE_BASE.features;
const pricing = MARKETING_KNOWLEDGE_BASE.pricing;

// Validate questions and responses
const isValid = isMarketingQuestion(userQuestion);
const responseValid = validateMarketingResponse(aiResponse);
```

### For Backend Integration

```python
from shared.marketing_ai_context import MarketingAIContextManager

# Initialize context manager
ai_context = MarketingAIContextManager()

# Process user questions
result = ai_context.process_question(user_question)
if result['is_valid']:
    # Generate AI response using knowledge base
    knowledge = result['knowledge_base']
    template = result['template_response']
```

## Maintenance and Updates

### Adding New Information

1. **Update knowledge base files** in both Python and TypeScript versions
2. **Add new response templates** for common question patterns
3. **Update validation rules** if new restricted content is identified
4. **Test AI responses** to ensure accuracy and compliance

### Pricing Updates

When pricing changes:

1. Update `PRICING_INFORMATION` in both files
2. Update response templates that mention specific prices
3. Update tier comparison information
4. Test all pricing-related AI responses

### Feature Updates

When new features are added:

1. Update `BIZPILOT_FEATURES` or `ENTERPRISE_FEATURES`
2. Update industry use cases if applicable
3. Add new FAQs if needed
4. Update response templates to include new features

## Quality Assurance

### Testing Checklist

- [ ] All pricing information matches backend tiers exactly
- [ ] Enterprise tier information is comprehensive and accurate
- [ ] Industry use cases cover all target business types
- [ ] FAQs address common customer concerns
- [ ] Response validation catches restricted content
- [ ] Contact routing directs to appropriate teams
- [ ] Knowledge base is consistent between Python and TypeScript versions

### Compliance Verification

- [ ] No business-specific data in knowledge base
- [ ] No user information or account details
- [ ] All pricing information is publicly available
- [ ] Contact information is accurate and up-to-date
- [ ] Response templates maintain professional tone

## Integration Points

### Frontend Components

- Marketing pages (home, features, pricing, industries)
- Guest AI widget component
- Pricing comparison tables
- Feature description sections

### Backend Services

- Guest AI chat endpoint
- Marketing content API
- Contact form routing
- Analytics and tracking

### External Systems

- Sales team CRM for Enterprise inquiries
- Support ticketing system
- Demo scheduling system
- Marketing analytics platforms

This comprehensive marketing knowledge base ensures that the guest AI widget provides accurate, helpful, and consistent information to potential customers while maintaining security and compliance with business data restrictions.