/**
 * useDashboardMetrics — fetches KPI dashboard data for the mobile dashboard.
 *
 * Why a custom hook?
 * Dashboard data is fetched from the API and cached in memory + AsyncStorage.
 * Separating fetch logic from the screen component lets us:
 * 1. Test the hook independently with mock data
 * 2. Reuse the hook across different dashboard widgets
 * 3. Keep the screen component clean and readable
 *
 * Offline-first:
 * If offline, returns the last cached metrics from AsyncStorage.
 * Stale data is shown with a visual indicator so staff know it may be outdated.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiClient } from "@/services/api/client";

// How long before cached data is considered stale (5 minutes)
const CACHE_TTL_MS = 5 * 60 * 1_000;

const CACHE_KEY = "dashboard_metrics_cache";

export interface KpiMetric {
  id: string;
  label: string;
  value: number;
  unit: "currency" | "count" | "percent";
  trend?: "up" | "down" | "flat";
  trendPercent?: number;
}

export interface DashboardMetrics {
  businessId: string;
  period: "today" | "week" | "month";
  fetchedAt: number;
  salesTotal: number;
  ordersCount: number;
  avgOrderValue: number;
  topProducts: Array<{ name: string; revenue: number; units: number }>;
  lowStockCount: number;
  kpis: KpiMetric[];
}

interface UseDashboardMetricsState {
  metrics: DashboardMetrics | null;
  isLoading: boolean;
  isStale: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetch dashboard KPI metrics, with offline cache fallback.
 *
 * @param businessId - The current business ID
 * @param period - The time period to aggregate over
 */
export function useDashboardMetrics(
  businessId: string,
  period: "today" | "week" | "month" = "today"
): UseDashboardMetricsState {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track whether the component is still mounted to avoid state updates on unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadCached = useCallback(async (): Promise<DashboardMetrics | null> => {
    try {
      const raw = await AsyncStorage.getItem(`${CACHE_KEY}_${businessId}_${period}`);
      if (!raw) return null;
      const cached = JSON.parse(raw) as DashboardMetrics;
      return cached;
    } catch {
      return null;
    }
  }, [businessId, period]);

  const saveCache = useCallback(
    async (data: DashboardMetrics) => {
      try {
        await AsyncStorage.setItem(
          `${CACHE_KEY}_${businessId}_${period}`,
          JSON.stringify(data)
        );
      } catch (err) {
        console.warn("[Dashboard] Failed to save cache:", err);
      }
    },
    [businessId, period]
  );

  const fetchMetrics = useCallback(async () => {
    if (!businessId) return;

    setIsLoading(true);
    setError(null);

    // 1. Show cached data immediately while fetching fresh data
    const cached = await loadCached();
    if (cached && mountedRef.current) {
      const age = Date.now() - cached.fetchedAt;
      setMetrics(cached);
      setIsStale(age > CACHE_TTL_MS);
    }

    // 2. Fetch fresh data from the API
    try {
      const response = await apiClient.get<DashboardMetrics>(
        `/api/v1/dashboards/metrics`,
        {
          params: { business_id: businessId, period },
          timeout: 10_000,
        }
      );

      const fresh: DashboardMetrics = {
        ...response.data,
        fetchedAt: Date.now(),
      };

      if (mountedRef.current) {
        setMetrics(fresh);
        setIsStale(false);
        setError(null);
      }

      await saveCache(fresh);
    } catch (err) {
      // Network error — stick with cached data if available
      if (mountedRef.current) {
        if (!cached) {
          setError(
            "Could not load dashboard data. Check your internet connection."
          );
        } else {
          setIsStale(true);
          // Don't clear metrics — show stale data with an indicator
        }
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [businessId, period, loadCached, saveCache]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return {
    metrics,
    isLoading,
    isStale,
    error,
    refetch: fetchMetrics,
  };
}
