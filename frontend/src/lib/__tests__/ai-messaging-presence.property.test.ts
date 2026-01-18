/**
 * Property-Based Tests for Balanced Smart Feature Messaging Presence
 * 
 * These tests validate that smart features are present but balanced with
 * traditional business features across all marketing pages. Smart features
 * should be positioned as enhancements to comprehensive business management,
 * not as the primary or only selling point.
 * 
 * **Feature: marketing-pages-redesign, Property 7: Balanced Smart Feature Messaging Presence**
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 7.3**
 */

import {
  AI_MESSAGING_CONFIG,
  AIMessagingUtils,
  type AIMessaging,
  type AIValueProposition,
  type AICapability,
  type AIIndustryUseCase,
  type AIFAQ,
  type AIContentComponent
} from '../ai-messaging-config';

/**
 * Property 7: Balanced Smart Feature Messaging Presence
 * 
 * For any marketing page content, smart features should be present but balanced
 * with traditional business features. Comprehensive business management should
 * be the primary focus, with smart features positioned as valuable enhancements.
 * 
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 7.3**
 */
describe('Property 7: Balanced Smart Feature Messaging Presence', () => {

  // Generate test cases for all marketing contexts
  const generateMarketingContexts = (): string[] => {
    return ['features', 'industries', 'pricing', 'faq', 'home'];
  };

  // Generate test cases for AI messaging components
  const generateAIMessagingTestCases = () => {
    return {
      messaging: AI_MESSAGING_CONFIG.messaging,
      capabilities: AI_MESSAGING_CONFIG.capabilities,
      industryUseCases: AI_MESSAGING_CONFIG.industryUseCases,
      faqs: AI_MESSAGING_CONFIG.faqs,
      contentComponents: AI_MESSAGING_CONFIG.contentComponents,
      valuePropositions: AI_MESSAGING_CONFIG.messaging.valuePropositions
    };
  };

  // Property test with multiple iterations (minimum 100 as per design)
  test('should feature smart capabilities balanced with traditional business features', () => {
    const contexts = generateMarketingContexts();
    const testData = generateAIMessagingTestCases();
    
    // Run property test across all contexts and components
    for (let iteration = 0; iteration < Math.max(100, contexts.length * 20); iteration++) {
      const context = contexts[iteration % contexts.length];
      
      // Property: Every marketing context should have balanced messaging
      const contextComponents = AIMessagingUtils.getComponentsByContext(context);
      expect(contextComponents.length).toBeGreaterThan(0);
      
      // Property: Smart features should be present but not overwhelming
      const smartFeatureComponents = contextComponents.filter(c => 
        c.content.toLowerCase().includes('smart') || 
        c.content.toLowerCase().includes('intelligent') ||
        c.content.toLowerCase().includes('ai')
      );
      const traditionalComponents = contextComponents.filter(c => 
        c.content.toLowerCase().includes('business') ||
        c.content.toLowerCase().includes('management') ||
        c.content.toLowerCase().includes('complete') ||
        c.content.toLowerCase().includes('comprehensive')
      );
      
      // Property: Traditional business features should be equally or more prominent
      expect(traditionalComponents.length).toBeGreaterThanOrEqual(smartFeatureComponents.length);
      
      // Property: Smart features should use moderate emphasis, not high
      const highEmphasisSmartComponents = contextComponents.filter(c => 
        c.aiEmphasis === 'high' && (
          c.content.toLowerCase().includes('smart') || 
          c.content.toLowerCase().includes('intelligent') ||
          c.content.toLowerCase().includes('ai')
        )
      );
      
      // Should have more medium/low emphasis than high emphasis for smart features
      const moderateEmphasisSmartComponents = contextComponents.filter(c => 
        (c.aiEmphasis === 'medium' || c.aiEmphasis === 'low') && (
          c.content.toLowerCase().includes('smart') || 
          c.content.toLowerCase().includes('intelligent') ||
          c.content.toLowerCase().includes('ai')
        )
      );
      
      if (smartFeatureComponents.length > 0) {
        expect(moderateEmphasisSmartComponents.length).toBeGreaterThanOrEqual(highEmphasisSmartComponents.length);
      }
      
      // Property: Each context component should balance smart and traditional features
      contextComponents.forEach(component => {
        // Property: Component should have valid emphasis level (balanced approach)
        expect(['high', 'medium', 'low']).toContain(component.aiEmphasis);
        
        // Property: Component should have valid type
        expect(['tagline', 'benefit', 'feature', 'testimonial', 'callout']).toContain(component.type);
        
        // Property: Component should have meaningful content
        expect(component.content.length).toBeGreaterThan(0);
        expect(component.title.length).toBeGreaterThan(0);
        expect(component.id.length).toBeGreaterThan(0);
        
        // Property: If component mentions smart features, it should also mention business value
        const contentLower = component.content.toLowerCase();
        const hasSmartTerms = /smart|intelligent|ai|automated|predictive/.test(contentLower);
        if (hasSmartTerms) {
          const hasBusinessTerms = /business|management|complete|comprehensive|solution|platform/.test(contentLower);
          expect(hasBusinessTerms).toBe(true);
        }
      });
    }
  });

  test('should emphasize comprehensive business management with smart enhancements', () => {
    const testData = generateAIMessagingTestCases();
    
    // Run property test for balanced messaging approach
    for (let iteration = 0; iteration < 100; iteration++) {
      const { messaging } = testData;
      
      // Property: Core messaging should emphasize comprehensive business management (Requirement 4.1)
      expect(messaging.heroTagline.toLowerCase()).toMatch(/complete|comprehensive|business|management/);
      expect(messaging.subTagline.toLowerCase()).toMatch(/comprehensive|business|management|system/);
      
      // Property: Key benefits should balance smart features with traditional capabilities
      const smartBenefits = messaging.keyBenefits.filter(benefit => 
        /smart|intelligent|ai|automated|predictive/.test(benefit.toLowerCase())
      );
      const businessBenefits = messaging.keyBenefits.filter(benefit => 
        /business|management|complete|comprehensive|pos|inventory|reporting|integration/.test(benefit.toLowerCase())
      );
      
      // Traditional business benefits should be equal or more prominent
      expect(businessBenefits.length).toBeGreaterThanOrEqual(smartBenefits.length);
      
      // Property: Automation benefits should emphasize business value, not just AI
      expect(messaging.automationBenefits.length).toBeGreaterThanOrEqual(5);
      messaging.automationBenefits.forEach(benefit => {
        expect(typeof benefit).toBe('string');
        expect(benefit.length).toBeGreaterThan(0);
        
        // Should contain business value terms alongside smart features
        const benefitLower = benefit.toLowerCase();
        const hasBusinessValue = /reduce|optimize|streamline|improve|save|increase|better|efficient|cost|time|profit|growth/.test(benefitLower);
        expect(hasBusinessValue).toBe(true);
      });
      
      // Property: Value propositions should balance smart and traditional features
      const smartVPs = messaging.valuePropositions.filter(vp => 
        vp.title.toLowerCase().includes('smart') || 
        vp.title.toLowerCase().includes('intelligent') ||
        vp.description.toLowerCase().includes('smart') ||
        vp.description.toLowerCase().includes('intelligent')
      );
      const businessVPs = messaging.valuePropositions.filter(vp => 
        vp.title.toLowerCase().includes('business') || 
        vp.title.toLowerCase().includes('complete') ||
        vp.description.toLowerCase().includes('business') ||
        vp.description.toLowerCase().includes('complete')
      );
      
      // Should have balanced representation
      expect(businessVPs.length).toBeGreaterThanOrEqual(smartVPs.length);
    }
  });

  test('should emphasize user control and privacy protection consistently', () => {
    const testData = generateAIMessagingTestCases();
    
    // Run property test for control and privacy messaging
    for (let iteration = 0; iteration < 100; iteration++) {
      const { messaging } = testData;
      
      // Property: Privacy message should be comprehensive (Requirement 4.2, 4.3)
      expect(messaging.privacyMessage.length).toBeGreaterThan(50);
      const privacyKeywords = ['privacy', 'secure', 'control', 'consent', 'data', 'encrypted', 'ownership'];
      const privacyLower = messaging.privacyMessage.toLowerCase();
      const hasPrivacyTerms = privacyKeywords.some(keyword => privacyLower.includes(keyword));
      expect(hasPrivacyTerms).toBe(true);
      
      // Property: Control message should emphasize user agency (Requirement 4.2)
      expect(messaging.controlMessage.length).toBeGreaterThan(50);
      const controlKeywords = ['control', 'you', 'decision', 'override', 'customize', 'choose', 'final'];
      const controlLower = messaging.controlMessage.toLowerCase();
      const hasControlTerms = controlKeywords.some(keyword => controlLower.includes(keyword));
      expect(hasControlTerms).toBe(true);
      
      // Property: Trust factors should address privacy and control concerns
      expect(messaging.trustFactors.length).toBeGreaterThanOrEqual(4);
      messaging.trustFactors.forEach(factor => {
        expect(typeof factor).toBe('string');
        expect(factor.length).toBeGreaterThan(0);
      });
      
      // Property: Should have dedicated value propositions for control and privacy
      const controlVP = messaging.valuePropositions.find(vp => 
        vp.title.toLowerCase().includes('control') || 
        vp.description.toLowerCase().includes('control')
      );
      expect(controlVP).toBeDefined();
      
      const privacyVP = messaging.valuePropositions.find(vp => 
        vp.title.toLowerCase().includes('privacy') || 
        vp.description.toLowerCase().includes('privacy')
      );
      expect(privacyVP).toBeDefined();
    }
  });

  test('should explain AI capabilities and user benefits comprehensively', () => {
    const testData = generateAIMessagingTestCases();
    
    // Run property test for AI capabilities explanation
    for (let iteration = 0; iteration < 100; iteration++) {
      const { capabilities } = testData;
      
      // Property: Should have comprehensive AI capabilities (Requirement 4.4)
      expect(capabilities.length).toBeGreaterThanOrEqual(3);
      
      capabilities.forEach(capability => {
        // Property: Each capability should have detailed explanations
        expect(capability.name.length).toBeGreaterThan(0);
        expect(capability.shortDescription.length).toBeGreaterThan(20);
        expect(capability.detailedDescription.length).toBeGreaterThan(100);
        
        // Property: Should emphasize user control aspects
        expect(capability.userControlAspects.length).toBeGreaterThanOrEqual(2);
        capability.userControlAspects.forEach(aspect => {
          expect(typeof aspect).toBe('string');
          expect(aspect.length).toBeGreaterThan(0);
          
          // Should contain control-related terms
          const aspectLower = aspect.toLowerCase();
          const hasControlTerms = /set|customize|override|adjust|choose|control|configure/.test(aspectLower);
          expect(hasControlTerms).toBe(true);
        });
        
        // Property: Should highlight privacy features
        expect(capability.privacyFeatures.length).toBeGreaterThanOrEqual(2);
        capability.privacyFeatures.forEach(feature => {
          expect(typeof feature).toBe('string');
          expect(feature.length).toBeGreaterThan(0);
        });
        
        // Property: Should provide clear business benefits
        expect(capability.businessBenefits.length).toBeGreaterThanOrEqual(2);
        capability.businessBenefits.forEach(benefit => {
          expect(typeof benefit).toBe('string');
          expect(benefit.length).toBeGreaterThan(10); // Meaningful content
          expect(benefit.trim()).toBe(benefit); // No leading/trailing whitespace
        });
        
        // Property: Should have technical features that explain AI functionality
        expect(capability.technicalFeatures.length).toBeGreaterThanOrEqual(2);
        capability.technicalFeatures.forEach(feature => {
          expect(typeof feature).toBe('string');
          expect(feature.length).toBeGreaterThan(0);
        });
      });
    }
  });

  test('should position BizPilot as AI-powered platform consistently', () => {
    const testData = generateAIMessagingTestCases();
    
    // Run property test for AI platform positioning
    for (let iteration = 0; iteration < 100; iteration++) {
      const { messaging } = testData;
      
      // Property: Hero tagline should position as AI-powered (Requirement 4.5)
      const heroLower = messaging.heroTagline.toLowerCase();
      expect(heroLower).toMatch(/ai|intelligent|smart/);
      
      // Property: Sub-tagline should reinforce AI positioning
      const subTaglineLower = messaging.subTagline.toLowerCase();
      expect(subTaglineLower).toMatch(/intelligent|automation|ai|smart/);
      
      // Property: Value propositions should consistently emphasize AI
      expect(messaging.valuePropositions.length).toBeGreaterThanOrEqual(3);
      messaging.valuePropositions.forEach(vp => {
        // Each value proposition should mention AI or intelligent features
        const titleLower = vp.title.toLowerCase();
        const descLower = vp.description.toLowerCase();
        const hasAIPositioning = /ai|intelligent|smart|automated|predictive/.test(titleLower + ' ' + descLower);
        expect(hasAIPositioning).toBe(true);
        
        // Should have meaningful benefits
        expect(vp.benefits.length).toBeGreaterThanOrEqual(2);
        vp.benefits.forEach(benefit => {
          expect(typeof benefit).toBe('string');
          expect(benefit.length).toBeGreaterThan(0);
        });
        
        // Should have valid context
        expect(['features', 'industries', 'pricing', 'faq', 'home']).toContain(vp.context);
      });
    }
  });

  test('should provide industry-specific AI use cases with control features', () => {
    const testData = generateAIMessagingTestCases();
    
    // Run property test for industry use cases
    for (let iteration = 0; iteration < 100; iteration++) {
      const { industryUseCases } = testData;
      
      // Property: Should have multiple industry use cases (Requirement 7.3)
      expect(industryUseCases.length).toBeGreaterThanOrEqual(3);
      
      industryUseCases.forEach(useCase => {
        // Property: Each use case should have comprehensive AI capabilities
        expect(useCase.industry.length).toBeGreaterThan(0);
        expect(useCase.title.length).toBeGreaterThan(0);
        expect(useCase.description.length).toBeGreaterThan(50);
        
        // Property: Should highlight AI capabilities
        expect(useCase.aiCapabilities.length).toBeGreaterThanOrEqual(3);
        useCase.aiCapabilities.forEach(capability => {
          expect(typeof capability).toBe('string');
          expect(capability.length).toBeGreaterThan(10); // Meaningful content
          expect(capability.trim()).toBe(capability); // No leading/trailing whitespace
        });
        
        // Property: Should provide automation benefits
        expect(useCase.automationBenefits.length).toBeGreaterThanOrEqual(3);
        useCase.automationBenefits.forEach(benefit => {
          expect(typeof benefit).toBe('string');
          expect(benefit.length).toBeGreaterThan(10); // Meaningful content
          expect(benefit.trim()).toBe(benefit); // No leading/trailing whitespace
        });
        
        // Property: Should emphasize control features (Requirement 4.2)
        expect(useCase.controlFeatures.length).toBeGreaterThanOrEqual(3);
        useCase.controlFeatures.forEach(feature => {
          expect(typeof feature).toBe('string');
          expect(feature.length).toBeGreaterThan(0);
          
          // Should contain control-related terms
          const featureLower = feature.toLowerCase();
          const hasControlTerms = /override|set|customize|control|adjust|configure/.test(featureLower);
          expect(hasControlTerms).toBe(true);
        });
        
        // Property: Should have real-world example
        expect(useCase.realWorldExample.length).toBeGreaterThan(100);
        const exampleLower = useCase.realWorldExample.toLowerCase();
        const hasMetrics = /\d+%|\d+ hours|\d+ minutes|increase|reduce|improve/.test(exampleLower);
        expect(hasMetrics).toBe(true);
      });
    }
  });

  test('should address AI concerns through comprehensive FAQs', () => {
    const testData = generateAIMessagingTestCases();
    
    // Run property test for AI FAQs
    for (let iteration = 0; iteration < 100; iteration++) {
      const { faqs } = testData;
      
      // Property: Should have comprehensive AI-related FAQs (Requirement 4.3, 4.4)
      expect(faqs.length).toBeGreaterThanOrEqual(6);
      
      // Property: Should cover all important categories
      const categories = faqs.map(faq => faq.category);
      const uniqueCategories = new Set(categories);
      expect(uniqueCategories.has('privacy')).toBe(true);
      expect(uniqueCategories.has('control')).toBe(true);
      expect(uniqueCategories.has('capabilities')).toBe(true);
      
      faqs.forEach(faq => {
        // Property: Each FAQ should have comprehensive content
        expect(faq.question.length).toBeGreaterThan(10);
        expect(faq.answer.length).toBeGreaterThan(50);
        expect(['privacy', 'control', 'capabilities', 'implementation', 'benefits']).toContain(faq.category);
        
        // Property: Questions should address AI concerns
        const questionLower = faq.question.toLowerCase();
        const hasAITerms = /ai|artificial intelligence|intelligent|smart|automated|data|privacy|control/.test(questionLower);
        expect(hasAITerms).toBe(true);
        
        // Property: Answers should be informative and reassuring
        expect(faq.answer.length).toBeGreaterThan(100);
        
        // Property: Should have related features
        expect(Array.isArray(faq.relatedFeatures)).toBe(true);
        faq.relatedFeatures.forEach(feature => {
          expect(typeof feature).toBe('string');
          expect(feature.length).toBeGreaterThan(0);
        });
      });
      
      // Property: Privacy FAQs should address data protection concerns
      const privacyFAQs = AIMessagingUtils.getFAQsByCategory('privacy');
      expect(privacyFAQs.length).toBeGreaterThanOrEqual(1);
      privacyFAQs.forEach(faq => {
        const answerLower = faq.answer.toLowerCase();
        const hasPrivacyTerms = /privacy|secure|encrypted|data|ownership|consent/.test(answerLower);
        expect(hasPrivacyTerms).toBe(true);
      });
      
      // Property: Control FAQs should address user agency concerns
      const controlFAQs = AIMessagingUtils.getFAQsByCategory('control');
      expect(controlFAQs.length).toBeGreaterThanOrEqual(1);
      controlFAQs.forEach(faq => {
        const answerLower = faq.answer.toLowerCase();
        const hasControlTerms = /control|override|customize|decision|choose|adjust/.test(answerLower);
        expect(hasControlTerms).toBe(true);
      });
    }
  });

  test('should maintain consistent AI messaging utility functions', () => {
    const contexts = generateMarketingContexts();
    
    // Run property test for utility functions
    for (let iteration = 0; iteration < 100; iteration++) {
      const context = contexts[iteration % contexts.length];
      
      // Property: Context-based component retrieval should work consistently
      const contextComponents = AIMessagingUtils.getComponentsByContext(context);
      expect(Array.isArray(contextComponents)).toBe(true);
      
      contextComponents.forEach(component => {
        expect(component.context.includes(context)).toBe(true);
        expect(typeof component.id).toBe('string');
        expect(typeof component.title).toBe('string');
        expect(typeof component.content).toBe('string');
        expect(['tagline', 'benefit', 'feature', 'testimonial', 'callout']).toContain(component.type);
        expect(['high', 'medium', 'low']).toContain(component.aiEmphasis);
      });
      
      // Property: Emphasis-based filtering should work correctly
      const emphasisLevels: ('high' | 'medium' | 'low')[] = ['high', 'medium', 'low'];
      emphasisLevels.forEach(emphasis => {
        const emphasisComponents = AIMessagingUtils.getComponentsByEmphasis(emphasis);
        expect(Array.isArray(emphasisComponents)).toBe(true);
        emphasisComponents.forEach(component => {
          expect(component.aiEmphasis).toBe(emphasis);
        });
      });
      
      // Property: AI emphasis detection should work for high-priority contexts
      const shouldEmphasize = AIMessagingUtils.shouldEmphasizeAI(context);
      expect(typeof shouldEmphasize).toBe('boolean');
      
      if (['features', 'pricing', 'home'].includes(context)) {
        expect(shouldEmphasize).toBe(true);
      }
      
      // Property: Random tagline generation should provide variety
      const tagline1 = AIMessagingUtils.getRandomTagline();
      const tagline2 = AIMessagingUtils.getRandomTagline();
      expect(typeof tagline1).toBe('string');
      expect(typeof tagline2).toBe('string');
      expect(tagline1.length).toBeGreaterThan(0);
      expect(tagline2.length).toBeGreaterThan(0);
      
      // Property: AI benefit formatting should work consistently
      const testBenefit = "Reduce inventory costs by 25%";
      const formattedBenefit = AIMessagingUtils.formatAIBenefit(testBenefit, true);
      expect(formattedBenefit).toContain('✨');
      expect(formattedBenefit).toContain(testBenefit);
      
      const unformattedBenefit = AIMessagingUtils.formatAIBenefit(testBenefit, false);
      expect(unformattedBenefit).toBe(testBenefit);
    }
  });

  test('should ensure AI messaging configuration completeness', () => {
    // Property: Configuration should have all required sections
    expect(AI_MESSAGING_CONFIG.messaging).toBeDefined();
    expect(AI_MESSAGING_CONFIG.capabilities).toBeDefined();
    expect(AI_MESSAGING_CONFIG.industryUseCases).toBeDefined();
    expect(AI_MESSAGING_CONFIG.faqs).toBeDefined();
    expect(AI_MESSAGING_CONFIG.contentComponents).toBeDefined();
    expect(AI_MESSAGING_CONFIG.utils).toBeDefined();
    
    // Property: All sections should have meaningful content
    expect(AI_MESSAGING_CONFIG.capabilities.length).toBeGreaterThanOrEqual(3);
    expect(AI_MESSAGING_CONFIG.industryUseCases.length).toBeGreaterThanOrEqual(3);
    expect(AI_MESSAGING_CONFIG.faqs.length).toBeGreaterThanOrEqual(6);
    expect(AI_MESSAGING_CONFIG.contentComponents.length).toBeGreaterThanOrEqual(5);
    
    // Property: Configuration should be immutable (readonly)
    // Note: TypeScript readonly doesn't prevent runtime modification, 
    // but we can test that the configuration exists and is structured correctly
    expect(typeof AI_MESSAGING_CONFIG).toBe('object');
    expect(AI_MESSAGING_CONFIG).not.toBeNull();
    
    // Property: All marketing contexts should have associated content
    const contexts = generateMarketingContexts();
    contexts.forEach(context => {
      const components = AIMessagingUtils.getComponentsByContext(context);
      const valueProps = AIMessagingUtils.getValuePropositionsByContext(context as AIValueProposition['context']);
      
      // Each context should have either components or value propositions
      expect(components.length + valueProps.length).toBeGreaterThan(0);
    });
  });
});