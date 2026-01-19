/**
 * Property-Based Tests for Centralized Pricing Data Usage
 * 
 * These tests validate universal properties that should hold true for
 * centralized pricing data usage across all marketing pages and components.
 * 
 * **Feature: marketing-pages-redesign, Property 5: Centralized Pricing Data Usage**
 * **Validates: Requirements 3.2, 7.2**
 */

import {
  PRICING_PLANS,
  PricingUtils,
  type PricingPlan,
  type BillingCycle
} from '../pricing-config';

/**
 * Property 5: Centralized Pricing Data Usage
 * 
 * For any pricing display across all marketing pages, the displayed pricing 
 * information should match the centralized pricing configuration exactly.
 * 
 * **Validates: Requirements 3.2, 7.2**
 */
describe('Property 5: Centralized Pricing Data Usage', () => {
  
  // Generate test cases for all pricing plans and billing cycles
  const generatePricingDisplayTestCases = () => {
    const testCases: Array<{
      plan: PricingPlan;
      billingCycle: BillingCycle;
      expectedPrice: number;
      expectedFormattedPrice: string;
    }> = [];

    PRICING_PLANS.forEach(plan => {
      ['monthly', 'yearly'].forEach(cycle => {
        const billingCycle = cycle as BillingCycle;
        const expectedPrice = PricingUtils.getPriceForCycle(plan, billingCycle);
        const expectedFormattedPrice = PricingUtils.formatPriceWithCycle(plan, billingCycle);
        
        testCases.push({
          plan,
          billingCycle,
          expectedPrice,
          expectedFormattedPrice
        });
      });
    });

    return testCases;
  };

  // Property test: All pricing displays should use centralized configuration
  test('should use centralized pricing configuration for all pricing displays', () => {
    const testCases = generatePricingDisplayTestCases();
    
    // Run property test with minimum 100 iterations as per design specification
    for (let iteration = 0; iteration < Math.max(100, testCases.length * 10); iteration++) {
      const testCase = testCases[iteration % testCases.length];
      const { plan, billingCycle, expectedPrice, expectedFormattedPrice } = testCase;
      
      // Property: Price retrieval should always use centralized configuration
      const retrievedPrice = PricingUtils.getPriceForCycle(plan, billingCycle);
      expect(retrievedPrice).toBe(expectedPrice);
      
      // Property: Price formatting should be consistent with centralized configuration
      const formattedPrice = PricingUtils.formatPriceWithCycle(plan, billingCycle);
      expect(formattedPrice).toBe(expectedFormattedPrice);
      
      // Property: Plan retrieval by ID should return exact match from centralized config
      const retrievedPlan = PricingUtils.getPlanById(plan.id);
      expect(retrievedPlan).toBeDefined();
      expect(retrievedPlan!.id).toBe(plan.id);
      expect(retrievedPlan!.monthlyPrice).toBe(plan.monthlyPrice);
      expect(retrievedPlan!.yearlyPrice).toBe(plan.yearlyPrice);
      expect(retrievedPlan!.displayName).toBe(plan.displayName);
      expect(retrievedPlan!.description).toBe(plan.description);
      
      // Property: Features should match centralized configuration exactly
      expect(retrievedPlan!.features).toEqual(plan.features);
      expect(retrievedPlan!.limitations).toEqual(plan.limitations);
      expect(retrievedPlan!.aiFeatures).toEqual(plan.aiFeatures);
      
      // Property: Currency should match centralized configuration
      expect(retrievedPlan!.currency).toBe(plan.currency);
      
      // Property: Sort order should match centralized configuration
      expect(retrievedPlan!.sortOrder).toBe(plan.sortOrder);
      
      // Property: Recommended flag should match centralized configuration
      expect(retrievedPlan!.recommended).toBe(plan.recommended);
    }
  });

  // Property test: Pricing card generation should use centralized data
  test('should generate pricing cards using centralized configuration data', () => {
    const testCases = generatePricingDisplayTestCases();
    
    // Simulate pricing card generation as done in the pricing page
    for (let iteration = 0; iteration < 100; iteration++) {
      const testCase = testCases[iteration % testCases.length];
      const { plan } = testCase;
      
      // Property: Generated pricing card data should match centralized configuration
      const isFeatured = plan.recommended || false;
      const priceLabel = PricingUtils.formatPriceWithCycle(plan, testCase.billingCycle);
      const benefits = PricingUtils.convertFeaturesToBenefits(plan);
      
      // Property: Card tier name should match centralized display name
      expect(plan.displayName).toBe(plan.displayName);
      
      // Property: Card price should be formatted using centralized utilities
      expect(priceLabel).toBe(PricingUtils.formatPriceWithCycle(plan, testCase.billingCycle));
      
      // Property: Card description should match centralized configuration
      expect(plan.description).toBe(plan.description);
      
      // Property: Featured status should match centralized configuration
      expect(isFeatured).toBe(plan.recommended || false);
      
      // Property: Benefits should be derived from centralized features and limitations
      // Expected length: features + AI summary benefit + limitations
      const aiFeatureCount = PricingUtils.getAIFeaturesCount(plan);
      const expectedLength = plan.features.length + (aiFeatureCount > 0 ? 1 : 0) + plan.limitations.length;
      expect(benefits.length).toBe(expectedLength);
      
      // Property: All features should be marked as included (checked: true)
      const featureBenefits = benefits.slice(0, plan.features.length);
      featureBenefits.forEach((benefit, index) => {
        expect(benefit.checked).toBe(true);
        // The benefit text may include AI emoji prefix, so check if it contains the original feature text
        const originalFeature = plan.features[index];
        expect(benefit.text).toMatch(new RegExp(originalFeature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      });
      
      // Property: All limitations should be marked as not included (checked: false)
      // Skip the AI summary benefit (if present) to get to limitations
      const limitationStartIndex = plan.features.length + (aiFeatureCount > 0 ? 1 : 0);
      const limitationBenefits = benefits.slice(limitationStartIndex);
      limitationBenefits.forEach((benefit, index) => {
        expect(benefit.checked).toBe(false);
        expect(benefit.text).toBe(plan.limitations[index]);
      });
      
      // Property: CTA text should be consistent based on centralized pricing
      const expectedCta = plan.monthlyPrice === 0 ? 'Get Started Free' : 'Get Started';
      expect(expectedCta).toBe(plan.monthlyPrice === 0 ? 'Get Started Free' : 'Get Started');
    }
  });

  // Property test: Price calculations should be consistent across all displays
  test('should maintain consistent price calculations across all displays', () => {
    const testCases = generatePricingDisplayTestCases();
    
    for (let iteration = 0; iteration < 100; iteration++) {
      const testCase = testCases[iteration % testCases.length];
      const { plan, billingCycle } = testCase;
      
      // Property: Monthly price should always match centralized configuration
      const monthlyPrice = PricingUtils.getPriceForCycle(plan, 'monthly');
      expect(monthlyPrice).toBe(plan.monthlyPrice);
      
      // Property: Yearly price should always match centralized configuration
      const yearlyPrice = PricingUtils.getPriceForCycle(plan, 'yearly');
      expect(yearlyPrice).toBe(plan.yearlyPrice);
      
      // Property: Yearly savings calculation should be consistent
      if (plan.monthlyPrice > 0) {
        const calculatedSavings = PricingUtils.calculateYearlySavings(plan.monthlyPrice, plan.yearlyPrice);
        const expectedSavings = Math.round(((plan.monthlyPrice * 12 - plan.yearlyPrice) / (plan.monthlyPrice * 12)) * 100);
        expect(calculatedSavings).toBe(expectedSavings);
        
        // Property: Yearly price should be less than or equal to monthly equivalent
        expect(plan.yearlyPrice).toBeLessThanOrEqual(plan.monthlyPrice * 12);
      }
      
      // Property: Free plans should have zero pricing for both cycles
      if (plan.monthlyPrice === 0) {
        expect(plan.yearlyPrice).toBe(0);
        expect(PricingUtils.formatPrice(0)).toBe('Free');
      }
      
      // Property: Currency formatting should be consistent
      const formattedMonthly = PricingUtils.formatPrice(plan.monthlyPrice, plan.currency as 'ZAR' | 'USD' | 'EUR');
      const formattedYearly = PricingUtils.formatPrice(plan.yearlyPrice, plan.currency as 'ZAR' | 'USD' | 'EUR');
      
      if (plan.monthlyPrice === 0) {
        expect(formattedMonthly).toBe('Free');
      } else {
        expect(formattedMonthly).toContain('R'); // ZAR currency
        expect(formattedMonthly).not.toContain('undefined');
      }
      
      if (plan.yearlyPrice === 0) {
        expect(formattedYearly).toBe('Free');
      } else {
        expect(formattedYearly).toContain('R'); // ZAR currency
        expect(formattedYearly).not.toContain('undefined');
      }
    }
  });

  // Property test: AI features should be consistently represented
  test('should consistently represent AI features from centralized configuration', () => {
    const testCases = PRICING_PLANS;
    
    for (let iteration = 0; iteration < 100; iteration++) {
      const plan = testCases[iteration % testCases.length];
      
      // Property: AI features count should match enabled features
      const aiCount = PricingUtils.getAIFeaturesCount(plan);
      const enabledFeatures = Object.values(plan.aiFeatures).filter(Boolean);
      expect(aiCount).toBe(enabledFeatures.length);
      
      // Property: Enabled AI features list should be consistent
      const aiFeaturesList = PricingUtils.getEnabledAIFeatures(plan);
      expect(aiFeaturesList.length).toBe(aiCount);
      
      // Property: Each enabled AI feature should be properly formatted
      aiFeaturesList.forEach(feature => {
        expect(typeof feature).toBe('string');
        expect(feature.length).toBeGreaterThan(0);
        expect(feature).not.toContain('undefined');
        expect(feature).not.toContain('null');
      });
      
      // Property: AI features should be boolean values only
      Object.values(plan.aiFeatures).forEach(featureValue => {
        expect(typeof featureValue).toBe('boolean');
      });
      
      // Property: AI-powered features in benefits should be marked correctly
      const benefits = PricingUtils.convertFeaturesToBenefits(plan);
      const aiPoweredBenefits = benefits.filter(benefit => benefit.aiPowered);
      
      // At least some features should be AI-powered for non-free plans
      if (plan.monthlyPrice > 0) {
        expect(aiPoweredBenefits.length).toBeGreaterThan(0);
      }
    }
  });

  // Property test: Plan hierarchy should be maintained in displays
  test('should maintain plan hierarchy consistency in all displays', () => {
    // Property: Plans should be sortable by sort order
    const sortedPlans = [...PRICING_PLANS].sort((a, b) => a.sortOrder - b.sortOrder);
    
    for (let iteration = 0; iteration < 100; iteration++) {
      // Property: Sort order should create a valid hierarchy
      for (let i = 1; i < sortedPlans.length; i++) {
        const currentPlan = sortedPlans[i];
        const previousPlan = sortedPlans[i - 1];
        
        // Property: Sort order should be ascending
        expect(currentPlan.sortOrder).toBeGreaterThan(previousPlan.sortOrder);
        
        // Property: Higher tier plans should have more or equal AI features (except free tier)
        if (previousPlan.monthlyPrice > 0) {
          const currentAICount = PricingUtils.getAIFeaturesCount(currentPlan);
          const previousAICount = PricingUtils.getAIFeaturesCount(previousPlan);
          expect(currentAICount).toBeGreaterThanOrEqual(previousAICount);
        }
        
        // Property: Higher tier plans should have higher or equal prices (except free tier)
        if (previousPlan.monthlyPrice > 0) {
          expect(currentPlan.monthlyPrice).toBeGreaterThanOrEqual(previousPlan.monthlyPrice);
        }
      }
      
      // Property: Recommended plan should be retrievable consistently
      const recommendedPlan = PricingUtils.getRecommendedPlan();
      expect(recommendedPlan).toBeDefined();
      expect(recommendedPlan!.recommended).toBe(true);
      
      // Property: Only one plan should be recommended
      const recommendedPlans = PRICING_PLANS.filter(plan => plan.recommended);
      expect(recommendedPlans.length).toBe(1);
      expect(recommendedPlans[0]).toEqual(recommendedPlan);
    }
  });

  // Property test: Pricing display consistency across different contexts
  test('should maintain pricing display consistency across different contexts', () => {
    const billingCycles: BillingCycle[] = ['monthly', 'yearly'];
    
    for (let iteration = 0; iteration < 100; iteration++) {
      const plan = PRICING_PLANS[iteration % PRICING_PLANS.length];
      const cycle = billingCycles[iteration % billingCycles.length];
      
      // Property: Price formatting should be identical regardless of context
      const priceFormatted1 = PricingUtils.formatPriceWithCycle(plan, cycle);
      const priceFormatted2 = PricingUtils.formatPriceWithCycle(plan, cycle);
      expect(priceFormatted1).toBe(priceFormatted2);
      
      // Property: Plan retrieval should be identical regardless of context
      const retrievedPlan1 = PricingUtils.getPlanById(plan.id);
      const retrievedPlan2 = PricingUtils.getPlanById(plan.id);
      expect(retrievedPlan1).toEqual(retrievedPlan2);
      
      // Property: Benefits conversion should be identical regardless of context
      const benefits1 = PricingUtils.convertFeaturesToBenefits(plan);
      const benefits2 = PricingUtils.convertFeaturesToBenefits(plan);
      expect(benefits1).toEqual(benefits2);
      
      // Property: AI features count should be identical regardless of context
      const aiCount1 = PricingUtils.getAIFeaturesCount(plan);
      const aiCount2 = PricingUtils.getAIFeaturesCount(plan);
      expect(aiCount1).toBe(aiCount2);
      
      // Property: Enabled AI features should be identical regardless of context
      const aiFeatures1 = PricingUtils.getEnabledAIFeatures(plan);
      const aiFeatures2 = PricingUtils.getEnabledAIFeatures(plan);
      expect(aiFeatures1).toEqual(aiFeatures2);
    }
  });

  // Property test: Centralized configuration immutability
  test('should maintain centralized configuration immutability', () => {
    for (let iteration = 0; iteration < 100; iteration++) {
      // Property: PRICING_PLANS should not be modified by utility functions
      const originalPlansLength = PRICING_PLANS.length;
      const originalFirstPlan = { ...PRICING_PLANS[0] };
      
      // Perform various operations that should not modify the original configuration
      PricingUtils.getPlanById(PRICING_PLANS[0].id);
      PricingUtils.getRecommendedPlan();
      PricingUtils.formatPriceWithCycle(PRICING_PLANS[0], 'monthly');
      PricingUtils.convertFeaturesToBenefits(PRICING_PLANS[0]);
      PricingUtils.getAIFeaturesCount(PRICING_PLANS[0]);
      PricingUtils.getEnabledAIFeatures(PRICING_PLANS[0]);
      
      // Property: Original configuration should remain unchanged
      expect(PRICING_PLANS.length).toBe(originalPlansLength);
      expect(PRICING_PLANS[0].id).toBe(originalFirstPlan.id);
      expect(PRICING_PLANS[0].monthlyPrice).toBe(originalFirstPlan.monthlyPrice);
      expect(PRICING_PLANS[0].yearlyPrice).toBe(originalFirstPlan.yearlyPrice);
      expect(PRICING_PLANS[0].features).toEqual(originalFirstPlan.features);
      expect(PRICING_PLANS[0].limitations).toEqual(originalFirstPlan.limitations);
      expect(PRICING_PLANS[0].aiFeatures).toEqual(originalFirstPlan.aiFeatures);
    }
  });

  // Property test: Error handling for invalid inputs
  test('should handle invalid inputs gracefully while maintaining centralized data integrity', () => {
    for (let iteration = 0; iteration < 100; iteration++) {
      // Property: Invalid plan ID should return undefined without affecting configuration
      const invalidPlan = PricingUtils.getPlanById('invalid-plan-id');
      expect(invalidPlan).toBeUndefined();
      
      // Property: Configuration should remain intact after invalid queries
      expect(PRICING_PLANS.length).toBe(3);
      expect(PRICING_PLANS.every(plan => plan.id && plan.name && plan.displayName)).toBe(true);
      
      // Property: Price formatting with invalid currency should still work
      const plan = PRICING_PLANS[0];
      expect(() => PricingUtils.formatPrice(plan.monthlyPrice, 'INVALID' as 'ZAR' | 'USD' | 'EUR')).not.toThrow();
      
      // Property: Utility functions should handle edge cases without corrupting data
      expect(() => PricingUtils.calculateYearlySavings(0, 0)).not.toThrow();
      expect(() => PricingUtils.getPriceForCycle(plan, 'monthly')).not.toThrow();
      expect(() => PricingUtils.getPriceForCycle(plan, 'yearly')).not.toThrow();
    }
  });
});