/**
 * Shared Pricing Configuration
 * 
 * This file contains the unified pricing configuration that serves as the single
 * source of truth for both frontend (TypeScript) and backend (Python) systems.
 * 
 * Requirements: 1.4, 3.1, 3.2
 */

// Core subscription tier interface matching backend model
export interface SubscriptionTier {
  id: string;
  name: string;
  display_name: string;
  description: string;
  price_monthly_cents: number;
  price_yearly_cents: number;
  currency: string;
  sort_order: number;
  is_default: boolean;
  is_active: boolean;
  is_custom_pricing: boolean; // New field for Enterprise tier
  features: Record<string, number>;
  feature_flags: Record<string, boolean>;
  paystack_plan_code_monthly?: string;
  paystack_plan_code_yearly?: string;
}

/**
 * Unified subscription tiers configuration
 * Matches backend DEFAULT_TIERS exactly with addition of Enterprise tier
 */
export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: "pilot_solo",
    name: "pilot_solo", 
    display_name: "Pilot Solo",
    description: "Free starter tier for getting started with BizPilot",
    price_monthly_cents: 0,
    price_yearly_cents: 0,
    currency: "ZAR",
    sort_order: 0,
    is_default: true,
    is_active: true,
    is_custom_pricing: false,
    features: {
      max_users: 1,
      max_orders_per_month: 50,
      max_terminals: 1
    },
    feature_flags: {
      basic_reports: false,
      inventory_tracking: false,
      cost_calculations: false,
      email_support: true,
      export_reports: false,
      ai_insights: false,
      custom_categories: false,
      priority_support: false,
      multi_location: false,
      api_access: false,
      team_collaboration: false
    }
  },
  {
    id: "pilot_lite",
    name: "pilot_lite",
    display_name: "Pilot Lite", 
    description: "Coffee stalls and trucks: cash/card tracking with basic sales reports",
    price_monthly_cents: 19900, // R199
    price_yearly_cents: 191040, // 20% discount
    currency: "ZAR",
    sort_order: 1,
    is_default: false,
    is_active: true,
    is_custom_pricing: false,
    features: {
      max_users: 3,
      max_orders_per_month: -1,
      max_terminals: 1
    },
    feature_flags: {
      basic_reports: true,
      inventory_tracking: false,
      cost_calculations: false,
      email_support: true,
      export_reports: false,
      ai_insights: false,
      custom_categories: false,
      priority_support: false,
      multi_location: false,
      api_access: false,
      team_collaboration: true
    }
  },
  {
    id: "pilot_core",
    name: "pilot_core",
    display_name: "Pilot Core",
    description: "Standard restaurants: inventory tracking with ingredient tracking and recipes",
    price_monthly_cents: 79900, // R799
    price_yearly_cents: 767040, // 20% discount
    currency: "ZAR",
    sort_order: 2,
    is_default: false,
    is_active: true,
    is_custom_pricing: false,
    features: {
      max_users: -1,
      max_orders_per_month: -1,
      max_terminals: 2
    },
    feature_flags: {
      basic_reports: true,
      inventory_tracking: true,
      cost_calculations: true,
      email_support: true,
      export_reports: true,
      ai_insights: false,
      custom_categories: true,
      priority_support: false,
      multi_location: false,
      api_access: false,
      team_collaboration: true
    }
  },
  {
    id: "pilot_pro",
    name: "pilot_pro",
    display_name: "Pilot Pro",
    description: "High volume: full AI suite and automation",
    price_monthly_cents: 149900, // R1499
    price_yearly_cents: 1439040, // 20% discount
    currency: "ZAR",
    sort_order: 3,
    is_default: false,
    is_active: true,
    is_custom_pricing: false,
    features: {
      max_users: -1,
      max_orders_per_month: -1,
      max_terminals: -1
    },
    feature_flags: {
      basic_reports: true,
      inventory_tracking: true,
      cost_calculations: true,
      email_support: true,
      export_reports: true,
      ai_insights: true,
      custom_categories: true,
      priority_support: true,
      multi_location: true,
      api_access: true,
      team_collaboration: true
    }
  },
  {
    id: "enterprise",
    name: "enterprise",
    display_name: "Enterprise",
    description: "Custom enterprise solution with tailored features and dedicated support",
    price_monthly_cents: -1, // Custom pricing indicator
    price_yearly_cents: -1, // Custom pricing indicator
    currency: "ZAR",
    sort_order: 4,
    is_default: false,
    is_active: true,
    is_custom_pricing: true,
    features: {
      max_users: -1, // Unlimited
      max_orders_per_month: -1, // Unlimited
      max_terminals: -1, // Unlimited
      max_locations: -1, // Unlimited
      custom_integrations: -1, // Unlimited
      dedicated_support: 1 // Included
    },
    feature_flags: {
      basic_reports: true,
      inventory_tracking: true,
      cost_calculations: true,
      email_support: true,
      export_reports: true,
      ai_insights: true,
      custom_categories: true,
      priority_support: true,
      multi_location: true,
      api_access: true,
      team_collaboration: true,
      white_labeling: true,
      custom_development: true,
      dedicated_account_manager: true,
      sla_guarantee: true,
      advanced_security: true,
      custom_workflows: true
    }
  }
];

// Billing cycle options
export type BillingCycle = 'monthly' | 'yearly';

// Currency options
export type Currency = 'ZAR' | 'USD' | 'EUR';

/**
 * Pricing utility functions for formatting and calculations
 */
export class PricingUtils {
  /**
   * Format price in cents to display string
   */
  static formatPrice(cents: number, currency: Currency = 'ZAR'): string {
    if (cents === 0) return 'Free';
    if (cents === -1) return 'Contact Sales'; // Custom pricing
    
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
    if (monthlyPrice === 0 || yearlyPrice === 0 || monthlyPrice === -1 || yearlyPrice === -1) return 0;
    const monthlyTotal = monthlyPrice * 12;
    return Math.round(((monthlyTotal - yearlyPrice) / monthlyTotal) * 100);
  }

  /**
   * Get price for specific billing cycle
   */
  static getPriceForCycle(tier: SubscriptionTier, cycle: BillingCycle): number {
    return cycle === 'monthly' ? tier.price_monthly_cents : tier.price_yearly_cents;
  }

  /**
   * Format price with billing cycle
   */
  static formatPriceWithCycle(tier: SubscriptionTier, cycle: BillingCycle): string {
    const price = this.getPriceForCycle(tier, cycle);
    const formattedPrice = this.formatPrice(price, tier.currency as Currency);
    
    if (price === 0 || price === -1) return formattedPrice;
    
    const cycleSuffix = cycle === 'monthly' ? '/mo' : '/yr';
    return `${formattedPrice}${cycleSuffix}`;
  }

  /**
   * Get tier by ID
   */
  static getTierById(tierId: string): SubscriptionTier | undefined {
    return SUBSCRIPTION_TIERS.find(tier => tier.id === tierId);
  }

  /**
   * Get default tier
   */
  static getDefaultTier(): SubscriptionTier | undefined {
    return SUBSCRIPTION_TIERS.find(tier => tier.is_default);
  }

  /**
   * Check if tier has custom pricing
   */
  static hasCustomPricing(tier: SubscriptionTier): boolean {
    return tier.is_custom_pricing || tier.price_monthly_cents === -1;
  }

  /**
   * Get active tiers sorted by sort_order
   */
  static getActiveTiers(): SubscriptionTier[] {
    return SUBSCRIPTION_TIERS
      .filter(tier => tier.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);
  }
}

// Export default configuration object
export const PRICING_CONFIG = {
  tiers: SUBSCRIPTION_TIERS,
  utils: PricingUtils
} as const;

export default PRICING_CONFIG;