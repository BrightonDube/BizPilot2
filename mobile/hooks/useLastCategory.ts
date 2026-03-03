/**
 * BizPilot Mobile POS — useLastCategory Hook
 *
 * Persists the last selected category ID so it's restored when the
 * user returns to the POS screen or restarts the app.
 *
 * Why persist the last category?
 * In a busy POS environment, operators often work within a single
 * category (e.g., "Drinks" for a bar cashier). If the app refreshes
 * or they navigate away and back, they shouldn't have to re-select
 * their category — it should be right where they left it.
 *
 * Why not use Zustand persist?
 * This is a trivial single-value persistence. Adding Zustand persist
 * middleware (with MMKV or AsyncStorage) for one string would be
 * over-engineering. expo-secure-store is already imported.
 */

import { useState, useCallback, useEffect } from "react";
import * as SecureStore from "expo-secure-store";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "bizpilot_last_category";

// ---------------------------------------------------------------------------
// Hook interface
// ---------------------------------------------------------------------------

interface UseLastCategoryReturn {
  /** The last selected category ID, or "all" if none stored */
  lastCategoryId: string;
  /** Save a new category selection */
  setLastCategory: (categoryId: string) => void;
  /** Whether the initial load has completed */
  loaded: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useLastCategory(): UseLastCategoryReturn {
  const [lastCategoryId, setLastCategoryId] = useState("all");
  const [loaded, setLoaded] = useState(false);

  // Load from storage on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(STORAGE_KEY);
        if (stored) {
          setLastCategoryId(stored);
        }
      } catch {
        // Non-critical — default to "all"
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const setLastCategory = useCallback((categoryId: string) => {
    setLastCategoryId(categoryId);
    SecureStore.setItemAsync(STORAGE_KEY, categoryId).catch(() => {
      // Non-critical — worst case, category resets on next launch
    });
  }, []);

  return { lastCategoryId, setLastCategory, loaded };
}
