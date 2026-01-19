/**
 * Enhanced Pricing Utility Functions
 * 
 * This file contains comprehensive utility functions for pricing operations,
 * including formatting, calculations, comparisons, and validation.
 * 
 * Requirements: 1.5, 3.4, 3.6
 */

import { SubscriptionTier, SUBSCRIPTION_TIERS, BillingCycle, Currency } from './pricing-config';

/**
 * Enhanced pricing utility functions for formatting and calculations
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
   * Format price with custom options for display
   */
  static formatPriceWithOptions(
    cents: number, 
    currency: Currency = 'ZAR',
    options: {
      showFree?: boolean;
      freeText?: string;
      showContactSales?: boolean;
      contactSalesText?: string;
      showDecimals?: boolean;
    } = {}
  ): string {
    const {
      showFree = true,
      freeText = 'Free',
      showContactSales = true,
      contactSalesText = 'Contact Sales',
      showDecimals = false
    } = options;

    if (cents === 0) return showFree ? freeText : '0';
    if (cents === -1) return showContactSales ? contactSalesText : 'Custom';
    
    const amount = cents / 100;
    const fractionDigits = showDecimals ? 2 : 0;
    
    switch (currency) {
      case 'ZAR':
        return `R${amount.toLocaleString('en-US', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}`;
      case 'USD':
        return `$${amount.toLocaleString('en-US', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}`;
      case 'EUR':
        return `€${amount.toLocaleString('en-US', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}`;
      default:
        return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}`;
    }
  }

  /**
   * Format price with billing cycle suffix
   */
  static formatPriceWithCycle(
    cents: number, 
    cycle: BillingCycle, 
    currency: Currency = 'ZAR',
    options: {
      showFree?: boolean;
      freeText?: string;
      showContactSales?: boolean;
      contactSalesText?: string;
    } = {}
  ): string {
    const basePrice = this.formatPriceWithOptions(cents, currency, options);
    
    if (cents === 0 || cents === -1) return basePrice;
    
    const cycleSuffix = cycle === 'monthly' ? '/mo' : '/yr';
    return `${basePrice}${cycleSuffix}`;
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
   * Calculate yearly savings amount in cents
   */
  static calculateYearlySavingsAmount(monthlyPrice: number, yearlyPrice: number): number {
    if (monthlyPrice === 0 || yearlyPrice === 0 || monthlyPrice === -1 || yearlyPrice === -1) return 0;
    const monthlyTotal = monthlyPrice * 12;
    return monthlyTotal - yearlyPrice;
  }

  /**
   * Get price for specific billing cycle
   */
  static getPriceForCycle(tier: SubscriptionTier, cycle: BillingCycle): number {
    return cycle === 'monthly' ? tier.price_monthly_cents : tier.price_yearly_cents;
  }

  /**
   * Format tier price with billing cycle
   */
  static formatTierPrice(tier: SubscriptionTier, cycle: BillingCycle): string {
    const price = this.getPriceForCycle(tier, cycle);
    return this.formatPriceWithCycle(price, cycle, tier.currency as Currency);
  }

  /**
   * Get tier by ID
   */
  static getTierById(tierId: string): SubscriptionTier | undefined {
    return SUBSCRIPTION_TIERS.find(tier => tier.id === tierId);
  }

  /**
   * Get tier by name
   */
  static getTierByName(tierName: string): SubscriptionTier | undefined {
    return SUBSCRIPTION_TIERS.find(tier => tier.name === tierName);
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
   * Check if tier is free
   */
  static isFree(tier: SubscriptionTier): boolean {
    return tier.price_monthly_cents === 0 && tier.price_yearly_cents === 0;
  }

  /**
   * Get active tiers sorted by sort_order
   */
  static getActiveTiers(): SubscriptionTier[] {
    return SUBSCRIPTION_TIERS
      .filter(tier => tier.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  /**
   * Get tiers for comparison (excluding custom pricing tiers from price comparison)
   */
  static getTiersForComparison(): SubscriptionTier[] {
    return this.getActiveTiers();
  }

  /**
   * Compare two tiers and return comparison result
   */
  static compareTiers(tier1: SubscriptionTier, tier2: SubscriptionTier, cycle: BillingCycle = 'monthly'): {
    tier1: SubscriptionTier;
    tier2: SubscriptionTier;
    tier1Price: number;
    tier2Price: number;
    tier1FormattedPrice: string;
    tier2FormattedPrice: string;
    priceDifference: number;
    priceDifferenceFormatted: string;
    tier1IsMoreExpensive: boolean;
    tier1HasCustomPricing: boolean;
    tier2HasCustomPricing: boolean;
  } {
    const tier1Price = this.getPriceForCycle(tier1, cycle);
    const tier2Price = this.getPriceForCycle(tier2, cycle);
    const tier1HasCustomPricing = this.hasCustomPricing(tier1);
    const tier2HasCustomPricing = this.hasCustomPricing(tier2);
    
    const priceDifference = tier1HasCustomPricing || tier2HasCustomPricing ? 0 : tier1Price - tier2Price;
    
    return {
      tier1,
      tier2,
      tier1Price,
      tier2Price,
      tier1FormattedPrice: this.formatTierPrice(tier1, cycle),
      tier2FormattedPrice: this.formatTierPrice(tier2, cycle),
      priceDifference,
      priceDifferenceFormatted: this.formatPrice(Math.abs(priceDifference), tier1.currency as Currency),
      tier1IsMoreExpensive: !tier1HasCustomPricing && !tier2HasCustomPricing && tier1Price > tier2Price,
      tier1HasCustomPricing,
      tier2HasCustomPricing
    };
  }

  /**
   * Get feature comparison between tiers
   */
  static compareFeatures(tier1: SubscriptionTier, tier2: SubscriptionTier): {
    commonFeatures: Record<string, { tier1Value: number | boolean; tier2Value: number | boolean; same: boolean }>;
    tier1OnlyFeatures: Record<string, number | boolean>;
    tier2OnlyFeatures: Record<string, number | boolean>;
  } {
    const tier1Features = { ...tier1.features, ...tier1.feature_flags };
    const tier2Features = { ...tier2.features, ...tier2.feature_flags };
    
    const allFeatureKeys = new Set([...Object.keys(tier1Features), ...Object.keys(tier2Features)]);
    
    const commonFeatures: Record<string, { tier1Value: number | boolean; tier2Value: number | boolean; same: boolean }> = {};
    const tier1OnlyFeatures: Record<string, number | boolean> = {};
    const tier2OnlyFeatures: Record<string, number | boolean> = {};
    
    for (const key of allFeatureKeys) {
      const tier1Value = tier1Features[key];
      const tier2Value = tier2Features[key];
      
      if (tier1Value !== undefined && tier2Value !== undefined) {
        commonFeatures[key] = {
          tier1Value,
          tier2Value,
          same: tier1Value === tier2Value
        };
      } else if (tier1Value !== undefined) {
        tier1OnlyFeatures[key] = tier1Value;
      } else if (tier2Value !== undefined) {
        tier2OnlyFeatures[key] = tier2Value;
      }
    }
    
    return {
      commonFeatures,
      tier1OnlyFeatures,
      tier2OnlyFeatures
    };
  }

  /**
   * Validate pricing data for a tier
   */
  static validateTier(tier: SubscriptionTier): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Required fields validation
    if (!tier.id) errors.push('Tier ID is required');
    if (!tier.name) errors.push('Tier name is required');
    if (!tier.display_name) errors.push('Tier display name is required');
    if (!tier.currency) errors.push('Currency is required');
    if (tier.sort_order === undefined || tier.sort_order === null) errors.push('Sort order is required');
    
    // Pricing validation
    if (!tier.is_custom_pricing) {
      if (tier.price_monthly_cents < 0 && tier.price_monthly_cents !== -1) {
        errors.push('Monthly price must be non-negative or -1 for custom pricing');
      }
      if (tier.price_yearly_cents < 0 && tier.price_yearly_cents !== -1) {
        errors.push('Yearly price must be non-negative or -1 for custom pricing');
      }
      
      // Check yearly discount makes sense
      if (tier.price_monthly_cents > 0 && tier.price_yearly_cents > 0) {
        const yearlyTotal = tier.price_monthly_cents * 12;
        if (tier.price_yearly_cents >= yearlyTotal) {
          warnings.push('Yearly price should be less than 12x monthly price to provide savings');
        }
      }
    } else {
      // Custom pricing validation
      if (tier.price_monthly_cents !== -1 || tier.price_yearly_cents !== -1) {
        warnings.push('Custom pricing tiers should use -1 for price values');
      }
    }
    
    // Features validation
    if (!tier.features || typeof tier.features !== 'object') {
      errors.push('Features object is required');
    }
    if (!tier.feature_flags || typeof tier.feature_flags !== 'object') {
      errors.push('Feature flags object is required');
    }
    
    // Currency validation
    const validCurrencies: Currency[] = ['ZAR', 'USD', 'EUR'];
    if (!validCurrencies.includes(tier.currency as Currency)) {
      errors.push(`Invalid currency: ${tier.currency}. Must be one of: ${validCurrencies.join(', ')}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate all tiers in the configuration
   */
  static validateAllTiers(): {
    isValid: boolean;
    tierResults: Record<string, { isValid: boolean; errors: string[]; warnings: string[] }>;
    globalErrors: string[];
    globalWarnings: string[];
  } {
    const tierResults: Record<string, { isValid: boolean; errors: string[]; warnings: string[] }> = {};
    const globalErrors: string[] = [];
    const globalWarnings: string[] = [];
    
    // Validate each tier
    for (const tier of SUBSCRIPTION_TIERS) {
      tierResults[tier.id] = this.validateTier(tier);
    }
    
    // Global validations
    const defaultTiers = SUBSCRIPTION_TIERS.filter(tier => tier.is_default);
    if (defaultTiers.length === 0) {
      globalWarnings.push('No default tier found');
    } else if (defaultTiers.length > 1) {
      globalErrors.push('Multiple default tiers found');
    }
    
    // Check for duplicate IDs
    const ids = SUBSCRIPTION_TIERS.map(tier => tier.id);
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      globalErrors.push(`Duplicate tier IDs found: ${duplicateIds.join(', ')}`);
    }
    
    // Check for duplicate sort orders
    const sortOrders = SUBSCRIPTION_TIERS.map(tier => tier.sort_order);
    const duplicateSortOrders = sortOrders.filter((order, index) => sortOrders.indexOf(order) !== index);
    if (duplicateSortOrders.length > 0) {
      globalWarnings.push(`Duplicate sort orders found: ${duplicateSortOrders.join(', ')}`);
    }
    
    const allTiersValid = Object.values(tierResults).every(result => result.isValid);
    const hasGlobalErrors = globalErrors.length > 0;
    
    return {
      isValid: allTiersValid && !hasGlobalErrors,
      tierResults,
      globalErrors,
      globalWarnings
    };
  }

  /**
   * Get "Contact Sales" display logic for custom pricing tiers
   */
  static getContactSalesInfo(tier: SubscriptionTier): {
    shouldShowContactSales: boolean;
    contactSalesText: string;
    contactSalesSubtext?: string;
    contactMethod: 'email' | 'phone' | 'form';
    contactValue: string;
  } {
    const shouldShowContactSales = this.hasCustomPricing(tier);
    
    if (!shouldShowContactSales) {
      return {
        shouldShowContactSales: false,
        contactSalesText: '',
        contactMethod: 'email',
        contactValue: ''
      };
    }
    
    return {
      shouldShowContactSales: true,
      contactSalesText: 'Contact Sales',
      contactSalesSubtext: 'Custom pricing based on your needs',
      contactMethod: 'email',
      contactValue: 'sales@bizpilot.co.za'
    };
  }

  /**
   * Get tier upgrade/downgrade information
   */
  static getTierChangeInfo(fromTier: SubscriptionTier, toTier: SubscriptionTier, cycle: BillingCycle = 'monthly'): {
    isUpgrade: boolean;
    isDowngrade: boolean;
    isSameTier: boolean;
    requiresContactSales: boolean;
    priceDifference: number;
    priceDifferenceFormatted: string;
    changeType: 'upgrade' | 'downgrade' | 'same' | 'custom';
  } {
    const fromPrice = this.getPriceForCycle(fromTier, cycle);
    const toPrice = this.getPriceForCycle(toTier, cycle);
    const fromHasCustomPricing = this.hasCustomPricing(fromTier);
    const toHasCustomPricing = this.hasCustomPricing(toTier);
    
    const requiresContactSales = fromHasCustomPricing || toHasCustomPricing;
    const isSameTier = fromTier.id === toTier.id;
    
    let changeType: 'upgrade' | 'downgrade' | 'same' | 'custom';
    let isUpgrade = false;
    let isDowngrade = false;
    
    if (isSameTier) {
      changeType = 'same';
    } else if (requiresContactSales) {
      changeType = 'custom';
    } else if (toTier.sort_order > fromTier.sort_order) {
      changeType = 'upgrade';
      isUpgrade = true;
    } else {
      changeType = 'downgrade';
      isDowngrade = true;
    }
    
    const priceDifference = requiresContactSales ? 0 : toPrice - fromPrice;
    
    return {
      isUpgrade,
      isDowngrade,
      isSameTier,
      requiresContactSales,
      priceDifference,
      priceDifferenceFormatted: this.formatPrice(Math.abs(priceDifference), fromTier.currency as Currency),
      changeType
    };
  }

  /**
   * Get recommended tier based on usage or requirements
   */
  static getRecommendedTier(requirements: {
    maxUsers?: number;
    maxOrdersPerMonth?: number;
    maxTerminals?: number;
    requiredFeatures?: string[];
    budget?: number; // in cents
    billingCycle?: BillingCycle;
  }): {
    recommendedTier: SubscriptionTier | null;
    reasons: string[];
    alternatives: SubscriptionTier[];
  } {
    const {
      maxUsers = 1,
      maxOrdersPerMonth = 0,
      maxTerminals = 1,
      requiredFeatures = [],
      budget,
      billingCycle = 'monthly'
    } = requirements;
    
    const reasons: string[] = [];
    const alternatives: SubscriptionTier[] = [];
    
    // Filter tiers that meet requirements
    const suitableTiers = this.getActiveTiers().filter(tier => {
      // Skip custom pricing tiers for automatic recommendation
      if (this.hasCustomPricing(tier)) {
        alternatives.push(tier);
        return false;
      }
      
      // Check user limits
      if (tier.features.max_users !== -1 && tier.features.max_users < maxUsers) {
        return false;
      }
      
      // Check order limits
      if (tier.features.max_orders_per_month !== -1 && tier.features.max_orders_per_month < maxOrdersPerMonth) {
        return false;
      }
      
      // Check terminal limits
      if (tier.features.max_terminals !== -1 && tier.features.max_terminals < maxTerminals) {
        return false;
      }
      
      // Check required features
      for (const feature of requiredFeatures) {
        if (tier.feature_flags[feature] === false) {
          return false;
        }
      }
      
      // Check budget if provided
      if (budget !== undefined) {
        const tierPrice = this.getPriceForCycle(tier, billingCycle);
        if (tierPrice > budget) {
          return false;
        }
      }
      
      return true;
    });
    
    if (suitableTiers.length === 0) {
      return {
        recommendedTier: null,
        reasons: ['No tiers meet the specified requirements'],
        alternatives
      };
    }
    
    // Recommend the most cost-effective suitable tier
    const recommendedTier = suitableTiers.reduce((best, current) => {
      const bestPrice = this.getPriceForCycle(best, billingCycle);
      const currentPrice = this.getPriceForCycle(current, billingCycle);
      return currentPrice < bestPrice ? current : best;
    });
    
    // Generate reasons
    if (maxUsers > 1) reasons.push(`Supports ${maxUsers} users`);
    if (maxOrdersPerMonth > 0) reasons.push(`Handles ${maxOrdersPerMonth} orders per month`);
    if (maxTerminals > 1) reasons.push(`Supports ${maxTerminals} terminals`);
    if (requiredFeatures.length > 0) reasons.push(`Includes required features: ${requiredFeatures.join(', ')}`);
    if (budget !== undefined) reasons.push(`Within budget of ${this.formatPrice(budget)}`);
    
    return {
      recommendedTier,
      reasons,
      alternatives: [...suitableTiers.filter(t => t.id !== recommendedTier.id), ...alternatives]
    };
  }
}

// Export utility functions for convenience
export const {
  formatPrice,
  formatPriceWithOptions,
  formatPriceWithCycle,
  calculateYearlySavings,
  calculateYearlySavingsAmount,
  getPriceForCycle,
  formatTierPrice,
  getTierById,
  getTierByName,
  getDefaultTier,
  hasCustomPricing,
  isFree,
  getActiveTiers,
  getTiersForComparison,
  compareTiers,
  compareFeatures,
  validateTier,
  validateAllTiers,
  getContactSalesInfo,
  getTierChangeInfo,
  getRecommendedTier
} = PricingUtils;

// Export default utilities object
export default PricingUtils;