/**
 * BizPilot Mobile POS — useQueryCache Hook
 *
 * Adds TTL-based caching to WatermelonDB queries so that screens
 * re-visiting the same data set don't re-query the database.
 *
 * Why a custom cache instead of React Query or SWR?
 * Those libraries are designed for HTTP requests. WatermelonDB queries
 * are synchronous reads from a local SQLite database — they're already
 * fast (~1-3ms). The cache here prevents unnecessary React re-renders
 * when the underlying data hasn't changed, which matters in a POS where
 * the product grid re-mounts every time the user switches tabs.
 *
 * Why a simple Map + TTL instead of LRU?
 * The POS has a bounded number of query patterns (products by category,
 * customer search, recent orders). A Map with manual expiry is simpler
 * to debug than an LRU eviction policy, and the memory footprint is
 * small enough that eviction isn't needed.
 */

import { useRef, useCallback, useMemo } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface QueryCacheOptions {
  /** Time-to-live in milliseconds (default: 30 seconds) */
  ttl?: number;
  /** Maximum number of cached entries (default: 50) */
  maxEntries?: number;
}

interface QueryCacheReturn<T> {
  /** Get a cached value by key, or null if expired/missing */
  get: (key: string) => T | null;
  /** Store a value in the cache */
  set: (key: string, data: T) => void;
  /** Invalidate a specific cache entry */
  invalidate: (key: string) => void;
  /** Clear all cached entries */
  clear: () => void;
  /** Check if a non-expired entry exists for the key */
  has: (key: string) => boolean;
  /** Number of currently cached (may include expired) entries */
  size: number;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const DEFAULT_TTL = 30_000; // 30 seconds
const DEFAULT_MAX_ENTRIES = 50;

/**
 * Provides a simple TTL cache scoped to the component's lifetime.
 *
 * The cache lives in a ref so writes don't trigger re-renders.
 * Components call `get()` before running a query and `set()` after,
 * giving them control over when to use cached vs. fresh data.
 *
 * Usage:
 * ```tsx
 * const cache = useQueryCache<MobileProduct[]>({ ttl: 60_000 });
 *
 * useEffect(() => {
 *   const key = `products-${categoryId}`;
 *   const cached = cache.get(key);
 *   if (cached) { setProducts(cached); return; }
 *
 *   fetchProducts(categoryId).then(data => {
 *     cache.set(key, data);
 *     setProducts(data);
 *   });
 * }, [categoryId]);
 * ```
 */
export function useQueryCache<T>(
  options: QueryCacheOptions = {}
): QueryCacheReturn<T> {
  const { ttl = DEFAULT_TTL, maxEntries = DEFAULT_MAX_ENTRIES } = options;
  const cacheRef = useRef<Map<string, CacheEntry<T>>>(new Map());

  const get = useCallback(
    (key: string): T | null => {
      const entry = cacheRef.current.get(key);
      if (!entry) return null;

      const age = Date.now() - entry.timestamp;
      if (age > ttl) {
        // Expired — remove and return null
        cacheRef.current.delete(key);
        return null;
      }

      return entry.data;
    },
    [ttl]
  );

  const set = useCallback(
    (key: string, data: T) => {
      // Enforce max entries — evict oldest if at capacity
      if (cacheRef.current.size >= maxEntries && !cacheRef.current.has(key)) {
        const oldestKey = cacheRef.current.keys().next().value;
        if (oldestKey !== undefined) {
          cacheRef.current.delete(oldestKey);
        }
      }

      cacheRef.current.set(key, { data, timestamp: Date.now() });
    },
    [maxEntries]
  );

  const invalidate = useCallback((key: string) => {
    cacheRef.current.delete(key);
  }, []);

  const clear = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  const has = useCallback(
    (key: string): boolean => {
      const entry = cacheRef.current.get(key);
      if (!entry) return false;
      return Date.now() - entry.timestamp <= ttl;
    },
    [ttl]
  );

  return useMemo(
    () => ({
      get,
      set,
      invalidate,
      clear,
      has,
      get size() {
        return cacheRef.current.size;
      },
    }),
    [get, set, invalidate, clear, has]
  );
}
