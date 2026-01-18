/**
 * Centralized Pricing Configuration
 * 
 * This file contains all pricing data, plan definitions, and AI feature configurations
 * for BizPilot's marketing pages. It serves as the single source of truth for
 * consistent pricing information across all marketing displays.
 * 
 * Requirements: 3.1, 3.4
 */

// Core pricing plan interface
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

// Billing cycle options
export type BillingCycle = 'monthly' | 'yearly';

// Currency options
export type Currency = 'ZAR' | 'USD' | 'EUR';

// Plan tier names for type safety
export type PlanTier = 'starter' | 'professional' | 'enterprise';

/**
 * Complete pricing plans configuration
 * Includes all plan details, AI capabilities, and feature limitations
 */
export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'starter',
    displayName: 'Starter',
    description: 'Perfect for small businesses getting started with AI-powered management',
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: 'ZAR',
    sortOrder: 1,
    features: [
      'AI-powered inventory tracking',
      'Smart sales analytics',
      'Basic customer management',
      'Mobile POS application',
      'Real-time stock monitoring',
      'Basic reporting dashboard',
      'Email support'
    ],
    limitations: [
      'Up to 100 products',
      'Single location',
      'Basic AI insights',
      'Limited integrations',
      'Standard support only'
    ],
    aiFeatures: {
      smartAnalytics: true,
      predictiveInsights: false,
      automatedReordering: false,
      intelligentPricing: false,
      aiPoweredInventoryTracking: true,
      smartCustomerSegmentation: false,
      predictiveStockAlerts: true,
      intelligentCostOptimization: false,
      aiDrivenSalesForecasting: false,
      automatedSupplierRecommendations: false
    }
  },
  {
    id: 'professional',
    name: 'professional',
    displayName: 'Professional',
    description: 'Advanced AI capabilities for growing businesses that need intelligent automation',
    monthlyPrice: 49900, // R499 in cents
    yearlyPrice: 479040, // R4,790.40 in cents (20% discount)
    currency: 'ZAR',
    sortOrder: 2,
    recommended: true,
    features: [
      'Everything in Starter',
      'Advanced AI-powered analytics',
      'Predictive inventory insights',
      'Automated reordering suggestions',
      'Intelligent pricing optimization',
      'Smart customer segmentation',
      'Multi-location management',
      'Advanced reporting suite',
      'Priority support',
      'API access'
    ],
    limitations: [
      'Up to 10,000 products',
      'Up to 5 locations',
      'Standard integrations'
    ],
    aiFeatures: {
      smartAnalytics: true,
      predictiveInsights: true,
      automatedReordering: true,
      intelligentPricing: true,
      aiPoweredInventoryTracking: true,
      smartCustomerSegmentation: true,
      predictiveStockAlerts: true,
      intelligentCostOptimization: true,
      aiDrivenSalesForecasting: true,
      automatedSupplierRecommendations: true
    }
  },
  {
    id: 'enterprise',
    name: 'enterprise',
    displayName: 'Enterprise',
    description: 'Complete AI-powered business management for large organizations with custom needs',
    monthlyPrice: 149900, // R1,499 in cents
    yearlyPrice: 1439040, // R14,390.40 in cents (20% discount)
    currency: 'ZAR',
    sortOrder: 3,
    features: [
      'Everything in Professional',
      'Custom AI model training',
      'Advanced predictive analytics',
      'Automated workflow optimization',
      'Enterprise-grade security',
      'Unlimited locations',
      'Unlimited products',
      'Custom integrations',
      'Dedicated account manager',
      'White-label options',
      'Advanced API access',
      'Custom reporting',
      '24/7 priority support'
    ],
    limitations: [
      'Custom pricing for 50+ locations'
    ],
    aiFeatures: {
      smartAnalytics: true,
      predictiveInsights: true,
      automatedReordering: true,
      intelligentPricing: true,
      aiPoweredInventoryTracking: true,
      smartCustomerSegmentation: true,
      predictiveStockAlerts: true,
      intelligentCostOptimization: true,
      aiDrivenSalesForecasting: true,
      automatedSupplierRecommendations: true
    }
  }
];

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
  heroTagline: "AI-Powered Business Management That Puts You in Control",
  keyBenefits: [
    "Intelligent inventory tracking that learns your business patterns",
    "Predictive analytics that help you make smarter decisions",
    "Automated processes that save time while keeping you in control",
    "Smart insights that grow your business profitability",
    "AI-driven recommendations you can trust and customize"
  ],
  privacyMessage: "Your data stays private and secure. Our AI works for you, not against you.",
  controlMessage: "You're always in control. Our AI provides recommendations - you make the decisions.",
  automationBenefits: [
    "Reduce manual inventory counting by 80%",
    "Predict stock needs 2-4 weeks in advance",
    "Optimize pricing for maximum profitability",
    "Identify top customers automatically",
    "Streamline supplier relationships"
  ]
};

/**
 * Utility functions for pricing calculations and formatting
 */
export class PricingUtils {
  /**
   * Format price in cents to display string
   */
  static formatPrice(cents: number, currency: Currency = 'ZAR'): string {
    if (cents === 0) return 'Free';
    
    const amount = cents / 100;
    
    switch (currency) {
      case 'ZAR':
        return `R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 0 })}`;
      case 'USD':
        return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
      case 'EUR':
        return `€${amount.toLocaleString('en-EU', { minimumFractionDigits: 0 })}`;
      default:
        return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
    }
  }

  /**
   * Calculate yearly savings percentage
   */
  static calculateYearlySavings(monthlyPrice: number, yearlyPrice: number): number {
    if (monthlyPrice === 0 || yearlyPrice === 0) return 0;
    const monthlyTotal = monthlyPrice * 12;
    return Math.round(((monthlyTotal - yearlyPrice) / monthlyTotal) * 100);
  }

  /**
   * Get price for specific billing cycle
   */
  static getPriceForCycle(plan: PricingPlan, cycle: BillingCycle): number {
    return cycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
  }

  /**
   * Format price with billing cycle
   */
  static formatPriceWithCycle(plan: PricingPlan, cycle: BillingCycle): string {
    const price = this.getPriceForCycle(plan, cycle);
    const formattedPrice = this.formatPrice(price, plan.currency as Currency);
    
    if (price === 0) return formattedPrice;
    
    const cycleSuffix = cycle === 'monthly' ? '/mo' : '/yr';
    return `${formattedPrice}${cycleSuffix}`;
  }

  /**
   * Get plan by ID
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
   * Convert plan features to benefit format for UI
   */
  static convertFeaturesToBenefits(plan: PricingPlan): FeatureBenefit[] {
    const benefits: FeatureBenefit[] = [];
    
    // Add included features
    plan.features.forEach(feature => {
      benefits.push({
        text: feature,
        checked: true,
        aiPowered: this.isAIPoweredFeature(feature)
      });
    });
    
    // Add limitations as unchecked benefits
    plan.limitations.forEach(limitation => {
      benefits.push({
        text: limitation,
        checked: false
      });
    });
    
    return benefits;
  }

  /**
   * Check if a feature is AI-powered based on keywords
   */
  private static isAIPoweredFeature(feature: string): boolean {
    const aiKeywords = ['ai', 'smart', 'intelligent', 'predictive', 'automated', 'analytics'];
    return aiKeywords.some(keyword => 
      feature.toLowerCase().includes(keyword)
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
 */
export interface FeatureComparison {
  category: string;
  features: {
    name: string;
    starter: boolean | string;
    professional: boolean | string;
    enterprise: boolean | string;
    aiPowered?: boolean;
  }[];
}

export const FEATURE_COMPARISON: FeatureComparison[] = [
  {
    category: "AI-Powered Analytics",
    features: [
      {
        name: "Smart Sales Analytics",
        starter: true,
        professional: true,
        enterprise: true,
        aiPowered: true
      },
      {
        name: "Predictive Insights",
        starter: false,
        professional: true,
        enterprise: true,
        aiPowered: true
      },
      {
        name: "Custom AI Models",
        starter: false,
        professional: false,
        enterprise: true,
        aiPowered: true
      }
    ]
  },
  {
    category: "Inventory Management",
    features: [
      {
        name: "AI-Powered Tracking",
        starter: true,
        professional: true,
        enterprise: true,
        aiPowered: true
      },
      {
        name: "Automated Reordering",
        starter: false,
        professional: true,
        enterprise: true,
        aiPowered: true
      },
      {
        name: "Predictive Stock Alerts",
        starter: "Basic",
        professional: "Advanced",
        enterprise: "Custom",
        aiPowered: true
      }
    ]
  },
  {
    category: "Business Scale",
    features: [
      {
        name: "Products",
        starter: "Up to 100",
        professional: "Up to 10,000",
        enterprise: "Unlimited"
      },
      {
        name: "Locations",
        starter: "1",
        professional: "Up to 5",
        enterprise: "Unlimited"
      },
      {
        name: "Users",
        starter: "Up to 3",
        professional: "Up to 25",
        enterprise: "Unlimited"
      }
    ]
  },
  {
    category: "Support & Integration",
    features: [
      {
        name: "Support Level",
        starter: "Email",
        professional: "Priority",
        enterprise: "24/7 Dedicated"
      },
      {
        name: "API Access",
        starter: false,
        professional: "Standard",
        enterprise: "Advanced"
      },
      {
        name: "Custom Integrations",
        starter: false,
        professional: false,
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