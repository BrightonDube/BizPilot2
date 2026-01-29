/**
 * usePermissions hook for checking feature access based on subscription.
 * 
 * This hook fetches permission data from the backend and provides helpers
 * to check feature access and demo status.
 * 
 * Caching Strategy:
 * - Data is cached in memory with a 5-minute staleTime (matches backend cache TTL)
 * - Automatically refetches on window focus
 * - Can be manually refreshed via refetch()
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

export interface Permissions {
  granted_features: string[];
  tier: string;
  status: string;
  demo_expires_at: string | null;
  device_limit: number;
}

interface UsePermissionsReturn {
  permissions: Permissions | null;
  isLoading: boolean;
  error: string | null;
  hasFeature: (featureName: string) => boolean;
  isDemo: () => boolean;
  refetch: () => Promise<void>;
}

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes (matches backend cache)

// In-memory cache
let cachedPermissions: Permissions | null = null;
let cacheTimestamp: number = 0;

/**
 * Check if cached data is still valid
 */
function isCacheValid(): boolean {
  return cachedPermissions !== null && Date.now() - cacheTimestamp < CACHE_DURATION;
}

/**
 * Clear the permissions cache (useful for testing)
 * @internal
 */
export function clearPermissionsCache(): void {
  cachedPermissions = null;
  cacheTimestamp = 0;
}

/**
 * Hook to access current user's permissions and feature access.
 * 
 * Features:
 * - Fetches from /api/permissions/me
 * - Caches data for 5 minutes (matches backend cache TTL)
 * - Provides hasFeature() helper for feature checks
 * - Provides isDemo() helper for demo status
 * - Automatically refetches on window focus
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { hasFeature, isDemo, isLoading } = usePermissions();
 *   
 *   if (isLoading) return <div>Loading...</div>;
 *   
 *   if (!hasFeature('payroll')) {
 *     return <UpgradePrompt feature="payroll" />;
 *   }
 *   
 *   return <PayrollDashboard />;
 * }
 * ```
 */
export function usePermissions(): UsePermissionsReturn {
  const [permissions, setPermissions] = useState<Permissions | null>(cachedPermissions);
  const [isLoading, setIsLoading] = useState<boolean>(!isCacheValid());
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch permissions from the backend
   */
  const fetchPermissions = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);

      const response = await apiClient.get<Permissions>('/permissions/me');
      const data = response.data;

      // Update cache
      cachedPermissions = data;
      cacheTimestamp = Date.now();
      
      setPermissions(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load permissions';
      setError(errorMessage);
      console.error('Failed to fetch permissions:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Check if a specific feature is granted
   */
  const hasFeature = useCallback((featureName: string): boolean => {
    if (!permissions) return false;
    return permissions.granted_features.includes(featureName);
  }, [permissions]);

  /**
   * Check if the current subscription is in demo mode
   */
  const isDemo = useCallback((): boolean => {
    if (!permissions) return false;
    return permissions.status === 'demo' && permissions.demo_expires_at !== null;
  }, [permissions]);

  /**
   * Manually refetch permissions (bypasses cache)
   */
  const refetch = useCallback(async () => {
    // Invalidate cache
    cachedPermissions = null;
    cacheTimestamp = 0;
    await fetchPermissions();
  }, [fetchPermissions]);

  // Initial fetch on mount (uses cache if valid)
  useEffect(() => {
    if (isCacheValid()) {
      // Use cached data
      setPermissions(cachedPermissions);
      setIsLoading(false);
    } else {
      // Fetch fresh data
      void fetchPermissions();
    }
  }, [fetchPermissions]);

  // Refetch on window focus (if cache is stale)
  useEffect(() => {
    const handleFocus = () => {
      if (!isCacheValid()) {
        void fetchPermissions();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchPermissions]);

  return {
    permissions,
    isLoading,
    error,
    hasFeature,
    isDemo,
    refetch,
  };
}

export default usePermissions;
