/**
 * Integration tests for shared pricing configuration
 * Validates that frontend properly imports and uses shared pricing data
 */

import { PRICING_PLANS, PricingUtils } from '../pricing-config';

describe('Shared Pricing Integration', () => {
  describe('PRICING_PLANS', () => {
    test('should have exactly 5 plans matching backend tiers', () => {
      expect(PRICING_PLANS).toHaveLength(5);
      
      const expectedIds = ['pilot_solo', 'pilot_lite', 'pilot_core', 'pilot_pro', 'enterprise'];
      const actualIds = PRICING_PLANS.map(plan => plan.id);
      
      expect(actualIds).toEqual(expectedIds);
    });

    test('should have correct pricing values matching backend', () => {
      const pilotSolo = PRICING_PLANS.find(p => p.id === 'pilot_solo');
      const pilotLite = PRICING_PLANS.find(p => p.id === 'pilot_lite');
      const pilotCore = PRICING_PLANS.find(p => p.id === 'pilot_core');
      const pilotPro = PRICING_PLANS.find(p => p.id === 'pilot_pro');
      const enterprise = PRICING_PLANS.find(p => p.id === 'enterprise');

      // Pilot Solo - Free
      expect(pilotSolo?.monthlyPrice).toBe(0);
      expect(pilotSolo?.yearlyPrice).toBe(0);

      // Pilot Lite - R199/month, R1910.40/year
      expect(pilotLite?.monthlyPrice).toBe(19900);
      expect(pilotLite?.yearlyPrice).toBe(191040);

      // Pilot Core - R799/month, R7670.40/year
      expect(pilotCore?.monthlyPrice).toBe(79900);
      expect(pilotCore?.yearlyPrice).toBe(767040);

      // Pilot Pro - R1499/month, R14390.40/year
      expect(pilotPro?.monthlyPrice).toBe(149900);
      expect(pilotPro?.yearlyPrice).toBe(1439040);

      // Enterprise - Custom pricing
      expect(enterprise?.monthlyPrice).toBe(-1);
      expect(enterprise?.yearlyPrice).toBe(-1);
      expect(enterprise?.isCustomPricing).toBe(true);
    });

    test('should have Pilot Core as recommended tier', () => {
      const recommendedPlan = PRICING_PLANS.find(plan => plan.recommended);
      expect(recommendedPlan?.id).toBe('pilot_core');
    });

    test('should have proper sort order', () => {
      const sortOrders = PRICING_PLANS.map(plan => plan.sortOrder);
      expect(sortOrders).toEqual([0, 1, 2, 3, 4]);
    });
  });

  describe('PricingUtils', () => {
    describe('formatPrice', () => {
      test('should format ZAR prices correctly', () => {
        expect(PricingUtils.formatPrice(0)).toBe('Free');
        expect(PricingUtils.formatPrice(-1)).toBe('Contact Sales');
        expect(PricingUtils.formatPrice(19900)).toBe('R199');
        expect(PricingUtils.formatPrice(79900)).toBe('R799');
        expect(PricingUtils.formatPrice(149900)).toBe('R1,499');
      });
    });

    describe('calculateYearlySavings', () => {
      test('should calculate 20% savings correctly', () => {
        // Pilot Lite: R199 * 12 = R2388, yearly = R1910.40, savings = 20%
        const savings = PricingUtils.calculateYearlySavings(19900, 191040);
        expect(savings).toBe(20);
      });

      test('should return 0 for free plans', () => {
        const savings = PricingUtils.calculateYearlySavings(0, 0);
        expect(savings).toBe(0);
      });

      test('should return 0 for custom pricing', () => {
        const savings = PricingUtils.calculateYearlySavings(-1, -1);
        expect(savings).toBe(0);
      });
    });

    describe('formatPriceWithCycle', () => {
      test('should format regular pricing with cycle', () => {
        const pilotLite = PRICING_PLANS.find(p => p.id === 'pilot_lite')!;
        
        expect(PricingUtils.formatPriceWithCycle(pilotLite, 'monthly')).toBe('R199/mo');
        expect(PricingUtils.formatPriceWithCycle(pilotLite, 'yearly')).toBe('R1,910.4/yr');
      });

      test('should handle free plans correctly', () => {
        const pilotSolo = PRICING_PLANS.find(p => p.id === 'pilot_solo')!;
        
        expect(PricingUtils.formatPriceWithCycle(pilotSolo, 'monthly')).toBe('Free');
        expect(PricingUtils.formatPriceWithCycle(pilotSolo, 'yearly')).toBe('Free');
      });

      test('should handle custom pricing correctly', () => {
        const enterprise = PRICING_PLANS.find(p => p.id === 'enterprise')!;
        
        expect(PricingUtils.formatPriceWithCycle(enterprise, 'monthly')).toBe('Contact Sales');
        expect(PricingUtils.formatPriceWithCycle(enterprise, 'yearly')).toBe('Contact Sales');
      });
    });

    describe('getPlanById', () => {
      test('should return correct plan by ID', () => {
        const plan = PricingUtils.getPlanById('pilot_core');
        
        expect(plan).toBeDefined();
        expect(plan!.id).toBe('pilot_core');
        expect(plan!.displayName).toBe('Pilot Core');
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
  });

  describe('Enterprise Tier Features', () => {
    test('should have all enterprise features', () => {
      const enterprise = PRICING_PLANS.find(p => p.id === 'enterprise')!;
      
      expect(enterprise.features).toContain('Custom enterprise features');
      expect(enterprise.features).toContain('White-label options');
      expect(enterprise.features).toContain('Custom development');
      expect(enterprise.features).toContain('Dedicated account manager');
      expect(enterprise.features).toContain('SLA guarantees');
      expect(enterprise.features).toContain('Advanced security');
      expect(enterprise.features).toContain('Custom workflows');
      expect(enterprise.features).toContain('Unlimited everything');
    });

    test('should have custom pricing indicator', () => {
      const enterprise = PRICING_PLANS.find(p => p.id === 'enterprise')!;
      
      expect(enterprise.isCustomPricing).toBe(true);
      expect(enterprise.monthlyPrice).toBe(-1);
      expect(enterprise.yearlyPrice).toBe(-1);
    });
  });
});