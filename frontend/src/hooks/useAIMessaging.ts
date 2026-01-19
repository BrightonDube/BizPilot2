/**
 * AI Messaging Hook
 * 
 * Custom hook for accessing AI messaging configuration and utilities
 * in React components. Provides convenient access to AI content,
 * messaging, and utility functions.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { useMemo } from 'react';
import { 
  AI_MESSAGING_CONFIG, 
  AIValueProposition, 
  AICapability, 
  AIFAQ,
  AIContentComponent 
} from '@/lib/ai-messaging-config';

export function useAIMessaging() {
  const { messaging, capabilities, industryUseCases, faqs, contentComponents, utils } = AI_MESSAGING_CONFIG;

  // Memoized utility functions to avoid recreating on each render
  const aiUtils = useMemo(() => ({
    // Get content by context
    getContentByContext: (context: string): AIContentComponent[] => {
      return utils.getComponentsByContext(context);
    },

    // Get high-emphasis AI content
    getHighEmphasisContent: (): AIContentComponent[] => {
      return utils.getComponentsByEmphasis('high');
    },

    // Get value propositions for specific context
    getValueProps: (context: AIValueProposition['context']): AIValueProposition[] => {
      return utils.getValuePropositionsByContext(context);
    },

    // Get FAQs by category
    getFAQs: (category?: AIFAQ['category']): AIFAQ[] => {
      return category ? utils.getFAQsByCategory(category) : faqs;
    },

    // Get industry-specific use case
    getIndustryUseCase: (industry: string) => {
      return utils.getIndustryUseCase(industry);
    },

    // Get AI capability details
    getCapability: (name: string): AICapability | undefined => {
      return utils.getAICapability(name);
    },

    // Format benefits with AI emphasis
    formatBenefit: (benefit: string, emphasize: boolean = false): string => {
      return utils.formatBenefit(benefit, emphasize);
    },

    // Get random tagline for variety
    getRandomTagline: (): string => {
      return utils.getBalancedTagline();
    },

    // Check if context should emphasize AI
    shouldEmphasizeAI: (context: string): boolean => {
      return utils.shouldEmphasizeSmartFeatures(context);
    }
  }), [utils, faqs]);

  // Memoized messaging content
  const aiMessaging = useMemo(() => ({
    heroTagline: messaging.heroTagline,
    subTagline: messaging.subTagline,
    keyBenefits: messaging.keyBenefits,
    privacyMessage: messaging.privacyMessage,
    controlMessage: messaging.controlMessage,
    automationBenefits: messaging.automationBenefits,
    trustFactors: messaging.trustFactors,
    valuePropositions: messaging.valuePropositions
  }), [messaging]);

  // Memoized capabilities
  const aiCapabilities = useMemo(() => capabilities, [capabilities]);

  // Memoized industry use cases
  const aiIndustryUseCases = useMemo(() => industryUseCases, [industryUseCases]);

  // Memoized content components
  const aiContentComponents = useMemo(() => contentComponents, [contentComponents]);

  return {
    // Core messaging
    messaging: aiMessaging,
    
    // Capabilities and use cases
    capabilities: aiCapabilities,
    industryUseCases: aiIndustryUseCases,
    
    // Content components
    contentComponents: aiContentComponents,
    
    // Utility functions
    utils: aiUtils,
    
    // Convenience getters
    heroTagline: messaging.heroTagline,
    subTagline: messaging.subTagline,
    keyBenefits: messaging.keyBenefits,
    privacyMessage: messaging.privacyMessage,
    controlMessage: messaging.controlMessage,
    automationBenefits: messaging.automationBenefits,
    trustFactors: messaging.trustFactors
  };
}

export default useAIMessaging;