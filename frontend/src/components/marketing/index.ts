/**
 * Marketing Components Index
 * 
 * Centralized exports for all marketing-related components including
 * AI messaging components and other marketing utilities.
 */

// AI Messaging Components
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
} from './AIMessagingComponents';

// Existing Marketing Components
export { FAQAccordion } from './FAQAccordion';

// Re-export AI messaging configuration for convenience
export { AI_MESSAGING_CONFIG } from '@/lib/ai-messaging-config';
export { PRICING_CONFIG } from '@/lib/pricing-config';