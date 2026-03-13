/**
 * BizPilot Mobile POS — usePermissions Hook (Task 15.3)
 *
 * Provides reactive access to the business's permissions record
 * stored locally in WatermelonDB. Components use this to check
 * feature access without network calls.
 *
 * Why a hook instead of direct store access?
 * The permissions record may come from WatermelonDB (offline) or
 * from a Zustand store (cache). The hook abstracts the source,
 * providing a clean `hasFeature("payroll")` API to components.
 *
 * Why Zustand for the cache layer?
 * WatermelonDB observables require the component to be wrapped
 * in withDatabase/enhanced(), which adds boilerplate. Zustand
 * lets us load the record once on app start (and on each sync),
 * then read it synchronously from any component with zero setup.
 */

import { useCallback, useMemo } from "react";
import { create } from "zustand";
import type {
  PermissionsRecord,
  SubscriptionTier,
} from "@/services/permissions/PermissionsModel";
import {
  hasFeature as checkFeature,
  isDemo as checkIsDemo,
  isActive as checkIsActive,
  isPermissionsStale,
} from "@/services/permissions/PermissionsModel";

// ---------------------------------------------------------------------------
// Zustand store — single source of truth for current permissions
// ---------------------------------------------------------------------------

interface PermissionsStore {
  /** The current business permissions record, or null if not yet loaded */
  record: PermissionsRecord | null;
  /** Whether permissions are currently being loaded/synced */
  isLoading: boolean;
  /** Error message from last sync attempt, or null */
  error: string | null;

  // Actions
  setRecord: (record: PermissionsRecord) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

/**
 * Global permissions store.
 *
 * Why exported?
 * The sync handler needs to call setRecord() after syncing.
 * The logout handler needs to call clear() on sign-out.
 */
export const usePermissionsStore = create<PermissionsStore>((set) => ({
  record: null,
  isLoading: false,
  error: null,

  setRecord: (record) => set({ record, isLoading: false, error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  clear: () => set({ record: null, isLoading: false, error: null }),
}));

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface UsePermissionsReturn {
  /** The raw permissions record (null if not loaded) */
  record: PermissionsRecord | null;
  /** Whether permissions are being loaded */
  isLoading: boolean;
  /** Error from last sync, or null */
  error: string | null;
  /** Current subscription tier, or null if not loaded */
  tier: SubscriptionTier | null;
  /** Whether any features are accessible (active/trial/demo status) */
  isActive: boolean;
  /** Whether the subscription is in demo mode */
  isDemo: boolean;
  /** Whether the local permissions data is stale (>24h old) */
  isStale: boolean;
  /** Maximum devices allowed, or 0 if not loaded */
  deviceLimit: number;

  /**
   * Check if a specific feature is available.
   * Returns false if permissions aren't loaded or status is inactive.
   *
   * @param feature - Feature key (e.g., "payroll", "ai_assistant")
   */
  hasFeature: (feature: string) => boolean;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

/**
 * React hook providing offline-safe permission checks.
 *
 * Usage:
 * ```tsx
 * const { hasFeature, tier, isDemo } = usePermissions();
 *
 * if (hasFeature("payroll")) {
 *   // Show payroll UI
 * }
 * ```
 *
 * Why useCallback for hasFeature?
 * Components that pass hasFeature as a prop (e.g., to a list renderer)
 * would cause re-renders on every parent render without memoization.
 * useCallback ensures referential stability.
 */
export function usePermissions(): UsePermissionsReturn {
  const record = usePermissionsStore((s) => s.record);
  const isLoading = usePermissionsStore((s) => s.isLoading);
  const error = usePermissionsStore((s) => s.error);

  const hasFeature = useCallback(
    (feature: string): boolean => {
      return checkFeature(record, feature);
    },
    [record]
  );

  const tier = record?.tier ?? null;
  const isActive = checkIsActive(record);
  const isDemo = checkIsDemo(record);
  const isStale = isPermissionsStale(record);
  const deviceLimit = record?.deviceLimit ?? 0;

  return useMemo(
    () => ({
      record,
      isLoading,
      error,
      tier,
      isActive,
      isDemo,
      isStale,
      deviceLimit,
      hasFeature,
    }),
    [record, isLoading, error, tier, isActive, isDemo, isStale, deviceLimit, hasFeature]
  );
}
