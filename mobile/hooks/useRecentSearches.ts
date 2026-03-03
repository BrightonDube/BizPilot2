/**
 * BizPilot Mobile POS — useRecentSearches Hook
 *
 * Manages a list of recent search terms stored in expo-secure-store.
 * Used by the SearchResultsDropdown to show search history.
 *
 * Why expo-secure-store instead of AsyncStorage?
 * We already have expo-secure-store as a dependency. Using it for all
 * key-value persistence keeps the dependency count minimal. The data
 * isn't sensitive, but consistency matters more than adding AsyncStorage.
 *
 * Why a max of 10 items?
 * More than 10 recent searches creates visual clutter. The list should
 * fit without scrolling to be useful at a glance. If a term falls off
 * the list, the user simply types it again — no friction.
 */

import { useState, useCallback, useEffect } from "react";
import * as SecureStore from "expo-secure-store";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "bizpilot_recent_searches";
const MAX_RECENT_SEARCHES = 10;

// ---------------------------------------------------------------------------
// Hook interface
// ---------------------------------------------------------------------------

interface UseRecentSearchesReturn {
  /** Recent search terms, most recent first */
  recentSearches: string[];
  /** Add a new search term to the list */
  addSearch: (term: string) => void;
  /** Remove a single search term */
  removeSearch: (term: string) => void;
  /** Clear all recent searches */
  clearAll: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRecentSearches(): UseRecentSearchesReturn {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load from storage on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setRecentSearches(parsed.slice(0, MAX_RECENT_SEARCHES));
          }
        }
      } catch {
        // Storage read failure is non-critical — start with empty list
      }
    })();
  }, []);

  // Persist to storage whenever the list changes
  const persist = useCallback(async (searches: string[]) => {
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(searches));
    } catch {
      // Storage write failure is non-critical
    }
  }, []);

  const addSearch = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      if (trimmed.length === 0) return;

      setRecentSearches((prev) => {
        // Remove duplicates, prepend new term, cap at max
        const filtered = prev.filter(
          (s) => s.toLowerCase() !== trimmed.toLowerCase()
        );
        const updated = [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES);
        persist(updated);
        return updated;
      });
    },
    [persist]
  );

  const removeSearch = useCallback(
    (term: string) => {
      setRecentSearches((prev) => {
        const updated = prev.filter((s) => s !== term);
        persist(updated);
        return updated;
      });
    },
    [persist]
  );

  const clearAll = useCallback(() => {
    setRecentSearches([]);
    persist([]);
  }, [persist]);

  return { recentSearches, addSearch, removeSearch, clearAll };
}
