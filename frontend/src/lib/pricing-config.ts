/**
 * Frontend Pricing Configuration
 * 
 * This file imports the shared pricing configuration and provides additional
 * marketing-specific interfaces and utilities for the frontend.
 * 
 * Requirements: 1.1, 3.1, 3.4
 */

// Import shared pricing configuration
import { 
  SUBSCRIPTION_TIERS, 
  PricingUtils as SharedPricingUtils,
  SubscriptionTier,
  BillingCycle,
  Currency
} from '../../../shared/pricing-config';

// Re-export shared types for frontend use
export type { SubscriptionTier, BillingCycle, Currency };

// Legacy interface for backward compatibility with existing marketing components
export interface PricingPlan {
  id: string;
  name: string;
  displayName: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  features: string[];
  limitations: string[];
  recommended?: boolean;
  aiFeatures: AIFeatures;
  sortOrder: number;
  isCustomPricing?: boolean;
}

// AI-specific features and capabilities
export interface AIFeatures {
  smartAnalytics: boolean;
  predictiveInsights: boolean;
  automatedReordering: boolean;
  intelligentPricing: boolean;
  aiPoweredInventoryTracking: boolean;
  smartCustomerSegmentation: boolean;
  predictiveStockAlerts: boolean;
  intelligentCostOptimization: boolean;
  aiDrivenSalesForecasting: boolean;
  automatedSupplierRecommendations: boolean;
}

// Feature benefit interface for marketing display
export interface FeatureBenefit {
  text: string;
  checked: boolean;
  aiPowered?: boolean;
  description?: string;
}

// Plan tier names for type safety - updated to match backend
export type PlanTier = 'pilot_solo' | 'pilot_lite' | 'pilot_core' | 'pilot_pro' | 'enterprise';

/**
 * Convert shared subscription tiers to marketing-friendly pricing plans
 * This provides backward compatibility with existing marketing components
 */
function convertTierToPlan(tier: SubscriptionTier): PricingPlan {
  // Map feature flags to AI features for marketing display
  const aiFeatures: AIFeatures = {
    smartAnalytics: tier.feature_flags.basic_reports || false,
    predictiveInsights: tier.feature_flags.ai_insights || false,
    automatedReordering: tier.feature_flags.ai_insights || false,
    intelligentPricing: tier.feature_flags.ai_insights || false,
    aiPoweredInventoryTracking: tier.feature_flags.inventory_tracking || false,
    smartCustomerSegmentation: tier.feature_flags.ai_insights || false,
    predictiveStockAlerts: tier.feature_flags.inventory_tracking || false,
    intelligentCostOptimization: tier.feature_flags.cost_calculations || false,
    aiDrivenSalesForecasting: tier.feature_flags.ai_insights || false,
    automatedSupplierRecommendations: tier.feature_flags.ai_insights || false
  };

  // Generate marketing-friendly features list
  const features: string[] = [];
  const limitations: string[] = [];

  // Add core features based on tier capabilities
  if (tier.id === 'pilot_solo') {
    features.push(
      'Simple inventory tracking',
      'Up to 1 user',
      'Up to 5 orders per month'
    );
    limitations.push(
      'No POS system',
      'No email support',
      'No customer management',
      'No terminals',
      'No advanced reports'
    );
  } else if (tier.id === 'pilot_lite') {
    features.push(
      'Complete POS system',
      'Cash/card tracking',
      'Basic sales reports',
      'Customer management',
      'Team collaboration',
      'Email support',
      'Up to 3 users',
      'Up to 1 terminal'
    );
    limitations.push(
      'No inventory tracking',
      'No cost calculations',
      'No export reports',
      'No AI insights',
      'No multi-location'
    );
  } else if (tier.id === 'pilot_core') {
    features.push(
      'Everything in Pilot Lite',
      'Advanced inventory tracking',
      'Ingredient tracking and recipes',
      'Cost calculations',
      'Export reports',
      'Custom categories',
      'Unlimited users',
      'Up to 2 terminals'
    );
    limitations.push(
      'No AI insights',
      'No priority support',
      'No multi-location',
      'No API access'
    );
  } else if (tier.id === 'pilot_pro') {
    features.push(
      'Everything in Pilot Core',
      'Full AI suite and automation',
      'Multi-location support',
      'API access',
      'Priority support',
      'Unlimited terminals',
      'Unlimited users',
      'Advanced analytics'
    );
    limitations.push(
      'Standard integrations'
    );
  } else if (tier.id === 'enterprise') {
    features.push(
      'Everything in Pilot Pro',
      'Custom enterprise features',
      'White-label options',
      'Custom development',
      'Dedicated account manager',
      'SLA guarantees',
      'Advanced security',
      'Custom workflows',
      'Unlimited everything'
    );
    // No limitations for enterprise
  }

  return {
    id: tier.id,
    name: tier.name,
    displayName: tier.display_name,
    description: tier.description,
    monthlyPrice: tier.price_monthly_cents,
    yearlyPrice: tier.price_yearly_cents,
    currency: tier.currency,
    features,
    limitations,
    recommended: tier.id === 'pilot_core', // Make Pilot Core the recommended tier
    aiFeatures,
    sortOrder: tier.sort_order,
    isCustomPricing: tier.is_custom_pricing
  };
}

/**
 * Complete pricing plans configuration - converted from shared subscription tiers
 * Includes all plan details, AI capabilities, and feature limitations
 */
export const PRICING_PLANS: PricingPlan[] = SUBSCRIPTION_TIERS.map(convertTierToPlan);

/**
 * AI messaging configuration for marketing content
 */
export interface AIMessaging {
  heroTagline: string;
  keyBenefits: string[];
  privacyMessage: string;
  controlMessage: string;
  automationBenefits: string[];
}

export const AI_MESSAGING: AIMessaging = {
  heroTagline: "Complete Business Management with Smart Features That Enhance Your Operations",
  keyBenefits: [
    "Comprehensive POS and ERP system for complete business control",
    "Smart inventory tracking that learns your business patterns",
    "Advanced analytics and reporting for better decision making",
    "Automated processes that save time while keeping you in control",
    "Intelligent insights that help grow your business profitability"
  ],
  privacyMessage: "Your business data stays private and secure. Smart features work with full transparency and your consent.",
  controlMessage: "You're always in control. Smart features provide helpful suggestions - you make the final decisions.",
  automationBenefits: [
    "Streamline inventory management and reduce manual counting",
    "Get smart suggestions for reordering and pricing",
    "Automate routine reporting and administrative tasks",
    "Optimize business processes with intelligent insights",
    "Enhance customer management with smart segmentation"
  ]
};

/**
 * Utility functions for pricing calculations and formatting
 * Uses shared utilities and adds marketing-specific functionality
 */
export class PricingUtils {
  /**
   * Format price in cents to display string (delegated to shared utils)
   */
  static formatPrice(cents: number, currency: Currency = 'ZAR'): string {
    return SharedPricingUtils.formatPrice(cents, currency);
  }

  /**
   * Calculate yearly savings percentage (delegated to shared utils)
   */
  static calculateYearlySavings(monthlyPrice: number, yearlyPrice: number): number {
    return SharedPricingUtils.calculateYearlySavings(monthlyPrice, yearlyPrice);
  }

  /**
   * Get plan by ID (legacy compatibility)
   */
  static getPlanById(planId: string): PricingPlan | undefined {
    return PRICING_PLANS.find(plan => plan.id === planId);
  }

  /**
   * Get recommended plan
   */
  static getRecommendedPlan(): PricingPlan | undefined {
    return PRICING_PLANS.find(plan => plan.recommended);
  }

  /**
   * Get price for specific billing cycle
   */
  static getPriceForCycle(plan: PricingPlan, cycle: BillingCycle): number {
    return cycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
  }

  /**
   * Format price with cycle - handles custom pricing
   */
  static formatPriceWithCycle(plan: PricingPlan, cycle: BillingCycle): string {
    if (plan.isCustomPricing) {
      return 'Contact Sales';
    }
    
    const price = this.getPriceForCycle(plan, cycle);
    const formattedPrice = this.formatPrice(price, plan.currency as Currency);
    
    if (price === 0) return formattedPrice;
    
    const cycleSuffix = cycle === 'monthly' ? '/mo' : '/yr';
    return `${formattedPrice}${cycleSuffix}`;
  }

  /**
   * Convert plan features to benefit format for UI with AI emphasis
   */
  static convertFeaturesToBenefits(plan: PricingPlan): FeatureBenefit[] {
    // Define ALL possible features across all tiers
    const allFeatures = [
      { key: 'pos_system', label: 'POS System', tier: 'pilot_lite' },
      { key: 'inventory_tracking', label: 'Inventory Tracking', tier: 'pilot_solo' },
      { key: 'customer_management', label: 'Customer Management', tier: 'pilot_lite' },
      { key: 'basic_reports', label: 'Basic Reports', tier: 'pilot_lite' },
      { key: 'email_support', label: 'Email Support', tier: 'pilot_lite' },
      { key: 'team_collaboration', label: 'Team Collaboration', tier: 'pilot_lite' },
      { key: 'cost_calculations', label: 'Cost Calculations', tier: 'pilot_core' },
      { key: 'export_reports', label: 'Export Reports', tier: 'pilot_core' },
      { key: 'custom_categories', label: 'Custom Categories', tier: 'pilot_core' },
      { key: 'ai_insights', label: 'AI Insights & Automation', tier: 'pilot_pro' },
      { key: 'priority_support', label: 'Priority Support', tier: 'pilot_pro' },
      { key: 'multi_location', label: 'Multi-Location Support', tier: 'pilot_pro' },
      { key: 'api_access', label: 'API Access', tier: 'pilot_pro' },
      { key: 'white_labeling', label: 'White-Label Options', tier: 'enterprise' },
      { key: 'custom_development', label: 'Custom Development', tier: 'enterprise' },
      { key: 'dedicated_account_manager', label: 'Dedicated Account Manager', tier: 'enterprise' },
      { key: 'sla_guarantee', label: 'SLA Guarantees', tier: 'enterprise' },
      { key: 'advanced_security', label: 'Advanced Security', tier: 'enterprise' },
      { key: 'custom_workflows', label: 'Custom Workflows', tier: 'enterprise' }
    ];

    // Add user/terminal limits
    const benefits: FeatureBenefit[] = [];
    
    // Add user limit
    const maxUsers = plan.id === 'pilot_solo' ? '1 user' : 
                     plan.id === 'pilot_lite' ? 'Up to 3 users' : 
                     'Unlimited users';
    benefits.push({ text: maxUsers, checked: true });

    // Add order limit for free tier
    if (plan.id === 'pilot_solo') {
      benefits.push({ text: 'Up to 5 orders per month', checked: true });
    } else {
      benefits.push({ text: 'Unlimited orders', checked: true });
    }

    // Add terminal limit
    const maxTerminals = plan.id === 'pilot_solo' ? 'No terminals' :
                        plan.id === 'pilot_lite' ? '1 terminal' :
                        plan.id === 'pilot_core' ? 'Up to 2 terminals' :
                        'Unlimited terminals';
    benefits.push({ 
      text: maxTerminals, 
      checked: plan.id !== 'pilot_solo' 
    });

    // Add all features with checkmarks for included, X for excluded
    allFeatures.forEach(feature => {
      const tierOrder = ['pilot_solo', 'pilot_lite', 'pilot_core', 'pilot_pro', 'enterprise'];
      const featureTierIndex = tierOrder.indexOf(feature.tier);
      const currentTierIndex = tierOrder.indexOf(plan.id);
      
      // Feature is included if current tier is >= feature tier
      const isIncluded = currentTierIndex >= featureTierIndex;
      
      // Special handling for inventory tracking (pilot_solo has simple version)
      if (feature.key === 'inventory_tracking') {
        if (plan.id === 'pilot_solo') {
          benefits.push({ text: 'Simple inventory tracking', checked: true });
        } else if (plan.id === 'pilot_lite') {
          benefits.push({ text: feature.label, checked: false });
        } else {
          benefits.push({ text: 'Advanced ' + feature.label.toLowerCase(), checked: true });
        }
      } else {
        benefits.push({
          text: feature.label,
          checked: isIncluded,
          aiPowered: feature.key === 'ai_insights'
        });
      }
    });

    return benefits;
  }

  /**
   * Check if a feature is AI-powered based on keywords
   */
  private static isAIPoweredFeature(feature: string): boolean {
    const aiKeywords = ['smart', 'intelligent', 'automated', 'analytics', 'optimization', 'forecasting', 'segmentation', 'AI'];
    return aiKeywords.some(keyword => 
      feature.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  /**
   * Get AI features count for a plan
   */
  static getAIFeaturesCount(plan: PricingPlan): number {
    return Object.values(plan.aiFeatures).filter(Boolean).length;
  }

  /**
   * Get enabled AI features list
   */
  static getEnabledAIFeatures(plan: PricingPlan): string[] {
    return Object.entries(plan.aiFeatures)
      .filter(([, enabled]) => enabled)
      .map(([feature]) => this.formatFeatureName(feature));
  }

  /**
   * Format camelCase feature names to readable text
   */
  private static formatFeatureName(featureName: string): string {
    return featureName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }
}

/**
 * Feature comparison matrix for detailed plan comparisons
 * Updated to match the new 5-tier structure
 */
export interface FeatureComparison {
  category: string;
  features: {
    name: string;
    pilot_solo: boolean | string;
    pilot_lite: boolean | string;
    pilot_core: boolean | string;
    pilot_pro: boolean | string;
    enterprise: boolean | string;
    aiPowered?: boolean;
  }[];
}

export const FEATURE_COMPARISON: FeatureComparison[] = [
  {
    category: "Core Business Management",
    features: [
      {
        name: "POS System & Payment Processing",
        pilot_solo: "Basic",
        pilot_lite: true,
        pilot_core: true,
        pilot_pro: true,
        enterprise: true
      },
      {
        name: "Inventory Management",
        pilot_solo: "Basic",
        pilot_lite: "Basic",
        pilot_core: "Advanced",
        pilot_pro: "Advanced",
        enterprise: "Enterprise"
      },
      {
        name: "Customer Management & CRM",
        pilot_solo: true,
        pilot_lite: true,
        pilot_core: true,
        pilot_pro: true,
        enterprise: true
      },
      {
        name: "Reporting & Analytics",
        pilot_solo: false,
        pilot_lite: "Basic",
        pilot_core: "Advanced",
        pilot_pro: "Advanced",
        enterprise: "Custom"
      }
    ]
  },
  {
    category: "Smart Features & Automation",
    features: [
      {
        name: "Smart Analytics & Insights",
        pilot_solo: false,
        pilot_lite: true,
        pilot_core: true,
        pilot_pro: true,
        enterprise: true,
        aiPowered: true
      },
      {
        name: "Automated Reordering Suggestions",
        pilot_solo: false,
        pilot_lite: false,
        pilot_core: false,
        pilot_pro: true,
        enterprise: true,
        aiPowered: true
      },
      {
        name: "Intelligent Pricing Tools",
        pilot_solo: false,
        pilot_lite: false,
        pilot_core: false,
        pilot_pro: true,
        enterprise: true,
        aiPowered: true
      },
      {
        name: "Predictive Analytics",
        pilot_solo: false,
        pilot_lite: false,
        pilot_core: false,
        pilot_pro: "Standard",
        enterprise: "Advanced",
        aiPowered: true
      }
    ]
  },
  {
    category: "Business Scale & Integration",
    features: [
      {
        name: "Users",
        pilot_solo: "1",
        pilot_lite: "Up to 3",
        pilot_core: "Unlimited",
        pilot_pro: "Unlimited",
        enterprise: "Unlimited"
      },
      {
        name: "Terminals",
        pilot_solo: "1",
        pilot_lite: "1",
        pilot_core: "Up to 2",
        pilot_pro: "Unlimited",
        enterprise: "Unlimited"
      },
      {
        name: "Locations",
        pilot_solo: "1",
        pilot_lite: "1",
        pilot_core: "1",
        pilot_pro: "Multiple",
        enterprise: "Unlimited"
      },
      {
        name: "API Access",
        pilot_solo: false,
        pilot_lite: false,
        pilot_core: false,
        pilot_pro: "Standard",
        enterprise: "Advanced"
      }
    ]
  },
  {
    category: "Support & Services",
    features: [
      {
        name: "Support Level",
        pilot_solo: "Email",
        pilot_lite: "Email",
        pilot_core: "Email",
        pilot_pro: "Priority",
        enterprise: "24/7 Dedicated"
      },
      {
        name: "Training & Onboarding",
        pilot_solo: "Self-service",
        pilot_lite: "Self-service",
        pilot_core: "Self-service",
        pilot_pro: "Guided",
        enterprise: "Custom"
      },
      {
        name: "Custom Development",
        pilot_solo: false,
        pilot_lite: false,
        pilot_core: false,
        pilot_pro: false,
        enterprise: true
      }
    ]
  }
];

// Export default configuration object
export const PRICING_CONFIG = {
  plans: PRICING_PLANS,
  messaging: AI_MESSAGING,
  comparison: FEATURE_COMPARISON,
  utils: PricingUtils
} as const;

export default PRICING_CONFIG;