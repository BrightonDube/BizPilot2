/**
 * AI Messaging Components
 * 
 * Reusable components for displaying AI-focused content across marketing pages.
 * These components use the centralized AI messaging configuration to ensure
 * consistent messaging about AI capabilities, user control, and privacy protection.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { AI_MESSAGING_CONFIG, AIValueProposition, AICapability, AIFAQ } from '@/lib/ai-messaging-config';

// AI Hero Section Component
interface AIHeroSectionProps {
  showSubTagline?: boolean;
  className?: string;
}

function AIHeroSection({ showSubTagline = true, className = '' }: AIHeroSectionProps) {
  const { messaging } = AI_MESSAGING_CONFIG;
  
  return (
    <div className={`text-center ${className}`}>
      <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
        {messaging.heroTagline}
      </h1>
      {showSubTagline && (
        <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-4xl mx-auto">
          {messaging.subTagline}
        </p>
      )}
    </div>
  );
}

// AI Key Benefits Component
interface AIKeyBenefitsProps {
  title?: string;
  showIcons?: boolean;
  layout?: 'grid' | 'list';
  className?: string;
}

function AIKeyBenefits({ 
  title = "Why Choose AI-Powered Business Management?", 
  showIcons = true, 
  layout = 'grid',
  className = '' 
}: AIKeyBenefitsProps) {
  const { messaging } = AI_MESSAGING_CONFIG;
  
  const gridClass = layout === 'grid' 
    ? 'grid md:grid-cols-2 lg:grid-cols-3 gap-6' 
    : 'space-y-4';
  
  return (
    <div className={className}>
      <h2 className="text-3xl font-bold text-center mb-8">{title}</h2>
      <div className={gridClass}>
        {messaging.keyBenefits.map((benefit, index) => (
          <div key={index} className="flex items-start space-x-3 p-4 bg-white rounded-lg shadow-sm border">
            {showIcons && (
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-bold">✨</span>
              </div>
            )}
            <p className="text-gray-700">{benefit}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// AI Value Propositions Component
interface AIValuePropositionsProps {
  context?: AIValueProposition['context'];
  title?: string;
  className?: string;
}

function AIValuePropositions({ 
  context = 'features', 
  title = "AI-Powered Features That Work For You",
  className = '' 
}: AIValuePropositionsProps) {
  const { utils } = AI_MESSAGING_CONFIG;
  const valueProps = utils.getValuePropositionsByContext(context);
  
  return (
    <div className={className}>
      <h2 className="text-3xl font-bold text-center mb-12">{title}</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
        {valueProps.map((vp, index) => (
          <div key={index} className="text-center p-6 bg-white rounded-xl shadow-lg border hover:shadow-xl transition-shadow">
            <div className="text-4xl mb-4">{vp.icon}</div>
            <h3 className="text-xl font-semibold mb-3">{vp.title}</h3>
            <p className="text-gray-600 mb-4">{vp.description}</p>
            <ul className="text-sm text-gray-500 space-y-1">
              {vp.benefits.map((benefit, idx) => (
                <li key={idx} className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// AI Privacy & Control Assurance Component
interface AIPrivacyControlProps {
  showBoth?: boolean;
  emphasis?: 'privacy' | 'control' | 'both';
  className?: string;
}

function AIPrivacyControl({ 
  showBoth = true, 
  emphasis = 'both',
  className = '' 
}: AIPrivacyControlProps) {
  const { messaging } = AI_MESSAGING_CONFIG;
  
  const showPrivacy = emphasis === 'privacy' || emphasis === 'both';
  const showControl = emphasis === 'control' || emphasis === 'both';
  
  return (
    <div className={`bg-gradient-to-r from-blue-50 to-purple-50 p-8 rounded-xl ${className}`}>
      <div className="max-w-4xl mx-auto">
        <h3 className="text-2xl font-bold text-center mb-6">Your Data, Your Control</h3>
        <div className={`${showBoth ? 'grid md:grid-cols-2 gap-8' : ''}`}>
          {showPrivacy && (
            <div className="text-center">
              <div className="text-3xl mb-4">🔒</div>
              <h4 className="text-lg font-semibold mb-3">Privacy First</h4>
              <p className="text-gray-700">{messaging.privacyMessage}</p>
            </div>
          )}
          {showControl && (
            <div className="text-center">
              <div className="text-3xl mb-4">🎛️</div>
              <h4 className="text-lg font-semibold mb-3">You&apos;re in Control</h4>
              <p className="text-gray-700">{messaging.controlMessage}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// AI Trust Factors Component
interface AITrustFactorsProps {
  title?: string;
  showIcons?: boolean;
  className?: string;
}

function AITrustFactors({ 
  title = "Why Trust BizPilot's AI?", 
  showIcons = true,
  className = '' 
}: AITrustFactorsProps) {
  const { messaging } = AI_MESSAGING_CONFIG;
  
  return (
    <div className={className}>
      <h3 className="text-2xl font-bold text-center mb-8">{title}</h3>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {messaging.trustFactors.map((factor, index) => (
          <div key={index} className="flex items-center space-x-3 p-4 bg-white rounded-lg border">
            {showIcons && (
              <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 text-sm">✓</span>
              </div>
            )}
            <span className="text-gray-700">{factor}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// AI Automation Benefits Component
interface AIAutomationBenefitsProps {
  title?: string;
  showMetrics?: boolean;
  className?: string;
}

function AIAutomationBenefits({ 
  title = "Automation That Saves Time & Money", 
  showMetrics = true,
  className = '' 
}: AIAutomationBenefitsProps) {
  const { messaging } = AI_MESSAGING_CONFIG;
  
  return (
    <div className={className}>
      <h3 className="text-2xl font-bold text-center mb-8">{title}</h3>
      <div className="grid md:grid-cols-2 gap-6">
        {messaging.automationBenefits.map((benefit, index) => (
          <div key={index} className="flex items-start space-x-3 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg">
            <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600 font-bold">⚡</span>
            </div>
            <div>
              <p className="text-gray-700 font-medium">{benefit}</p>
              {showMetrics && index < 5 && (
                <p className="text-sm text-gray-500 mt-1">
                  {index === 0 && "Save 4-6 hours per week"}
                  {index === 1 && "Improve accuracy by 95%"}
                  {index === 2 && "Increase profit margins by 15-25%"}
                  {index === 3 && "Boost customer satisfaction"}
                  {index === 4 && "Reduce administrative overhead"}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// AI Capability Showcase Component
interface AICapabilityShowcaseProps {
  capability: AICapability;
  showAllDetails?: boolean;
  className?: string;
}

function AICapabilityShowcase({ 
  capability, 
  showAllDetails = false,
  className = '' 
}: AICapabilityShowcaseProps) {
  return (
    <div className={`bg-white rounded-xl shadow-lg p-8 ${className}`}>
      <h3 className="text-2xl font-bold mb-4">{capability.name}</h3>
      <p className="text-gray-600 mb-6">{capability.detailedDescription}</p>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-semibold text-lg mb-3 text-blue-600">🎛️ Your Control</h4>
          <ul className="space-y-2">
            {capability.userControlAspects.map((aspect, index) => (
              <li key={index} className="flex items-start">
                <span className="text-blue-500 mr-2 mt-1">•</span>
                <span className="text-gray-700">{aspect}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div>
          <h4 className="font-semibold text-lg mb-3 text-green-600">📈 Business Benefits</h4>
          <ul className="space-y-2">
            {capability.businessBenefits.map((benefit, index) => (
              <li key={index} className="flex items-start">
                <span className="text-green-500 mr-2 mt-1">✓</span>
                <span className="text-gray-700">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      {showAllDetails && (
        <div className="mt-6 pt-6 border-t">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-lg mb-3 text-purple-600">🔒 Privacy Features</h4>
              <ul className="space-y-2">
                {capability.privacyFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-purple-500 mr-2 mt-1">🔒</span>
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-lg mb-3 text-orange-600">⚙️ Technical Features</h4>
              <ul className="space-y-2">
                {capability.technicalFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-orange-500 mr-2 mt-1">⚙️</span>
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// AI FAQ Component
interface AIFAQComponentProps {
  category?: AIFAQ['category'];
  title?: string;
  showCategories?: boolean;
  className?: string;
}

function AIFAQComponent({ 
  category,
  title = "Frequently Asked Questions About AI",
  showCategories = false,
  className = '' 
}: AIFAQComponentProps) {
  const { utils } = AI_MESSAGING_CONFIG;
  const faqs = category ? utils.getFAQsByCategory(category) : AI_MESSAGING_CONFIG.faqs;
  
  const categoryColors = {
    privacy: 'bg-blue-100 text-blue-800',
    control: 'bg-green-100 text-green-800',
    capabilities: 'bg-purple-100 text-purple-800',
    implementation: 'bg-orange-100 text-orange-800',
    benefits: 'bg-pink-100 text-pink-800'
  };
  
  return (
    <div className={className}>
      <h2 className="text-3xl font-bold text-center mb-8">{title}</h2>
      <div className="space-y-6">
        {faqs.map((faq, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900 pr-4">{faq.question}</h3>
              {showCategories && (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${categoryColors[faq.category]}`}>
                  {faq.category}
                </span>
              )}
            </div>
            <p className="text-gray-700 mb-4">{faq.answer}</p>
            {faq.relatedFeatures.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-gray-500">Related features:</span>
                {faq.relatedFeatures.map((feature, idx) => (
                  <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    {feature}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// AI Content Callout Component
interface AIContentCalloutProps {
  componentId: string;
  variant?: 'default' | 'highlighted' | 'minimal';
  className?: string;
}

function AIContentCallout({ 
  componentId, 
  variant = 'default',
  className = '' 
}: AIContentCalloutProps) {
  const component = AI_MESSAGING_CONFIG.contentComponents.find(c => c.id === componentId);
  
  if (!component) return null;
  
  const variantClasses = {
    default: 'bg-blue-50 border-blue-200 text-blue-800 p-4 rounded-lg border',
    highlighted: 'bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-xl shadow-lg',
    minimal: 'text-gray-700 italic'
  };
  
  return (
    <div className={`${variantClasses[variant]} ${className}`}>
      {variant !== 'minimal' && (
        <h4 className="font-semibold mb-2">{component.title}</h4>
      )}
      <p className={variant === 'highlighted' ? 'text-white' : ''}>{component.content}</p>
    </div>
  );
}

// Export all components
export {
  AIHeroSection,
  AIKeyBenefits,
  AIValuePropositions,
  AIPrivacyControl,
  AITrustFactors,
  AIAutomationBenefits,
  AICapabilityShowcase,
  AIFAQComponent,
  AIContentCallout
};