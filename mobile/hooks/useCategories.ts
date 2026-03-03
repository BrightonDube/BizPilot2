/**
 * BizPilot Mobile POS — useCategories Hook
 *
 * Provides category data for the POS category tabs.
 *
 * Why a separate hook for categories?
 * Categories change infrequently (unlike products which update with stock).
 * This hook can aggressively cache and only refresh on sync.
 */

import { useState, useMemo, useCallback } from "react";
import type { MobileCategory } from "@/types";

// ---------------------------------------------------------------------------
// Mock data (replaced by WatermelonDB when connected)
// ---------------------------------------------------------------------------

const MOCK_CATEGORIES: MobileCategory[] = [
  { id: "food", name: "Food", color: "#22c55e", icon: "restaurant", parentId: null, sortOrder: 1, isActive: true, createdAt: Date.now(), updatedAt: Date.now(), remoteId: "food", syncedAt: Date.now(), isDirty: false },
  { id: "drinks", name: "Drinks", color: "#f59e0b", icon: "cafe", parentId: null, sortOrder: 2, isActive: true, createdAt: Date.now(), updatedAt: Date.now(), remoteId: "drinks", syncedAt: Date.now(), isDirty: false },
  { id: "desserts", name: "Desserts", color: "#ec4899", icon: "ice-cream", parentId: null, sortOrder: 3, isActive: true, createdAt: Date.now(), updatedAt: Date.now(), remoteId: "desserts", syncedAt: Date.now(), isDirty: false },
  { id: "specials", name: "Specials", color: "#8b5cf6", icon: "star", parentId: null, sortOrder: 4, isActive: true, createdAt: Date.now(), updatedAt: Date.now(), remoteId: "specials", syncedAt: Date.now(), isDirty: false },
];

// ---------------------------------------------------------------------------
// Hook interface
// ---------------------------------------------------------------------------

interface UseCategoriesReturn {
  /** All active categories sorted by sortOrder */
  categories: MobileCategory[];
  /** Whether data is loading */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Reload categories from database */
  refresh: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCategories(): UseCategoriesReturn {
  const [loading, setLoading] = useState(false);
  const [error] = useState<string | null>(null);

  const categories = useMemo(() => {
    return [...MOCK_CATEGORIES]
      .filter((c) => c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    setTimeout(() => setLoading(false), 100);
  }, []);

  return { categories, loading, error, refresh };
}
