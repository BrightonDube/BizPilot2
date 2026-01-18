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
    description: 'Complete business management system with smart features for small businesses getting started',
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: 'ZAR',
    sortOrder: 1,
    features: [
      'Complete POS system with payment processing',
      'Inventory management with smart tracking',
      'Customer management and loyalty programs',
      'Mobile POS application',
      'Real-time stock monitoring',
      'Smart analytics and reporting dashboard',
      'Automated alerts and notifications',
      'Email support'
    ],
    limitations: [
      'Up to 100 products',
      'Single location',
      'Basic AI insights only',
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
    description: 'Advanced business management with intelligent automation and multi-location capabilities for growing businesses',
    monthlyPrice: 49900, // R499 in cents
    yearlyPrice: 479000, // R4,790 in cents (20% discount)
    currency: 'ZAR',
    sortOrder: 2,
    recommended: true,
    features: [
      'Everything in Starter',
      'Multi-location management',
      'Advanced analytics and reporting suite',
      'Automated reordering and smart suggestions',
      'Intelligent pricing optimization tools',
      'Customer segmentation and insights',
      'Sales forecasting and trend analysis',
      'Accounting system integrations (Xero, Sage)',
      'Advanced inventory management',
      'Priority support and training',
      'API access for custom integrations'
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
    description: 'Complete enterprise business management with custom features and advanced automation for large organizations',
    monthlyPrice: 149900, // R1,499 in cents
    yearlyPrice: 1439000, // R14,390 in cents (20% discount)
    currency: 'ZAR',
    sortOrder: 3,
    features: [
      'Everything in Professional',
      'Unlimited locations and products',
      'Custom business process automation',
      'Advanced predictive analytics and BI',
      'Enterprise-grade security and compliance',
      'Custom integrations and API access',
      'White-label and branding options',
      'Dedicated account manager',
      'Custom training and onboarding',
      'Advanced workflow automation',
      'Custom reporting and dashboards',
      '24/7 priority support',
      'Data migration assistance',
      'Custom feature development'
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
        return `R${amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
      case 'USD':
        return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
      case 'EUR':
        return `€${amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
      default:
        return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
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
   * Convert plan features to benefit format for UI with AI emphasis
   */
  static convertFeaturesToBenefits(plan: PricingPlan): FeatureBenefit[] {
    const benefits: FeatureBenefit[] = [];
    
    // Add included features with smart feature emphasis
    plan.features.forEach(feature => {
      const isSmartFeature = this.isAIPoweredFeature(feature);
      benefits.push({
        text: isSmartFeature ? `✨ ${feature}` : feature,
        checked: true,
        aiPowered: isSmartFeature,
        description: isSmartFeature ? 'Smart feature' : undefined
      });
    });
    
    // Add smart feature count for plans with automation
    const smartFeatureCount = this.getAIFeaturesCount(plan);
    if (smartFeatureCount > 3) {
      benefits.push({
        text: `🤖 ${smartFeatureCount} smart automation features included`,
        checked: true,
        aiPowered: true,
        description: 'Intelligent automation capabilities'
      });
    }
    
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
    const aiKeywords = ['smart', 'intelligent', 'automated', 'analytics', 'optimization', 'forecasting', 'segmentation'];
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
    category: "Core Business Management",
    features: [
      {
        name: "POS System & Payment Processing",
        starter: true,
        professional: true,
        enterprise: true
      },
      {
        name: "Inventory Management",
        starter: "Basic",
        professional: "Advanced",
        enterprise: "Enterprise"
      },
      {
        name: "Customer Management & CRM",
        starter: true,
        professional: true,
        enterprise: true
      },
      {
        name: "Reporting & Analytics",
        starter: "Basic",
        professional: "Advanced",
        enterprise: "Custom"
      }
    ]
  },
  {
    category: "Smart Features & Automation",
    features: [
      {
        name: "Smart Analytics & Insights",
        starter: true,
        professional: true,
        enterprise: true,
        aiPowered: true
      },
      {
        name: "Automated Reordering Suggestions",
        starter: false,
        professional: true,
        enterprise: true,
        aiPowered: true
      },
      {
        name: "Intelligent Pricing Tools",
        starter: false,
        professional: true,
        enterprise: true,
        aiPowered: true
      },
      {
        name: "Predictive Analytics",
        starter: false,
        professional: "Standard",
        enterprise: "Advanced",
        aiPowered: true
      }
    ]
  },
  {
    category: "Business Scale & Integration",
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
        name: "Accounting Integrations",
        starter: false,
        professional: "Xero, Sage",
        enterprise: "Custom"
      },
      {
        name: "API Access",
        starter: false,
        professional: "Standard",
        enterprise: "Advanced"
      }
    ]
  },
  {
    category: "Support & Services",
    features: [
      {
        name: "Support Level",
        starter: "Email",
        professional: "Priority",
        enterprise: "24/7 Dedicated"
      },
      {
        name: "Training & Onboarding",
        starter: "Self-service",
        professional: "Guided",
        enterprise: "Custom"
      },
      {
        name: "Custom Development",
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