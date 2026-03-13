/**
 * BizPilot Mobile POS — useFavoriteProducts Hook
 *
 * Manages the user's list of favorite/pinned product IDs, persisted
 * in expo-secure-store so they survive app restarts.
 *
 * Why per-user favorites?
 * Different POS operators (barista vs. waiter) have different top products.
 * We key favorites by userId to keep each person's quick-access strip relevant.
 *
 * Why a simple array of IDs instead of full product objects?
 * Products change (price updates, stock). Storing only IDs ensures the
 * favorites strip always shows current data by looking up from the product
 * list. The ID array is tiny (<1KB) and fast to persist.
 */

import { useState, useCallback, useEffect } from "react";
import * as SecureStore from "expo-secure-store";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_PREFIX = "bizpilot_favorites_";
const MAX_FAVORITES = 20;

// ---------------------------------------------------------------------------
// Hook interface
// ---------------------------------------------------------------------------

interface UseFavoriteProductsReturn {
  /** Ordered list of favorite product IDs */
  favoriteIds: string[];
  /** Whether a product is in the favorites list */
  isFavorite: (productId: string) => boolean;
  /** Add or remove a product from favorites */
  toggleFavorite: (productId: string) => void;
  /** Reorder favorites (move productId to new index) */
  reorder: (productId: string, newIndex: number) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFavoriteProducts(userId: string | null): UseFavoriteProductsReturn {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  const storageKey = userId ? `${STORAGE_PREFIX}${userId}` : null;

  // Load from storage on mount or when userId changes
  useEffect(() => {
    if (!storageKey) {
      setFavoriteIds([]);
      return;
    }

    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setFavoriteIds(parsed.slice(0, MAX_FAVORITES));
          }
        }
      } catch {
        // Non-critical — start with empty favorites
      }
    })();
  }, [storageKey]);

  const persist = useCallback(
    async (ids: string[]) => {
      if (!storageKey) return;
      try {
        await SecureStore.setItemAsync(storageKey, JSON.stringify(ids));
      } catch {
        // Non-critical
      }
    },
    [storageKey]
  );

  const isFavorite = useCallback(
    (productId: string) => favoriteIds.includes(productId),
    [favoriteIds]
  );

  const toggleFavorite = useCallback(
    (productId: string) => {
      setFavoriteIds((prev) => {
        const exists = prev.includes(productId);
        let updated: string[];

        if (exists) {
          updated = prev.filter((id) => id !== productId);
        } else {
          if (prev.length >= MAX_FAVORITES) {
            // Cap reached — don't add
            return prev;
          }
          updated = [...prev, productId];
        }

        persist(updated);
        return updated;
      });
    },
    [persist]
  );

  const reorder = useCallback(
    (productId: string, newIndex: number) => {
      setFavoriteIds((prev) => {
        const without = prev.filter((id) => id !== productId);
        const clamped = Math.max(0, Math.min(newIndex, without.length));
        const updated = [
          ...without.slice(0, clamped),
          productId,
          ...without.slice(clamped),
        ];
        persist(updated);
        return updated;
      });
    },
    [persist]
  );

  return { favoriteIds, isFavorite, toggleFavorite, reorder };
}
