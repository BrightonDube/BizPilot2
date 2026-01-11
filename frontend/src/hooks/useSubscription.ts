/**
 * Subscription hook for checking tier limits and feature access.
 */

import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';

// Define feature flags and limits per tier
export const TIER_FEATURES = {
  free: {
    max_products: 50,
    max_customers: 100,
    max_orders_per_month: 100,
    max_invoices_per_month: 50,
    ai_assistant: false,
    reports: false,
    production: false,
    multi_user: false,
    api_access: false,
    priority_support: false,
  },
  starter: {
    max_products: 500,
    max_customers: 1000,
    max_orders_per_month: 1000,
    max_invoices_per_month: 500,
    ai_assistant: true,
    reports: true,
    production: false,
    multi_user: false,
    api_access: false,
    priority_support: false,
  },
  professional: {
    max_products: -1, // unlimited
    max_customers: -1,
    max_orders_per_month: -1,
    max_invoices_per_month: -1,
    ai_assistant: true,
    reports: true,
    production: true,
    multi_user: true,
    api_access: true,
    priority_support: false,
  },
  enterprise: {
    max_products: -1,
    max_customers: -1,
    max_orders_per_month: -1,
    max_invoices_per_month: -1,
    ai_assistant: true,
    reports: true,
    production: true,
    multi_user: true,
    api_access: true,
    priority_support: true,
  },
} as const;

export type TierName = keyof typeof TIER_FEATURES;
export type FeatureFlag = keyof typeof TIER_FEATURES.free;

// Map routes to required features
export const ROUTE_FEATURES: Record<string, FeatureFlag> = {
  '/ai': 'ai_assistant',
  '/reports': 'reports',
  '/production': 'production',
};

export function useSubscription() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  // Get the current tier name, default to 'free'
  const tierName = useMemo<TierName>(() => {
    const name = user?.current_tier_name?.toLowerCase() as TierName | undefined;
    if (name && name in TIER_FEATURES) {
      return name;
    }
    return 'free';
  }, [user?.current_tier_name]);

  // Get features for current tier
  const features = useMemo(() => {
    return TIER_FEATURES[tierName] || TIER_FEATURES.free;
  }, [tierName]);

  // Check if a feature is enabled
  const hasFeature = useCallback((feature: FeatureFlag): boolean => {
    // Superadmins have access to everything
    if (user?.is_superadmin) return true;
    
    const value = features[feature];
    if (typeof value === 'boolean') {
      return value;
    }
    // For numeric limits, -1 means unlimited
    return value === -1 || value > 0;
  }, [features, user?.is_superadmin]);

  // Get the limit for a feature
  const getLimit = useCallback((feature: FeatureFlag): number => {
    // Superadmins have unlimited access
    if (user?.is_superadmin) return -1;
    
    const value = features[feature];
    if (typeof value === 'number') {
      return value;
    }
    return value ? -1 : 0;
  }, [features, user?.is_superadmin]);

  // Check if current route is accessible
  const canAccessRoute = useCallback((pathname: string): boolean => {
    // Superadmins can access everything
    if (user?.is_superadmin) return true;
    
    // Check if route requires a specific feature
    for (const [route, feature] of Object.entries(ROUTE_FEATURES)) {
      if (pathname.startsWith(route)) {
        return hasFeature(feature);
      }
    }
    return true;
  }, [hasFeature, user?.is_superadmin]);

  // Redirect to upgrade page if feature not available
  const requireFeature = useCallback((feature: FeatureFlag, redirectTo = '/settings?tab=billing') => {
    if (!hasFeature(feature)) {
      router.push(redirectTo);
      return false;
    }
    return true;
  }, [hasFeature, router]);

  return {
    tierName,
    features,
    hasFeature,
    getLimit,
    canAccessRoute,
    requireFeature,
    isSubscribed: user?.subscription_status === 'active' || user?.subscription_status === 'trial',
    subscriptionStatus: user?.subscription_status,
    isTrial: user?.subscription_status === 'trial',
    isSuperadmin: user?.is_superadmin || false,
  };
}

export default useSubscription;
