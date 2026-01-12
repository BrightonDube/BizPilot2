/**
 * Admin API client for user and subscription management.
 */

import { apiClient } from './api';

// Types
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
  is_active: boolean;
  features: Record<string, number>;
  feature_flags: Record<string, boolean>;
}

export type UserStatus = 'active' | 'inactive' | 'pending' | 'suspended';
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'expired' | 'trial' | 'none';

export interface BusinessSummary {
  id: string;
  name: string;
  slug: string;
}

export interface UserBusiness {
  business: BusinessSummary;
  status: string;
  is_primary: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_email_verified: boolean;
  status: UserStatus;
  is_admin: boolean;
  subscription_status: SubscriptionStatus | null;
  current_tier_id: string | null;
  current_tier: SubscriptionTier | null;
  subscription_started_at: string | null;
  subscription_expires_at: string | null;
  trial_ends_at: string | null;
  feature_overrides: Record<string, boolean> | null;
  businesses?: UserBusiness[];
  created_at: string;
  updated_at: string;
}

export interface UserListResponse {
  users: AdminUser[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface AdminStats {
  total_users: number;
  active_users: number;
  subscribed_users: number;
  trial_users: number;
  revenue_this_month_cents: number;
  users_by_tier: Record<string, number>;
  users_by_status: Record<string, number>;
}

export interface UserUpdateData {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  status?: UserStatus;
  is_admin?: boolean;
}

export interface SubscriptionUpdateData {
  subscription_status?: SubscriptionStatus;
  current_tier_id?: string | null;
  subscription_expires_at?: string | null;
  trial_ends_at?: string | null;
}

// API Functions
export const adminApi = {
  // User Management
  async listUsers(params?: {
    page?: number;
    per_page?: number;
    search?: string;
    status?: UserStatus;
    subscription_status?: SubscriptionStatus;
    tier_id?: string;
  }): Promise<UserListResponse> {
    const { data } = await apiClient.get('/admin/users', { params });
    return data;
  },

  async getUser(userId: string): Promise<AdminUser> {
    const { data } = await apiClient.get(`/admin/users/${userId}`);
    return data;
  },

  async updateUser(userId: string, userData: UserUpdateData): Promise<AdminUser> {
    const { data } = await apiClient.patch(`/admin/users/${userId}`, userData);
    return data;
  },

  async deleteUser(userId: string): Promise<void> {
    await apiClient.delete(`/admin/users/${userId}`);
  },

  async blockUser(userId: string): Promise<void> {
    await apiClient.post(`/admin/users/${userId}/block`);
  },

  async unblockUser(userId: string): Promise<void> {
    await apiClient.post(`/admin/users/${userId}/unblock`);
  },

  // Subscription Management
  async updateSubscription(userId: string, data: SubscriptionUpdateData): Promise<AdminUser> {
    const { data: user } = await apiClient.patch(`/admin/users/${userId}/subscription`, data);
    return user;
  },

  async pauseSubscription(userId: string): Promise<void> {
    await apiClient.post(`/admin/users/${userId}/pause-subscription`);
  },

  async unpauseSubscription(userId: string): Promise<void> {
    await apiClient.post(`/admin/users/${userId}/unpause-subscription`);
  },

  // Feature Overrides
  async updateFeatureOverrides(userId: string, overrides: Record<string, boolean>): Promise<AdminUser> {
    const { data } = await apiClient.patch(`/admin/users/${userId}/feature-overrides`, {
      feature_overrides: overrides,
    });
    return data;
  },

  async removeFeatureOverride(userId: string, feature: string): Promise<void> {
    await apiClient.delete(`/admin/users/${userId}/feature-overrides/${feature}`);
  },

  // Tier Management
  async listTiers(includeInactive = false): Promise<SubscriptionTier[]> {
    const { data } = await apiClient.get('/admin/tiers', {
      params: { include_inactive: includeInactive },
    });
    return data;
  },

  async createTier(tierData: Partial<SubscriptionTier>): Promise<SubscriptionTier> {
    const { data } = await apiClient.post('/admin/tiers', tierData);
    return data;
  },

  async updateTier(tierId: string, tierData: Partial<SubscriptionTier>): Promise<SubscriptionTier> {
    const { data } = await apiClient.patch(`/admin/tiers/${tierId}`, tierData);
    return data;
  },

  async deleteTier(tierId: string): Promise<void> {
    await apiClient.delete(`/admin/tiers/${tierId}`);
  },

  async seedDefaultTiers(): Promise<{ message: string }> {
    const { data } = await apiClient.post('/admin/tiers/seed');
    return data;
  },

  // Stats
  async getStats(): Promise<AdminStats> {
    const { data } = await apiClient.get('/admin/stats');
    return data;
  },

  // Transactions
  async listTransactions(params?: {
    page?: number;
    per_page?: number;
    user_id?: string;
    status?: string;
  }) {
    const { data } = await apiClient.get('/admin/transactions', { params });
    return data;
  },
};

export default adminApi;
