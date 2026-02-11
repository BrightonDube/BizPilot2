/**
 * Tests for centralized pricing configuration
 * Validates the pricing data structure and utility functions
 */

import {
  PRICING_PLANS,
  AI_MESSAGING,
  FEATURE_COMPARISON,
  PricingUtils,
  type PricingPlan
} from '../pricing-config';

describe('Pricing Configuration', () => {
  describe('PRICING_PLANS', () => {
    test('should have exactly 5 plans', () => {
      expect(PRICING_PLANS).toHaveLength(5);
    });

    test('should have all required plan fields', () => {
      PRICING_PLANS.forEach((plan: PricingPlan) => {
        expect(plan).toHaveProperty('id');
        expect(plan).toHaveProperty('name');
        expect(plan).toHaveProperty('displayName');
        expect(plan).toHaveProperty('description');
        expect(plan).toHaveProperty('monthlyPrice');
        expect(plan).toHaveProperty('yearlyPrice');
        expect(plan).toHaveProperty('currency');
        expect(plan).toHaveProperty('features');
        expect(plan).toHaveProperty('limitations');
        expect(plan).toHaveProperty('aiFeatures');
        expect(plan).toHaveProperty('sortOrder');

        // Validate types
        expect(typeof plan.id).toBe('string');
        expect(typeof plan.name).toBe('string');
        expect(typeof plan.displayName).toBe('string');
        expect(typeof plan.description).toBe('string');
        expect(typeof plan.monthlyPrice).toBe('number');
        expect(typeof plan.yearlyPrice).toBe('number');
        expect(typeof plan.currency).toBe('string');
        expect(Array.isArray(plan.features)).toBe(true);
        expect(Array.isArray(plan.limitations)).toBe(true);
        expect(typeof plan.aiFeatures).toBe('object');
        expect(typeof plan.sortOrder).toBe('number');
      });
    });

    test('should have pilot_solo plan as free', () => {
      const soloPlan = PRICING_PLANS.find(plan => plan.id === 'pilot_solo');
      expect(soloPlan).toBeDefined();
      expect(soloPlan!.monthlyPrice).toBe(0);
      expect(soloPlan!.yearlyPrice).toBe(0);
    });

    test('should have pilot_core plan as recommended', () => {
      const corePlan = PRICING_PLANS.find(plan => plan.id === 'pilot_core');
      expect(corePlan).toBeDefined();
      expect(corePlan!.recommended).toBe(true);
    });

    test('should have proper sort order', () => {
      const sortOrders = PRICING_PLANS.map(plan => plan.sortOrder);
      expect(sortOrders).toEqual([0, 1, 2, 3, 4]);
    });

    test('should have AI features for all plans', () => {
      PRICING_PLANS.forEach((plan: PricingPlan) => {
        expect(plan.aiFeatures).toBeDefined();
        expect(typeof plan.aiFeatures.smartAnalytics).toBe('boolean');
        expect(typeof plan.aiFeatures.predictiveInsights).toBe('boolean');
        expect(typeof plan.aiFeatures.automatedReordering).toBe('boolean');
        expect(typeof plan.aiFeatures.intelligentPricing).toBe('boolean');
      });
    });
  });

  describe('AI_MESSAGING', () => {
    test('should have all required messaging fields', () => {
      expect(AI_MESSAGING).toHaveProperty('heroTagline');
      expect(AI_MESSAGING).toHaveProperty('keyBenefits');
      expect(AI_MESSAGING).toHaveProperty('privacyMessage');
      expect(AI_MESSAGING).toHaveProperty('controlMessage');
      expect(AI_MESSAGING).toHaveProperty('automationBenefits');

      expect(typeof AI_MESSAGING.heroTagline).toBe('string');
      expect(Array.isArray(AI_MESSAGING.keyBenefits)).toBe(true);
      expect(typeof AI_MESSAGING.privacyMessage).toBe('string');
      expect(typeof AI_MESSAGING.controlMessage).toBe('string');
      expect(Array.isArray(AI_MESSAGING.automationBenefits)).toBe(true);
    });

    test('should have smart-feature-focused messaging', () => {
      expect(AI_MESSAGING.heroTagline.toLowerCase()).toMatch(/smart|intelligent|ai/);
      expect(AI_MESSAGING.keyBenefits.some(benefit => 
        benefit.toLowerCase().includes('ai') || 
        benefit.toLowerCase().includes('intelligent') ||
        benefit.toLowerCase().includes('smart')
      )).toBe(true);
    });
  });

  describe('PricingUtils', () => {
    describe('formatPrice', () => {
      test('should format ZAR prices correctly', () => {
        expect(PricingUtils.formatPrice(0, 'ZAR')).toBe('Free');
        expect(PricingUtils.formatPrice(49900, 'ZAR')).toBe('R499');
        expect(PricingUtils.formatPrice(149900, 'ZAR')).toBe('R1,499');
      });

      test('should format USD prices correctly', () => {
        expect(PricingUtils.formatPrice(4900, 'USD')).toBe('$49');
        expect(PricingUtils.formatPrice(14900, 'USD')).toBe('$149');
      });
    });

    describe('calculateYearlySavings', () => {
      test('should calculate savings correctly', () => {
        const monthlyPrice = 49900; // R499
        const yearlyPrice = 479040; // R4,790.40 (20% discount)
        const savings = PricingUtils.calculateYearlySavings(monthlyPrice, yearlyPrice);
        expect(savings).toBe(20);
      });

      test('should return 0 for free plans', () => {
        const savings = PricingUtils.calculateYearlySavings(0, 0);
        expect(savings).toBe(0);
      });
    });

    describe('getPriceForCycle', () => {
      test('should return correct price for billing cycle', () => {
        const plan = PRICING_PLANS.find(p => p.id === 'pilot_core')!;
        
        expect(PricingUtils.getPriceForCycle(plan, 'monthly')).toBe(plan.monthlyPrice);
        expect(PricingUtils.getPriceForCycle(plan, 'yearly')).toBe(plan.yearlyPrice);
      });
    });

    describe('formatPriceWithCycle', () => {
      test('should format price with cycle suffix', () => {
        const plan = PRICING_PLANS.find(p => p.id === 'pilot_core')!;
        const monthlyFormatted = PricingUtils.formatPriceWithCycle(plan, 'monthly');
        const yearlyFormatted = PricingUtils.formatPriceWithCycle(plan, 'yearly');
        
        expect(monthlyFormatted).toMatch(/R[\d,.]+\/mo/);
        expect(yearlyFormatted).toMatch(/R[\d,.]+\/yr/);
      });

      test('should handle free plans correctly', () => {
        const plan = PRICING_PLANS.find(p => p.id === 'pilot_solo')!;
        
        expect(PricingUtils.formatPriceWithCycle(plan, 'monthly')).toBe('Free');
        expect(PricingUtils.formatPriceWithCycle(plan, 'yearly')).toBe('Free');
      });
    });

    describe('getPlanById', () => {
      test('should return correct plan by ID', () => {
        const plan = PricingUtils.getPlanById('pilot_core');
        expect(plan).toBeDefined();
        expect(plan!.id).toBe('pilot_core');
      });

      test('should return undefined for invalid ID', () => {
        const plan = PricingUtils.getPlanById('invalid');
        expect(plan).toBeUndefined();
      });
    });

    describe('getRecommendedPlan', () => {
      test('should return the recommended plan', () => {
        const plan = PricingUtils.getRecommendedPlan();
        expect(plan).toBeDefined();
        expect(plan!.recommended).toBe(true);
        expect(plan!.id).toBe('pilot_core');
      });
    });

    describe('convertFeaturesToBenefits', () => {
      test('should convert plan features to benefits format', () => {
        const plan = PRICING_PLANS.find(p => p.id === 'pilot_solo')!;
        const benefits = PricingUtils.convertFeaturesToBenefits(plan);
        
        expect(Array.isArray(benefits)).toBe(true);
        expect(benefits.length).toBeGreaterThan(0);
        
        benefits.forEach(benefit => {
          expect(benefit).toHaveProperty('text');
          expect(benefit).toHaveProperty('checked');
          expect(typeof benefit.text).toBe('string');
          expect(typeof benefit.checked).toBe('boolean');
        });
      });
    });

    describe('getAIFeaturesCount', () => {
      test('should count enabled AI features correctly', () => {
        const soloPlan = PRICING_PLANS.find(p => p.id === 'pilot_solo')!;
        const proPlan = PRICING_PLANS.find(p => p.id === 'pilot_pro')!;
        
        const soloCount = PricingUtils.getAIFeaturesCount(soloPlan);
        const proCount = PricingUtils.getAIFeaturesCount(proPlan);
        
        expect(soloCount).toBeGreaterThanOrEqual(0);
        expect(proCount).toBeGreaterThan(soloCount);
      });
    });

    describe('getEnabledAIFeatures', () => {
      test('should return list of enabled AI features', () => {
        const plan = PRICING_PLANS.find(p => p.id === 'pilot_pro')!;
        const features = PricingUtils.getEnabledAIFeatures(plan);
        
        expect(Array.isArray(features)).toBe(true);
        expect(features.length).toBeGreaterThan(0);
        
        features.forEach(feature => {
          expect(typeof feature).toBe('string');
          expect(feature.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('FEATURE_COMPARISON', () => {
    test('should have feature comparison data', () => {
      expect(Array.isArray(FEATURE_COMPARISON)).toBe(true);
      expect(FEATURE_COMPARISON.length).toBeGreaterThan(0);
      
      FEATURE_COMPARISON.forEach(category => {
        expect(category).toHaveProperty('category');
        expect(category).toHaveProperty('features');
        expect(typeof category.category).toBe('string');
        expect(Array.isArray(category.features)).toBe(true);
        
        category.features.forEach(feature => {
          expect(feature).toHaveProperty('name');
          expect(feature).toHaveProperty('pilot_solo');
          expect(feature).toHaveProperty('pilot_lite');
          expect(feature).toHaveProperty('pilot_core');
          expect(feature).toHaveProperty('pilot_pro');
          expect(feature).toHaveProperty('enterprise');
        });
      });
    });
  });
});