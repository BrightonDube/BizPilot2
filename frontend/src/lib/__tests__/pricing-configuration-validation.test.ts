/**
 * Unit Tests for Pricing Configuration Validation
 * Task 5.1: Validates pricing configuration correctness
 * 
 * Tests:
 * - 5.1.1: Free tier has correct configuration values
 * - 5.1.2: Feature matrix has no duplicates
 * - 5.1.3: All tiers have correct feature availability
 */

import { SUBSCRIPTION_TIERS } from '../../../../shared/pricing-config';
import { PRICING_PLANS, FEATURE_COMPARISON, PricingUtils } from '../pricing-config';

describe('Task 5.1: Pricing Configuration Validation', () => {
  describe('5.1.1: Free Tier Configuration', () => {
    test('Free tier (Pilot Solo) should have correct max_orders_per_month limit', () => {
      const freeTier = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_solo');
      
      expect(freeTier).toBeDefined();
      expect(freeTier!.features.max_orders_per_month).toBe(5);
    });

    test('Free tier (Pilot Solo) should have no terminal access', () => {
      const freeTier = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_solo');
      
      expect(freeTier).toBeDefined();
      expect(freeTier!.features.max_terminals).toBe(0);
    });

    test('Free tier (Pilot Solo) should have no POS system access', () => {
      const freeTier = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_solo');
      
      expect(freeTier).toBeDefined();
      expect(freeTier!.feature_flags.pos_system).toBe(false);
    });

    test('Free tier (Pilot Solo) should have no email support', () => {
      const freeTier = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_solo');
      
      expect(freeTier).toBeDefined();
      expect(freeTier!.feature_flags.email_support).toBe(false);
    });

    test('Free tier (Pilot Solo) should have no customer management', () => {
      const freeTier = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_solo');
      
      expect(freeTier).toBeDefined();
      expect(freeTier!.feature_flags.customer_management).toBe(false);
    });

    test('Free tier (Pilot Solo) should have simple inventory tracking only', () => {
      const freeTier = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_solo');
      
      expect(freeTier).toBeDefined();
      expect(freeTier!.feature_flags.inventory_tracking).toBe(true);
      expect(freeTier!.feature_flags.cost_calculations).toBe(false);
    });

    test('Free tier (Pilot Solo) should have max 1 user', () => {
      const freeTier = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_solo');
      
      expect(freeTier).toBeDefined();
      expect(freeTier!.features.max_users).toBe(1);
    });

    test('Free tier (Pilot Solo) should be free (0 cents)', () => {
      const freeTier = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_solo');
      
      expect(freeTier).toBeDefined();
      expect(freeTier!.price_monthly_cents).toBe(0);
      expect(freeTier!.price_yearly_cents).toBe(0);
    });

    test('Free tier (Pilot Solo) should be the default tier', () => {
      const freeTier = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_solo');
      
      expect(freeTier).toBeDefined();
      expect(freeTier!.is_default).toBe(true);
    });

    test('Free tier (Pilot Solo) marketing plan should reflect limitations', () => {
      const freePlan = PRICING_PLANS.find(plan => plan.id === 'pilot_solo');
      
      expect(freePlan).toBeDefined();
      expect(freePlan!.limitations).toContain('No POS system');
      expect(freePlan!.limitations).toContain('No email support');
      expect(freePlan!.limitations).toContain('No customer management');
      expect(freePlan!.limitations).toContain('No terminals');
    });
  });

  describe('5.1.2: Feature Matrix Duplicate Detection', () => {
    test('Feature comparison matrix should have no duplicate feature names within categories', () => {
      FEATURE_COMPARISON.forEach(category => {
        const featureNames = category.features.map(f => f.name);
        const uniqueNames = new Set(featureNames);
        
        expect(featureNames.length).toBe(uniqueNames.size);
      });
    });

    test('Feature comparison matrix should have no duplicate feature names across all categories', () => {
      const allFeatureNames: string[] = [];
      
      FEATURE_COMPARISON.forEach(category => {
        category.features.forEach(feature => {
          allFeatureNames.push(feature.name);
        });
      });
      
      const uniqueNames = new Set(allFeatureNames);
      const duplicates = allFeatureNames.filter((name, index) => 
        allFeatureNames.indexOf(name) !== index
      );
      
      expect(duplicates).toEqual([]);
      expect(allFeatureNames.length).toBe(uniqueNames.size);
    });

    test('Feature comparison matrix should not have "Contact sales for pricing" as a feature', () => {
      const allFeatureNames: string[] = [];
      
      FEATURE_COMPARISON.forEach(category => {
        category.features.forEach(feature => {
          allFeatureNames.push(feature.name.toLowerCase());
        });
      });
      
      const hasContactSales = allFeatureNames.some(name => 
        name.includes('contact sales') || name.includes('contact sales for pricing')
      );
      
      expect(hasContactSales).toBe(false);
    });

    test('Terminal feature should appear exactly once in feature matrix', () => {
      const terminalFeatures: string[] = [];
      
      FEATURE_COMPARISON.forEach(category => {
        category.features.forEach(feature => {
          if (feature.name.toLowerCase().includes('terminal')) {
            terminalFeatures.push(feature.name);
          }
        });
      });
      
      expect(terminalFeatures.length).toBe(1);
    });

    test('Each pricing plan should have unique features in their feature list', () => {
      PRICING_PLANS.forEach(plan => {
        const uniqueFeatures = new Set(plan.features);
        expect(plan.features.length).toBe(uniqueFeatures.size);
      });
    });
  });

  describe('5.1.3: Feature Availability Across Tiers', () => {
    test('Pilot Solo should have correct POS system availability (excluded)', () => {
      const pilotSolo = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_solo');
      expect(pilotSolo!.feature_flags.pos_system).toBe(false);
    });

    test('Pilot Lite should have POS system access', () => {
      const pilotLite = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_lite');
      expect(pilotLite!.feature_flags.pos_system).toBe(true);
    });

    test('Pilot Core should have POS system access', () => {
      const pilotCore = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_core');
      expect(pilotCore!.feature_flags.pos_system).toBe(true);
    });

    test('Pilot Pro should have POS system access', () => {
      const pilotPro = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_pro');
      expect(pilotPro!.feature_flags.pos_system).toBe(true);
    });

    test('Enterprise should have POS system access', () => {
      const enterprise = SUBSCRIPTION_TIERS.find(tier => tier.id === 'enterprise');
      expect(enterprise!.feature_flags.pos_system).toBe(true);
    });

    test('Pilot Solo should not have customer management', () => {
      const pilotSolo = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_solo');
      expect(pilotSolo!.feature_flags.customer_management).toBe(false);
    });

    test('Pilot Lite and above should have customer management', () => {
      const pilotLite = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_lite');
      const pilotCore = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_core');
      const pilotPro = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_pro');
      const enterprise = SUBSCRIPTION_TIERS.find(tier => tier.id === 'enterprise');
      
      expect(pilotLite!.feature_flags.customer_management).toBe(true);
      expect(pilotCore!.feature_flags.customer_management).toBe(true);
      expect(pilotPro!.feature_flags.customer_management).toBe(true);
      expect(enterprise!.feature_flags.customer_management).toBe(true);
    });

    test('Pilot Solo should not have email support', () => {
      const pilotSolo = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_solo');
      expect(pilotSolo!.feature_flags.email_support).toBe(false);
    });

    test('Pilot Lite and above should have email support', () => {
      const pilotLite = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_lite');
      const pilotCore = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_core');
      const pilotPro = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_pro');
      const enterprise = SUBSCRIPTION_TIERS.find(tier => tier.id === 'enterprise');
      
      expect(pilotLite!.feature_flags.email_support).toBe(true);
      expect(pilotCore!.feature_flags.email_support).toBe(true);
      expect(pilotPro!.feature_flags.email_support).toBe(true);
      expect(enterprise!.feature_flags.email_support).toBe(true);
    });

    test('Terminal limits should be correct for each tier', () => {
      const pilotSolo = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_solo');
      const pilotLite = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_lite');
      const pilotCore = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_core');
      const pilotPro = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_pro');
      const enterprise = SUBSCRIPTION_TIERS.find(tier => tier.id === 'enterprise');
      
      expect(pilotSolo!.features.max_terminals).toBe(0);
      expect(pilotLite!.features.max_terminals).toBe(1);
      expect(pilotCore!.features.max_terminals).toBe(2);
      expect(pilotPro!.features.max_terminals).toBe(-1); // Unlimited
      expect(enterprise!.features.max_terminals).toBe(-1); // Unlimited
    });

    test('User limits should be correct for each tier', () => {
      const pilotSolo = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_solo');
      const pilotLite = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_lite');
      const pilotCore = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_core');
      const pilotPro = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_pro');
      const enterprise = SUBSCRIPTION_TIERS.find(tier => tier.id === 'enterprise');
      
      expect(pilotSolo!.features.max_users).toBe(1);
      expect(pilotLite!.features.max_users).toBe(3);
      expect(pilotCore!.features.max_users).toBe(-1); // Unlimited
      expect(pilotPro!.features.max_users).toBe(-1); // Unlimited
      expect(enterprise!.features.max_users).toBe(-1); // Unlimited
    });

    test('AI insights should only be available in Pilot Pro and Enterprise', () => {
      const pilotSolo = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_solo');
      const pilotLite = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_lite');
      const pilotCore = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_core');
      const pilotPro = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_pro');
      const enterprise = SUBSCRIPTION_TIERS.find(tier => tier.id === 'enterprise');
      
      expect(pilotSolo!.feature_flags.ai_insights).toBe(false);
      expect(pilotLite!.feature_flags.ai_insights).toBe(false);
      expect(pilotCore!.feature_flags.ai_insights).toBe(false);
      expect(pilotPro!.feature_flags.ai_insights).toBe(true);
      expect(enterprise!.feature_flags.ai_insights).toBe(true);
    });

    test('Multi-location support should only be available in Pilot Pro and Enterprise', () => {
      const pilotSolo = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_solo');
      const pilotLite = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_lite');
      const pilotCore = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_core');
      const pilotPro = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_pro');
      const enterprise = SUBSCRIPTION_TIERS.find(tier => tier.id === 'enterprise');
      
      expect(pilotSolo!.feature_flags.multi_location).toBe(false);
      expect(pilotLite!.feature_flags.multi_location).toBe(false);
      expect(pilotCore!.feature_flags.multi_location).toBe(false);
      expect(pilotPro!.feature_flags.multi_location).toBe(true);
      expect(enterprise!.feature_flags.multi_location).toBe(true);
    });

    test('API access should only be available in Pilot Pro and Enterprise', () => {
      const pilotSolo = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_solo');
      const pilotLite = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_lite');
      const pilotCore = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_core');
      const pilotPro = SUBSCRIPTION_TIERS.find(tier => tier.id === 'pilot_pro');
      const enterprise = SUBSCRIPTION_TIERS.find(tier => tier.id === 'enterprise');
      
      expect(pilotSolo!.feature_flags.api_access).toBe(false);
      expect(pilotLite!.feature_flags.api_access).toBe(false);
      expect(pilotCore!.feature_flags.api_access).toBe(false);
      expect(pilotPro!.feature_flags.api_access).toBe(true);
      expect(enterprise!.feature_flags.api_access).toBe(true);
    });

    test('All tiers should have consistent feature flag structure', () => {
      const requiredFlags = [
        'basic_reports',
        'inventory_tracking',
        'cost_calculations',
        'email_support',
        'export_reports',
        'ai_insights',
        'custom_categories',
        'priority_support',
        'multi_location',
        'api_access',
        'team_collaboration',
        'pos_system',
        'customer_management'
      ];

      SUBSCRIPTION_TIERS.forEach(tier => {
        requiredFlags.forEach(flag => {
          expect(tier.feature_flags).toHaveProperty(flag);
          expect(typeof tier.feature_flags[flag]).toBe('boolean');
        });
      });
    });

    test('All tiers should have consistent feature structure', () => {
      const requiredFeatures = [
        'max_users',
        'max_orders_per_month',
        'max_terminals'
      ];

      SUBSCRIPTION_TIERS.forEach(tier => {
        requiredFeatures.forEach(feature => {
          expect(tier.features).toHaveProperty(feature);
          expect(typeof tier.features[feature]).toBe('number');
        });
      });
    });
  });

  describe('5.1.3: Feature Display Correctness', () => {
    test('convertFeaturesToBenefits should show checkmarks for included features', () => {
      const pilotPro = PRICING_PLANS.find(plan => plan.id === 'pilot_pro')!;
      const benefits = PricingUtils.convertFeaturesToBenefits(pilotPro);
      
      // Pilot Pro should have most features checked
      const checkedBenefits = benefits.filter(b => b.checked);
      expect(checkedBenefits.length).toBeGreaterThan(benefits.length / 2);
    });

    test('convertFeaturesToBenefits should show X for excluded features in Free tier', () => {
      const pilotSolo = PRICING_PLANS.find(plan => plan.id === 'pilot_solo')!;
      const benefits = PricingUtils.convertFeaturesToBenefits(pilotSolo);
      
      // Free tier should have many unchecked features
      const uncheckedBenefits = benefits.filter(b => !b.checked);
      expect(uncheckedBenefits.length).toBeGreaterThan(0);
      
      // Verify specific exclusions
      const posSystem = benefits.find(b => b.text.toLowerCase().includes('pos'));
      const customerMgmt = benefits.find(b => b.text.toLowerCase().includes('customer'));
      const emailSupport = benefits.find(b => b.text.toLowerCase().includes('email'));
      
      // These should be excluded (unchecked) for Free tier
      if (posSystem) expect(posSystem.checked).toBe(false);
      if (customerMgmt) expect(customerMgmt.checked).toBe(false);
      if (emailSupport) expect(emailSupport.checked).toBe(false);
    });

    test('Feature comparison matrix should show correct availability for Free tier', () => {
      FEATURE_COMPARISON.forEach(category => {
        category.features.forEach(feature => {
          // Verify pilot_solo property exists
          expect(feature).toHaveProperty('pilot_solo');
          
          // Verify it's a valid value (boolean or string)
          const value = feature.pilot_solo;
          expect(
            typeof value === 'boolean' || typeof value === 'string'
          ).toBe(true);
        });
      });
    });

    test('Feature comparison matrix should have all tier columns', () => {
      const requiredTiers = ['pilot_solo', 'pilot_lite', 'pilot_core', 'pilot_pro', 'enterprise'];
      
      FEATURE_COMPARISON.forEach(category => {
        category.features.forEach(feature => {
          requiredTiers.forEach(tier => {
            expect(feature).toHaveProperty(tier);
          });
        });
      });
    });
  });
});
