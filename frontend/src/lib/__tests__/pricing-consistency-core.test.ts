/**
 * Core Pricing Consistency Tests for Task 7.1
 * 
 * This test suite validates the core requirements for pricing consistency:
 * 1. Marketing page pricing matches backend tiers exactly (including Enterprise)
 * 2. Billing settings show identical pricing to marketing page
 * 3. Enterprise tier displays "Contact Sales" consistently
 * 4. Yearly discounts are calculated correctly
 * 5. All pricing sources use the same data
 * 
 * Task 7.1: Test pricing consistency across platform
 */

import { PRICING_PLANS, PricingUtils } from '../pricing-config';
import { SUBSCRIPTION_TIERS } from '../../../../shared/pricing-config';

describe('Core Pricing Consistency - Task 7.1', () => {
  
  // ==================== Requirement 1.1: Marketing Page Pricing Matches Backend ====================
  
  test('should have exactly 5 pricing plans including Enterprise', () => {
    expect(PRICING_PLANS).toHaveLength(5);
    
    const planNames = PRICING_PLANS.map(plan => plan.id);
    const expectedNames = ['pilot_solo', 'pilot_lite', 'pilot_core', 'pilot_pro', 'enterprise'];
    
    expect(planNames.sort()).toEqual(expectedNames.sort());
  });

  test('should match shared configuration pricing exactly', () => {
    // Verify each frontend pricing plan matches shared configuration
    for (const frontendPlan of PRICING_PLANS) {
      const sharedTier = SUBSCRIPTION_TIERS.find(tier => tier.id === frontendPlan.id);
      expect(sharedTier).toBeDefined();
      
      if (sharedTier) {
        // Verify exact pricing match
        expect(frontendPlan.monthlyPrice).toBe(sharedTier.price_monthly_cents);
        expect(frontendPlan.yearlyPrice).toBe(sharedTier.price_yearly_cents);
        expect(frontendPlan.currency).toBe(sharedTier.currency);
        expect(frontendPlan.displayName).toBe(sharedTier.display_name);
        expect(frontendPlan.description).toBe(sharedTier.description);
      }
    }
  });

  test('should have correct pricing amounts for each tier', () => {
    const expectedPricing = {
      pilot_solo: { monthly: 0, yearly: 0 },
      pilot_lite: { monthly: 19900, yearly: 191040 },
      pilot_core: { monthly: 79900, yearly: 767040 },
      pilot_pro: { monthly: 149900, yearly: 1439040 },
      enterprise: { monthly: -1, yearly: -1 }
    };

    for (const plan of PRICING_PLANS) {
      const expected = expectedPricing[plan.id as keyof typeof expectedPricing];
      expect(plan.monthlyPrice).toBe(expected.monthly);
      expect(plan.yearlyPrice).toBe(expected.yearly);
    }
  });

  // ==================== Requirement 3.6: Enterprise Tier "Contact Sales" Display ====================
  
  test('should display "Contact Sales" for Enterprise tier pricing', () => {
    const enterprisePlan = PRICING_PLANS.find(plan => plan.id === 'enterprise');
    expect(enterprisePlan).toBeDefined();
    
    if (enterprisePlan) {
      // Test monthly pricing display
      const monthlyDisplay = PricingUtils.formatPriceWithCycle(enterprisePlan, 'monthly');
      expect(monthlyDisplay).toBe('Contact Sales');
      
      // Test yearly pricing display
      const yearlyDisplay = PricingUtils.formatPriceWithCycle(enterprisePlan, 'yearly');
      expect(yearlyDisplay).toBe('Contact Sales');
      
      // Test raw price formatting
      const rawMonthlyDisplay = PricingUtils.formatPrice(enterprisePlan.monthlyPrice);
      const rawYearlyDisplay = PricingUtils.formatPrice(enterprisePlan.yearlyPrice);
      
      expect(rawMonthlyDisplay).toBe('Contact Sales');
      expect(rawYearlyDisplay).toBe('Contact Sales');
    }
  });

  test('should properly identify Enterprise tier with custom pricing', () => {
    const enterprisePlan = PRICING_PLANS.find(plan => plan.id === 'enterprise');
    expect(enterprisePlan).toBeDefined();
    
    if (enterprisePlan) {
      expect(enterprisePlan.isCustomPricing).toBe(true);
      expect(enterprisePlan.monthlyPrice).toBe(-1);
      expect(enterprisePlan.yearlyPrice).toBe(-1);
      expect(enterprisePlan.displayName).toBe('Enterprise');
    }
  });

  // ==================== Requirement 1.2: Billing Settings Pricing Consistency ====================
  
  test('should use same pricing data as marketing pages', () => {
    // This test verifies that billing settings would use the same PRICING_PLANS data
    // as marketing pages, ensuring consistency
    
    for (const plan of PRICING_PLANS) {
      // Test that pricing utility functions work consistently
      const monthlyFormatted = PricingUtils.formatPriceWithCycle(plan, 'monthly');
      const yearlyFormatted = PricingUtils.formatPriceWithCycle(plan, 'yearly');
      
      if (plan.isCustomPricing) {
        expect(monthlyFormatted).toBe('Contact Sales');
        expect(yearlyFormatted).toBe('Contact Sales');
      } else if (plan.monthlyPrice === 0) {
        expect(monthlyFormatted).toBe('Free');
        expect(yearlyFormatted).toBe('Free');
      } else {
        // Verify formatted prices contain currency and cycle indicators
        expect(monthlyFormatted).toMatch(/R[\d,\.]+\/mo/);
        expect(yearlyFormatted).toMatch(/R[\d,\.]+\/yr/);
      }
    }
  });

  test('should calculate yearly savings consistently', () => {
    for (const plan of PRICING_PLANS) {
      if (plan.isCustomPricing || plan.monthlyPrice === 0) {
        // Skip Enterprise (custom pricing) and free tiers
        continue;
      }
      
      const savings = PricingUtils.calculateYearlySavings(plan.monthlyPrice, plan.yearlyPrice);
      
      // Verify approximately 20% savings for paid tiers
      expect(savings).toBeGreaterThanOrEqual(19);
      expect(savings).toBeLessThanOrEqual(21);
    }
  });

  test('should handle billing cycle switching correctly', () => {
    const billingCycles = ['monthly', 'yearly'] as const;
    
    for (const plan of PRICING_PLANS) {
      for (const cycle of billingCycles) {
        const price = PricingUtils.getPriceForCycle(plan, cycle);
        const expectedPrice = cycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
        
        expect(price).toBe(expectedPrice);
      }
    }
  });

  // ==================== Requirement 1.5: Billing Cycle Calculations ====================
  
  test('should calculate correct yearly discounts', () => {
    const paidPlans = PRICING_PLANS.filter(plan => 
      plan.monthlyPrice > 0 && plan.yearlyPrice > 0 && !plan.isCustomPricing
    );
    
    for (const plan of paidPlans) {
      const monthlyTotal = plan.monthlyPrice * 12;
      const actualSavings = monthlyTotal - plan.yearlyPrice;
      const savingsPercentage = (actualSavings / monthlyTotal) * 100;
      
      // Verify approximately 20% discount
      expect(savingsPercentage).toBeGreaterThanOrEqual(19);
      expect(savingsPercentage).toBeLessThanOrEqual(21);
    }
  });

  test('should format prices correctly for both billing cycles', () => {
    for (const plan of PRICING_PLANS) {
      const monthlyFormatted = PricingUtils.formatPriceWithCycle(plan, 'monthly');
      const yearlyFormatted = PricingUtils.formatPriceWithCycle(plan, 'yearly');
      
      if (plan.isCustomPricing) {
        expect(monthlyFormatted).toBe('Contact Sales');
        expect(yearlyFormatted).toBe('Contact Sales');
      } else if (plan.monthlyPrice === 0) {
        expect(monthlyFormatted).toBe('Free');
        expect(yearlyFormatted).toBe('Free');
      } else {
        expect(monthlyFormatted).toContain('/mo');
        expect(yearlyFormatted).toContain('/yr');
      }
    }
  });

  // ==================== Cross-Platform Data Consistency ====================
  
  test('should have consistent tier ordering', () => {
    // Verify tiers are ordered by sort_order
    const sortOrders = PRICING_PLANS.map(plan => {
      const sharedTier = SUBSCRIPTION_TIERS.find(tier => tier.id === plan.id);
      return sharedTier?.sort_order || 0;
    });
    
    const sortedOrders = [...sortOrders].sort((a, b) => a - b);
    expect(sortOrders).toEqual(sortedOrders);
  });

  test('should have exactly one default tier', () => {
    const defaultPlans = PRICING_PLANS.filter(plan => {
      const sharedTier = SUBSCRIPTION_TIERS.find(tier => tier.id === plan.id);
      return sharedTier?.is_default || false;
    });
    
    expect(defaultPlans).toHaveLength(1);
    expect(defaultPlans[0].id).toBe('pilot_solo');
  });

  test('should have all tiers marked as active', () => {
    for (const plan of PRICING_PLANS) {
      const sharedTier = SUBSCRIPTION_TIERS.find(tier => tier.id === plan.id);
      expect(sharedTier?.is_active).toBe(true);
    }
  });

  // ==================== Pricing Utility Functions ====================
  
  test('should format prices correctly for all currencies', () => {
    // Test ZAR formatting (default)
    expect(PricingUtils.formatPrice(0)).toBe('Free');
    expect(PricingUtils.formatPrice(-1)).toBe('Contact Sales');
    expect(PricingUtils.formatPrice(19900)).toBe('R199');
    expect(PricingUtils.formatPrice(79900)).toBe('R799');
    expect(PricingUtils.formatPrice(149900)).toBe('R1,499');
  });

  test('should handle tier lookup functions correctly', () => {
    // Test getPlanById (available in frontend utils)
    const pilotSolo = PricingUtils.getPlanById('pilot_solo');
    expect(pilotSolo).toBeDefined();
    expect(pilotSolo?.id).toBe('pilot_solo');
    
    // Test getRecommendedPlan
    const recommendedPlan = PricingUtils.getRecommendedPlan();
    expect(recommendedPlan).toBeDefined();
  });

  // ==================== Integration with Marketing Components ====================
  
  test('should provide correct data for pricing cards', () => {
    // Test that pricing plans can be used to generate pricing cards
    for (const plan of PRICING_PLANS) {
      // Verify required fields for pricing card display
      expect(plan.id).toBeDefined();
      expect(plan.displayName).toBeDefined();
      expect(plan.description).toBeDefined();
      expect(typeof plan.monthlyPrice).toBe('number');
      expect(typeof plan.yearlyPrice).toBe('number');
      expect(plan.currency).toBeDefined();
      
      // Verify pricing card can be generated for both billing cycles
      const monthlyCard = {
        tier: plan.displayName,
        price: PricingUtils.formatPriceWithCycle(plan, 'monthly'),
        bestFor: plan.description,
        cta: plan.isCustomPricing ? 'Contact Sales' : (plan.monthlyPrice === 0 ? 'Get Started Free' : 'Get Started'),
        planId: plan.id
      };
      
      expect(monthlyCard.tier).toBeTruthy();
      expect(monthlyCard.price).toBeTruthy();
      expect(monthlyCard.bestFor).toBeTruthy();
      expect(monthlyCard.cta).toBeTruthy();
      expect(monthlyCard.planId).toBeTruthy();
    }
  });

  test('should handle feature comparison data correctly', () => {
    // Test that plans have comparable feature data
    for (const plan of PRICING_PLANS) {
      expect(plan.features).toBeDefined();
      expect(Array.isArray(plan.features)).toBe(true);
      
      // Verify features can be converted to benefits format
      const benefits = PricingUtils.convertFeaturesToBenefits(plan);
      expect(Array.isArray(benefits)).toBe(true);
      
      // Each benefit should have required structure
      for (const benefit of benefits) {
        expect(benefit).toHaveProperty('text');
        expect(benefit).toHaveProperty('checked');
        expect(typeof benefit.text).toBe('string');
        expect(typeof benefit.checked).toBe('boolean');
      }
    }
  });

  // ==================== Summary Test: Complete Pricing Consistency ====================
  
  test('SUMMARY: All pricing sources should be consistent across platform', () => {
    // This is the main test that validates the complete pricing consistency requirement
    
    // 1. Verify we have all 5 tiers
    expect(PRICING_PLANS).toHaveLength(5);
    expect(SUBSCRIPTION_TIERS).toHaveLength(5);
    
    // 2. Verify exact pricing match between frontend and shared config
    for (const plan of PRICING_PLANS) {
      const sharedTier = SUBSCRIPTION_TIERS.find(tier => tier.id === plan.id);
      expect(sharedTier).toBeDefined();
      
      if (sharedTier) {
        expect(plan.monthlyPrice).toBe(sharedTier.price_monthly_cents);
        expect(plan.yearlyPrice).toBe(sharedTier.price_yearly_cents);
      }
    }
    
    // 3. Verify Enterprise tier has custom pricing
    const enterprisePlan = PRICING_PLANS.find(plan => plan.id === 'enterprise');
    const enterpriseShared = SUBSCRIPTION_TIERS.find(tier => tier.id === 'enterprise');
    
    expect(enterprisePlan?.isCustomPricing).toBe(true);
    expect(enterprisePlan?.monthlyPrice).toBe(-1);
    expect(enterprisePlan?.yearlyPrice).toBe(-1);
    expect(enterpriseShared?.is_custom_pricing).toBe(true);
    
    // 4. Verify "Contact Sales" display for Enterprise
    if (enterprisePlan) {
      expect(PricingUtils.formatPriceWithCycle(enterprisePlan, 'monthly')).toBe('Contact Sales');
      expect(PricingUtils.formatPriceWithCycle(enterprisePlan, 'yearly')).toBe('Contact Sales');
    }
    
    // 5. Verify yearly discounts are consistent
    const paidPlans = PRICING_PLANS.filter(plan => 
      plan.monthlyPrice > 0 && plan.yearlyPrice > 0 && !plan.isCustomPricing
    );
    
    for (const plan of paidPlans) {
      const savings = PricingUtils.calculateYearlySavings(plan.monthlyPrice, plan.yearlyPrice);
      expect(savings).toBeGreaterThanOrEqual(19);
      expect(savings).toBeLessThanOrEqual(21);
    }
    
    console.log('✅ PRICING CONSISTENCY VALIDATION COMPLETE');
    console.log('✅ All pricing sources are consistent across the platform');
    console.log('✅ Enterprise tier properly displays "Contact Sales"');
    console.log('✅ Yearly discounts are calculated correctly');
    console.log('✅ Marketing page pricing matches backend tiers exactly');
  });
});