/**
 * GuestCacheService — Pure functions for managing a local guest profile cache.
 *
 * Why: When the PMS connection drops, staff still need to look up
 * recently accessed guests. This service manages a TTL-based cache
 * of guest profiles stored in WatermelonDB.
 *
 * Every function is pure — no side-effects, no hidden state.
 * Injected `now` parameters keep date handling deterministic in tests.
 */

import type { PMSGuest } from "@/types/pms";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Default cache TTL: 4 hours. Guests checked in rarely change mid-shift. */
export const DEFAULT_CACHE_TTL_MS = 4 * 60 * 60 * 1000;

/** Maximum number of cached guests to prevent unbounded storage growth. */
export const DEFAULT_MAX_CACHE_SIZE = 200;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A guest profile with cache metadata. */
export interface CachedGuest {
  guest: PMSGuest;
  cachedAt: number;
  accessCount: number;
  lastAccessedAt: number;
}

// ---------------------------------------------------------------------------
// 1. cacheGuest
// ---------------------------------------------------------------------------

/**
 * Adds or updates a guest in the cache. If the guest already exists,
 * updates the profile and resets the TTL.
 *
 * Returns a new cache array — does NOT mutate the input.
 */
export function cacheGuest(
  cache: CachedGuest[],
  guest: PMSGuest,
  now: number = Date.now()
): CachedGuest[] {
  const existing = cache.findIndex((c) => c.guest.id === guest.id);

  if (existing >= 0) {
    // Update existing entry — preserve access count
    const updated = [...cache];
    updated[existing] = {
      guest,
      cachedAt: now,
      accessCount: cache[existing].accessCount + 1,
      lastAccessedAt: now,
    };
    return updated;
  }

  // Add new entry
  return [
    ...cache,
    {
      guest,
      cachedAt: now,
      accessCount: 1,
      lastAccessedAt: now,
    },
  ];
}

// ---------------------------------------------------------------------------
// 2. getFromCache
// ---------------------------------------------------------------------------

/**
 * Retrieves a guest from cache by ID. Returns null if not found or expired.
 */
export function getFromCache(
  cache: CachedGuest[],
  guestId: string,
  ttlMs: number = DEFAULT_CACHE_TTL_MS,
  now: number = Date.now()
): PMSGuest | null {
  const entry = cache.find((c) => c.guest.id === guestId);
  if (!entry) return null;

  // Check TTL expiry
  if (now - entry.cachedAt > ttlMs) return null;

  return entry.guest;
}

// ---------------------------------------------------------------------------
// 3. searchCache
// ---------------------------------------------------------------------------

/**
 * Searches cached guests by room number or name substring.
 * Only returns non-expired entries.
 *
 * Why search locally? When offline, the PMS API is unreachable.
 * This provides degraded-but-functional guest lookup.
 */
export function searchCache(
  cache: CachedGuest[],
  query: string,
  ttlMs: number = DEFAULT_CACHE_TTL_MS,
  now: number = Date.now()
): PMSGuest[] {
  const lowerQuery = query.toLowerCase().trim();
  if (lowerQuery.length === 0) return [];

  return cache
    .filter((c) => {
      // Skip expired entries
      if (now - c.cachedAt > ttlMs) return false;

      return (
        c.guest.roomNumber.toLowerCase().includes(lowerQuery) ||
        c.guest.name.toLowerCase().includes(lowerQuery)
      );
    })
    .map((c) => c.guest);
}

// ---------------------------------------------------------------------------
// 4. evictExpired
// ---------------------------------------------------------------------------

/**
 * Removes all expired entries from the cache.
 * Returns a new array — does NOT mutate the input.
 */
export function evictExpired(
  cache: CachedGuest[],
  ttlMs: number = DEFAULT_CACHE_TTL_MS,
  now: number = Date.now()
): CachedGuest[] {
  return cache.filter((c) => now - c.cachedAt <= ttlMs);
}

// ---------------------------------------------------------------------------
// 5. enforceMaxSize
// ---------------------------------------------------------------------------

/**
 * Trims the cache to the maximum size by evicting least recently
 * accessed entries first.
 *
 * Why LRA (Least Recently Accessed) instead of LRU?
 * In a hotel POS, staff repeatedly look up the same frequent guests.
 * LRA evicts profiles that haven't been looked up recently, keeping
 * the most actively used guests in cache.
 */
export function enforceMaxSize(
  cache: CachedGuest[],
  maxSize: number = DEFAULT_MAX_CACHE_SIZE
): CachedGuest[] {
  if (cache.length <= maxSize) return cache;

  // Sort by lastAccessedAt descending — keep most recently accessed
  const sorted = [...cache].sort(
    (a, b) => b.lastAccessedAt - a.lastAccessedAt
  );

  return sorted.slice(0, maxSize);
}

// ---------------------------------------------------------------------------
// 6. markAccessed
// ---------------------------------------------------------------------------

/**
 * Records an access event for a cached guest (e.g., when their profile
 * is viewed or selected for a charge). Updates access count and timestamp.
 */
export function markAccessed(
  cache: CachedGuest[],
  guestId: string,
  now: number = Date.now()
): CachedGuest[] {
  return cache.map((c) =>
    c.guest.id === guestId
      ? { ...c, accessCount: c.accessCount + 1, lastAccessedAt: now }
      : c
  );
}

// ---------------------------------------------------------------------------
// 7. getCacheStats
// ---------------------------------------------------------------------------

export interface CacheStats {
  totalEntries: number;
  activeEntries: number;
  expiredEntries: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}

/**
 * Returns aggregate statistics about the cache.
 */
export function getCacheStats(
  cache: CachedGuest[],
  ttlMs: number = DEFAULT_CACHE_TTL_MS,
  now: number = Date.now()
): CacheStats {
  const active = cache.filter((c) => now - c.cachedAt <= ttlMs);
  const expired = cache.length - active.length;

  let oldest: number | null = null;
  let newest: number | null = null;

  for (const entry of cache) {
    if (oldest === null || entry.cachedAt < oldest) oldest = entry.cachedAt;
    if (newest === null || entry.cachedAt > newest) newest = entry.cachedAt;
  }

  return {
    totalEntries: cache.length,
    activeEntries: active.length,
    expiredEntries: expired,
    oldestEntry: oldest,
    newestEntry: newest,
  };
}
