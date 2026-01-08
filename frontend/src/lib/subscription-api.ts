/**
 * Subscription API client for tier management and feature checking.
 */

import { apiClient } from './api';

export interface SubscriptionTier {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  price_monthly_cents: number;
  price_yearly_cents: number;
  currency: string;
  sort_order: number;
  is_default: boolean;
  features: Record<string, number>;
  feature_flags: Record<string, boolean>;
}

export interface UserSubscription {
  tier: {
    id: string;
    name: string;
    display_name: string;
  } | null;
  subscription_status: string;
  subscription_started_at: string | null;
  subscription_expires_at: string | null;
  trial_ends_at: string | null;
  features: Record<string, boolean>;
  is_admin: boolean;
}

export interface SelectTierResponse {
  success: boolean;
  tier: string;
  message?: string;
  requires_payment: boolean;
  amount_cents?: number;
  currency?: string;
  billing_cycle?: string;
  plan_code?: string;
}

export const subscriptionApi = {
  // Get all available tiers (public)
  async getTiers(): Promise<SubscriptionTier[]> {
    const { data } = await apiClient.get('/subscriptions/tiers');
    return data;
  },

  // Get a specific tier
  async getTier(tierId: string): Promise<SubscriptionTier> {
    const { data } = await apiClient.get(`/subscriptions/tiers/${tierId}`);
    return data;
  },

  // Get current user's subscription
  async getMySubscription(): Promise<UserSubscription> {
    const { data } = await apiClient.get('/subscriptions/me');
    return data;
  },

  // Get current user's features
  async getMyFeatures(): Promise<Record<string, boolean>> {
    const { data } = await apiClient.get('/subscriptions/features');
    return data;
  },

  // Check if user has a specific feature
  async checkFeature(feature: string): Promise<{ feature: string; has_access: boolean; reason: string }> {
    const { data } = await apiClient.get(`/subscriptions/features/${feature}`);
    return data;
  },

  // Select a tier (for registration or upgrade)
  async selectTier(tierId: string, billingCycle: 'monthly' | 'yearly' = 'monthly'): Promise<SelectTierResponse> {
    const { data } = await apiClient.post('/subscriptions/select-tier', {
      tier_id: tierId,
      billing_cycle: billingCycle,
    });
    return data;
  },

  // Start free trial
  async startTrial(): Promise<{ success: boolean; message: string; trial_ends_at: string }> {
    const { data } = await apiClient.post('/subscriptions/start-trial');
    return data;
  },

  // Cancel subscription
  async cancelSubscription(): Promise<{ success: boolean; message: string }> {
    const { data } = await apiClient.post('/subscriptions/cancel');
    return data;
  },
};

export default subscriptionApi;
