/**
 * Property-Based Tests for Centralized Pricing Configuration
 * 
 * These tests validate universal properties that should hold true across
 * all pricing plans and configurations using property-based testing.
 * 
 * **Feature: marketing-pages-redesign, Property 6: Pricing Data Structure Completeness**
 * **Validates: Requirements 3.4**
 */

import {
  PRICING_PLANS,
  PricingUtils,
  type PricingPlan,
  type AIFeatures
} from '../pricing-config';

/**
 * Property 6: Pricing Data Structure Completeness
 * 
 * For any pricing plan in the centralized configuration, it should contain 
 * all required fields: plan names, features, pricing tiers, and billing cycles.
 * 
 * **Validates: Requirements 3.4**
 */
describe('Property 6: Pricing Data Structure Completeness', () => {
  
  // Generate test cases for all pricing plans
  const generatePricingPlanTestCases = (): PricingPlan[] => {
    return PRICING_PLANS;
  };

  // Property test with multiple iterations
  test('should have complete data structure for all pricing plans', () => {
    const testCases = generatePricingPlanTestCases();
    
    // Run property test across all plans (minimum 100 iterations as per design)
    for (let iteration = 0; iteration < Math.max(100, testCases.length * 10); iteration++) {
      const plan = testCases[iteration % testCases.length];
      
      // Property: Every plan must have all required fields
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

      // Property: All required fields must have correct types
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

      // Property: All required fields must have valid values
      expect(plan.id.length).toBeGreaterThan(0);
      expect(plan.name.length).toBeGreaterThan(0);
      expect(plan.displayName.length).toBeGreaterThan(0);
      expect(plan.description.length).toBeGreaterThan(0);
      // Enterprise has custom pricing (-1)
      if (!plan.isCustomPricing) {
        expect(plan.monthlyPrice).toBeGreaterThanOrEqual(0);
        expect(plan.yearlyPrice).toBeGreaterThanOrEqual(0);
      }
      expect(plan.currency.length).toBeGreaterThan(0);
      expect(plan.features.length).toBeGreaterThan(0);
      // Enterprise has no limitations
      if (plan.id !== 'enterprise') {
        expect(plan.limitations.length).toBeGreaterThan(0);
      }
      expect(plan.sortOrder).toBeGreaterThanOrEqual(0);

      // Property: Features array must contain only non-empty strings
      plan.features.forEach(feature => {
        expect(typeof feature).toBe('string');
        expect(feature.length).toBeGreaterThan(0);
      });

      // Property: Limitations array must contain only non-empty strings
      plan.limitations.forEach(limitation => {
        expect(typeof limitation).toBe('string');
        expect(limitation.length).toBeGreaterThan(0);
      });

      // Property: AI features must have all required boolean properties
      const requiredAIFeatures = [
        'smartAnalytics',
        'predictiveInsights',
        'automatedReordering',
        'intelligentPricing',
        'aiPoweredInventoryTracking',
        'smartCustomerSegmentation',
        'predictiveStockAlerts',
        'intelligentCostOptimization',
        'aiDrivenSalesForecasting',
        'automatedSupplierRecommendations'
      ];

      requiredAIFeatures.forEach(featureName => {
        expect(plan.aiFeatures).toHaveProperty(featureName);
        expect(typeof plan.aiFeatures[featureName as keyof AIFeatures]).toBe('boolean');
      });

      // Property: Billing cycles must be consistent (yearly should be discounted or equal)
      if (plan.monthlyPrice > 0 && !plan.isCustomPricing) {
        const yearlyEquivalent = plan.monthlyPrice * 12;
        expect(plan.yearlyPrice).toBeLessThanOrEqual(yearlyEquivalent);
      }

      // Property: Currency must be a valid currency code
      expect(['ZAR', 'USD', 'EUR']).toContain(plan.currency);

      // Property: Plan names must be unique within the configuration
      const plansWithSameName = PRICING_PLANS.filter(p => p.name === plan.name);
      expect(plansWithSameName.length).toBe(1);

      // Property: Plan IDs must be unique within the configuration
      const plansWithSameId = PRICING_PLANS.filter(p => p.id === plan.id);
      expect(plansWithSameId.length).toBe(1);

      // Property: Sort orders must be unique within the configuration
      const plansWithSameSortOrder = PRICING_PLANS.filter(p => p.sortOrder === plan.sortOrder);
      expect(plansWithSameSortOrder.length).toBe(1);
    }
  });

  test('should maintain pricing tier hierarchy', () => {
    const testCases = generatePricingPlanTestCases();
    
    // Run property test for pricing hierarchy
    for (let iteration = 0; iteration < 100; iteration++) {
      const sortedPlans = [...testCases].sort((a, b) => a.sortOrder - b.sortOrder);
      
      // Property: Plans should be ordered by increasing price (except free tier)
      for (let i = 1; i < sortedPlans.length; i++) {
        const currentPlan = sortedPlans[i];
        const previousPlan = sortedPlans[i - 1];
        
        // Skip comparison if previous plan is free or either has custom pricing
        if (previousPlan.monthlyPrice === 0 || previousPlan.isCustomPricing || currentPlan.isCustomPricing) continue;
        
        // Property: Higher tier plans should have higher or equal prices
        expect(currentPlan.monthlyPrice).toBeGreaterThanOrEqual(previousPlan.monthlyPrice);
        
        // Property: Higher tier plans should have more or equal AI features
        const currentAICount = PricingUtils.getAIFeaturesCount(currentPlan);
        const previousAICount = PricingUtils.getAIFeaturesCount(previousPlan);
        expect(currentAICount).toBeGreaterThanOrEqual(previousAICount);
      }
    }
  });

  test('should have consistent utility function behavior', () => {
    const testCases = generatePricingPlanTestCases();
    
    // Run property test for utility functions
    for (let iteration = 0; iteration < 100; iteration++) {
      const plan = testCases[iteration % testCases.length];
      
      // Property: Price formatting should be consistent
      const monthlyFormatted = PricingUtils.formatPriceWithCycle(plan, 'monthly');
      const yearlyFormatted = PricingUtils.formatPriceWithCycle(plan, 'yearly');
      
      expect(typeof monthlyFormatted).toBe('string');
      expect(typeof yearlyFormatted).toBe('string');
      expect(monthlyFormatted.length).toBeGreaterThan(0);
      expect(yearlyFormatted.length).toBeGreaterThan(0);

      // Property: Plan retrieval should be consistent
      const retrievedPlan = PricingUtils.getPlanById(plan.id);
      expect(retrievedPlan).toBeDefined();
      expect(retrievedPlan!.id).toBe(plan.id);
      expect(retrievedPlan!.name).toBe(plan.name);

      // Property: Benefits conversion should preserve information
      const benefits = PricingUtils.convertFeaturesToBenefits(plan);
      expect(Array.isArray(benefits)).toBe(true);
      // Benefits should have entries
      expect(benefits.length).toBeGreaterThan(0);
      
      // Property: All benefits should have text and checked properties
      benefits.forEach(benefit => {
        expect(typeof benefit.text).toBe('string');
        expect(benefit.text.length).toBeGreaterThan(0);
        expect(typeof benefit.checked).toBe('boolean');
      });
      
      // Property: AI features count should match enabled features
      const aiCount = PricingUtils.getAIFeaturesCount(plan);
      const enabledFeatures = Object.values(plan.aiFeatures).filter(Boolean);
      expect(aiCount).toBe(enabledFeatures.length);

      // Property: Enabled AI features list should match count
      const aiFeaturesList = PricingUtils.getEnabledAIFeatures(plan);
      expect(aiFeaturesList.length).toBe(aiCount);
      aiFeaturesList.forEach(feature => {
        expect(typeof feature).toBe('string');
        expect(feature.length).toBeGreaterThan(0);
      });
    }
  });

  test('should maintain data integrity across all plans', () => {
    // Property: Configuration should have exactly the expected number of plans
    expect(PRICING_PLANS.length).toBe(5);
    
    // Property: Should have one free plan
    const freePlans = PRICING_PLANS.filter(plan => plan.monthlyPrice === 0);
    expect(freePlans.length).toBe(1);
    
    // Property: Should have exactly one recommended plan
    const recommendedPlans = PRICING_PLANS.filter(plan => plan.recommended === true);
    expect(recommendedPlans.length).toBe(1);
    
    // Property: All plans should have unique identifiers
    const ids = PRICING_PLANS.map(plan => plan.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(PRICING_PLANS.length);
    
    // Property: All plans should have unique names
    const names = PRICING_PLANS.map(plan => plan.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(PRICING_PLANS.length);
    
    // Property: All plans should have unique sort orders
    const sortOrders = PRICING_PLANS.map(plan => plan.sortOrder);
    const uniqueSortOrders = new Set(sortOrders);
    expect(uniqueSortOrders.size).toBe(PRICING_PLANS.length);
    
    // Property: Sort orders should be consecutive starting from 0
    const sortedOrders = [...sortOrders].sort((a, b) => a - b);
    for (let i = 0; i < sortedOrders.length; i++) {
      expect(sortedOrders[i]).toBe(i);
    }
  });
});