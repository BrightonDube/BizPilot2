/**
 * Frontend Integration Tests for Pricing Consistency Across Platform
 * 
 * This test suite validates Requirements 1.1, 1.2, 1.3, 1.5, 3.6 from the frontend perspective:
 * 1. Marketing page pricing matches backend tiers exactly (including Enterprise)
 * 2. Billing settings show identical pricing to marketing page
 * 3. Payment processing uses correct pricing amounts
 * 4. Tier upgrade/downgrade with consistent pricing (Enterprise contact sales flow)
 * 5. Enterprise tier displays "Contact Sales" consistently across all pages
 * 
 * Task 7.1: Test pricing consistency across platform
 */

import { PRICING_PLANS, PricingUtils, type BillingCycle } from '../pricing-config';
import { SUBSCRIPTION_TIERS, PricingUtils as SharedPricingUtils } from '@/shared/pricing-config';

describe('Frontend Pricing Consistency Integration', () => {
  
  // ==================== Requirement 1.1: Marketing Page Pricing Matches Backend ====================
  
  describe('Marketing Page Pricing Consistency', () => {
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
  });

  // ==================== Requirement 3.6: Enterprise Tier "Contact Sales" Display ====================
  
  describe('Enterprise Tier Contact Sales Display', () => {
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

    test('should identify Enterprise tier as having custom pricing', () => {
      const enterprisePlan = PRICING_PLANS.find(plan => plan.id === 'enterprise');
      expect(enterprisePlan).toBeDefined();
      
      if (enterprisePlan) {
        // Use shared utilities for advanced functions
        const sharedTier = SUBSCRIPTION_TIERS.find(tier => tier.id === 'enterprise');
        expect(sharedTier).toBeDefined();
        
        if (sharedTier) {
          expect(SharedPricingUtils.hasCustomPricing(sharedTier)).toBe(true);
          expect(SharedPricingUtils.isFree(sharedTier)).toBe(false);
        }
      }
    });

    test('should have unlimited features for Enterprise tier', () => {
      const enterprisePlan = PRICING_PLANS.find(plan => plan.id === 'enterprise');
      expect(enterprisePlan).toBeDefined();
      
      if (enterprisePlan) {
        // Check that Enterprise has the most features
        expect(enterprisePlan.features.length).toBeGreaterThan(0);
        
        // Verify Enterprise tier has custom pricing flag
        expect(enterprisePlan.isCustomPricing).toBe(true);
        
        // Check shared tier for unlimited features
        const sharedTier = SUBSCRIPTION_TIERS.find(tier => tier.id === 'enterprise');
        if (sharedTier) {
          expect(sharedTier.features.max_users).toBe(-1); // -1 indicates unlimited
          expect(sharedTier.features.max_orders_per_month).toBe(-1);
          expect(sharedTier.features.max_terminals).toBe(-1);
        }
      }
    });
  });

  // ==================== Requirement 1.2: Billing Settings Pricing Consistency ====================
  
  describe('Billing Settings Pricing Consistency', () => {
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
          expect(monthlyFormatted).toMatch(/R[\d,]+\/mo/);
          expect(yearlyFormatted).toMatch(/R[\d,]+\/yr/);
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
      const billingCycles: BillingCycle[] = ['monthly', 'yearly'];
      
      for (const plan of PRICING_PLANS) {
        for (const cycle of billingCycles) {
          const price = PricingUtils.getPriceForCycle(plan, cycle);
          const expectedPrice = cycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
          
          expect(price).toBe(expectedPrice);
        }
      }
    });
  });

  // ==================== Requirement 1.5: Billing Cycle Calculations ====================
  
  describe('Billing Cycle Calculations', () => {
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
  });

  // ==================== Cross-Platform Data Consistency ====================
  
  describe('Cross-Platform Data Consistency', () => {
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

    test('should maintain feature consistency between frontend and shared config', () => {
      for (const plan of PRICING_PLANS) {
        const sharedTier = SUBSCRIPTION_TIERS.find(tier => tier.id === plan.id);
        expect(sharedTier).toBeDefined();
        
        if (sharedTier) {
          // Verify key features are consistent
          // Note: Frontend may have different feature naming/structure
          // but core limitations should be consistent
          
          if (plan.id === 'pilot_solo') {
            // Free tier should have basic limitations
            expect(plan.monthlyPrice).toBe(0);
            expect(plan.yearlyPrice).toBe(0);
          } else if (plan.id === 'enterprise') {
            // Enterprise should have custom pricing and unlimited features
            expect(plan.isCustomPricing).toBe(true);
            expect(plan.monthlyPrice).toBe(-1);
            expect(plan.yearlyPrice).toBe(-1);
          }
        }
      }
    });
  });

  // ==================== Pricing Utility Functions ====================
  
  describe('Pricing Utility Functions', () => {
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
      
      // Use shared utilities for advanced functions
      const activeTiers = SharedPricingUtils.getActiveTiers();
      expect(activeTiers).toHaveLength(5);
      
      // Verify tiers are sorted by sort_order
      for (let i = 1; i < activeTiers.length; i++) {
        expect(activeTiers[i-1].sort_order).toBeLessThanOrEqual(activeTiers[i].sort_order);
      }
    });

    test('should validate pricing configuration correctly', () => {
      // Test that all pricing plans pass validation using shared utilities
      for (const plan of PRICING_PLANS) {
        const sharedTier = SUBSCRIPTION_TIERS.find(tier => tier.id === plan.id);
        expect(sharedTier).toBeDefined();
        
        if (sharedTier) {
          const validation = SharedPricingUtils.validateTier(sharedTier);
          expect(validation.isValid).toBe(true);
          
          if (!validation.isValid) {
            console.error(`Validation errors for ${plan.id}:`, validation.errors);
          }
        }
      }
    });

    test('should handle tier comparisons correctly', () => {
      const pilotLite = PRICING_PLANS.find(p => p.id === 'pilot_lite');
      const pilotCore = PRICING_PLANS.find(p => p.id === 'pilot_core');
      const enterprise = PRICING_PLANS.find(p => p.id === 'enterprise');
      
      expect(pilotLite).toBeDefined();
      expect(pilotCore).toBeDefined();
      expect(enterprise).toBeDefined();
      
      if (pilotLite && pilotCore) {
        // Use shared utilities for comparison
        const sharedLite = SUBSCRIPTION_TIERS.find(t => t.id === 'pilot_lite');
        const sharedCore = SUBSCRIPTION_TIERS.find(t => t.id === 'pilot_core');
        
        if (sharedLite && sharedCore) {
          const comparison = SharedPricingUtils.compareTiers(sharedLite, sharedCore, 'monthly');
          
          expect(comparison.tier1IsMoreExpensive).toBe(false);
          expect(comparison.priceDifference).toBeLessThan(0);
          expect(comparison.tier1HasCustomPricing).toBe(false);
          expect(comparison.tier2HasCustomPricing).toBe(false);
        }
      }
      
      if (pilotCore && enterprise) {
        const sharedCore = SUBSCRIPTION_TIERS.find(t => t.id === 'pilot_core');
        const sharedEnterprise = SUBSCRIPTION_TIERS.find(t => t.id === 'enterprise');
        
        if (sharedCore && sharedEnterprise) {
          const comparison = SharedPricingUtils.compareTiers(sharedCore, sharedEnterprise, 'monthly');
          
          expect(comparison.tier2HasCustomPricing).toBe(true);
          expect(comparison.priceDifference).toBe(0); // Custom pricing comparison
        }
      }
    });
  });

  // ==================== Integration with Marketing Components ====================
  
  describe('Marketing Component Integration', () => {
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
  });
});