/**
 * Unit tests for GuestCacheService — local guest profile caching.
 */

import {
  cacheGuest,
  getFromCache,
  searchCache,
  evictExpired,
  enforceMaxSize,
  markAccessed,
  getCacheStats,
  DEFAULT_CACHE_TTL_MS,
  type CachedGuest,
} from "@/services/pms/GuestCacheService";

import type { PMSGuest } from "@/types/pms";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date("2025-03-01T12:00:00Z").getTime();

function makeGuest(overrides?: Partial<PMSGuest>): PMSGuest {
  return {
    id: `guest-${Math.random().toString(36).slice(2, 8)}`,
    name: "John Smith",
    roomNumber: "101",
    checkInDate: "2025-02-28",
    checkOutDate: "2025-03-05",
    folioNumber: "F-1001",
    vipLevel: 0,
    isActive: true,
    canCharge: true,
    dailyChargeLimit: 5000,
    transactionChargeLimit: 2000,
    confirmationNumber: "CONF-123",
    lastFetchedAt: new Date(NOW).toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// cacheGuest
// ---------------------------------------------------------------------------

describe("cacheGuest", () => {
  it("adds a new guest to an empty cache", () => {
    const guest = makeGuest({ id: "g-1" });
    const cache = cacheGuest([], guest, NOW);

    expect(cache.length).toBe(1);
    expect(cache[0].guest).toBe(guest);
    expect(cache[0].accessCount).toBe(1);
  });

  it("updates an existing guest and increments access count", () => {
    const guest = makeGuest({ id: "g-1" });
    const cache1 = cacheGuest([], guest, NOW);
    const updatedGuest = makeGuest({ id: "g-1", name: "John Updated" });
    const cache2 = cacheGuest(cache1, updatedGuest, NOW + 1000);

    expect(cache2.length).toBe(1);
    expect(cache2[0].guest.name).toBe("John Updated");
    expect(cache2[0].accessCount).toBe(2);
  });

  it("does not mutate the original array", () => {
    const original: CachedGuest[] = [];
    const guest = makeGuest();
    const updated = cacheGuest(original, guest, NOW);

    expect(original.length).toBe(0);
    expect(updated.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getFromCache
// ---------------------------------------------------------------------------

describe("getFromCache", () => {
  it("returns a cached guest by ID", () => {
    const guest = makeGuest({ id: "g-1" });
    const cache = cacheGuest([], guest, NOW);
    const result = getFromCache(cache, "g-1", DEFAULT_CACHE_TTL_MS, NOW);

    expect(result).toBe(guest);
  });

  it("returns null for non-existent guest", () => {
    const result = getFromCache([], "g-nonexistent");
    expect(result).toBeNull();
  });

  it("returns null for expired guest", () => {
    const guest = makeGuest({ id: "g-1" });
    const cache = cacheGuest([], guest, NOW);
    const expired = NOW + DEFAULT_CACHE_TTL_MS + 1;
    const result = getFromCache(cache, "g-1", DEFAULT_CACHE_TTL_MS, expired);

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// searchCache
// ---------------------------------------------------------------------------

describe("searchCache", () => {
  it("finds guests by room number", () => {
    const g1 = makeGuest({ id: "g-1", roomNumber: "101" });
    const g2 = makeGuest({ id: "g-2", roomNumber: "202" });
    let cache = cacheGuest([], g1, NOW);
    cache = cacheGuest(cache, g2, NOW);

    const results = searchCache(cache, "101", DEFAULT_CACHE_TTL_MS, NOW);
    expect(results.length).toBe(1);
    expect(results[0].roomNumber).toBe("101");
  });

  it("finds guests by name (case insensitive)", () => {
    const g1 = makeGuest({ id: "g-1", name: "John Smith" });
    const g2 = makeGuest({ id: "g-2", name: "Jane Doe" });
    let cache = cacheGuest([], g1, NOW);
    cache = cacheGuest(cache, g2, NOW);

    const results = searchCache(cache, "jane", DEFAULT_CACHE_TTL_MS, NOW);
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Jane Doe");
  });

  it("returns empty array for blank query", () => {
    const cache = cacheGuest([], makeGuest(), NOW);
    const results = searchCache(cache, "  ", DEFAULT_CACHE_TTL_MS, NOW);
    expect(results.length).toBe(0);
  });

  it("excludes expired entries", () => {
    const guest = makeGuest({ id: "g-1" });
    const cache = cacheGuest([], guest, NOW);
    const expired = NOW + DEFAULT_CACHE_TTL_MS + 1;
    const results = searchCache(
      cache,
      guest.roomNumber,
      DEFAULT_CACHE_TTL_MS,
      expired
    );
    expect(results.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// evictExpired
// ---------------------------------------------------------------------------

describe("evictExpired", () => {
  it("removes expired entries", () => {
    const g1 = makeGuest({ id: "g-1" });
    const g2 = makeGuest({ id: "g-2" });
    let cache = cacheGuest([], g1, NOW - DEFAULT_CACHE_TTL_MS - 1);
    cache = cacheGuest(cache, g2, NOW);

    const result = evictExpired(cache, DEFAULT_CACHE_TTL_MS, NOW);
    expect(result.length).toBe(1);
    expect(result[0].guest.id).toBe("g-2");
  });

  it("keeps all entries when none are expired", () => {
    let cache = cacheGuest([], makeGuest({ id: "g-1" }), NOW);
    cache = cacheGuest(cache, makeGuest({ id: "g-2" }), NOW);

    const result = evictExpired(cache, DEFAULT_CACHE_TTL_MS, NOW);
    expect(result.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// enforceMaxSize
// ---------------------------------------------------------------------------

describe("enforceMaxSize", () => {
  it("trims cache to max size keeping most recently accessed", () => {
    let cache: CachedGuest[] = [];
    for (let i = 0; i < 10; i++) {
      cache = cacheGuest(cache, makeGuest({ id: `g-${i}` }), NOW + i * 1000);
    }
    // Access g-0 most recently
    cache = markAccessed(cache, "g-0", NOW + 20000);

    const trimmed = enforceMaxSize(cache, 3);
    expect(trimmed.length).toBe(3);
    // g-0 should be kept (most recently accessed)
    expect(trimmed.some((c) => c.guest.id === "g-0")).toBe(true);
  });

  it("returns cache unchanged when under limit", () => {
    const cache = cacheGuest([], makeGuest(), NOW);
    const result = enforceMaxSize(cache, 100);
    expect(result.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// markAccessed
// ---------------------------------------------------------------------------

describe("markAccessed", () => {
  it("increments access count and updates timestamp", () => {
    const guest = makeGuest({ id: "g-1" });
    const cache = cacheGuest([], guest, NOW);
    const later = NOW + 5000;
    const updated = markAccessed(cache, "g-1", later);

    expect(updated[0].accessCount).toBe(2);
    expect(updated[0].lastAccessedAt).toBe(later);
  });

  it("does not modify other entries", () => {
    const g1 = makeGuest({ id: "g-1" });
    const g2 = makeGuest({ id: "g-2" });
    let cache = cacheGuest([], g1, NOW);
    cache = cacheGuest(cache, g2, NOW);

    const updated = markAccessed(cache, "g-1", NOW + 5000);
    expect(updated[1].accessCount).toBe(1); // g-2 unchanged
  });
});

// ---------------------------------------------------------------------------
// getCacheStats
// ---------------------------------------------------------------------------

describe("getCacheStats", () => {
  it("returns correct stats for mixed cache", () => {
    let cache = cacheGuest(
      [],
      makeGuest({ id: "g-old" }),
      NOW - DEFAULT_CACHE_TTL_MS - 1
    );
    cache = cacheGuest(cache, makeGuest({ id: "g-new" }), NOW);

    const stats = getCacheStats(cache, DEFAULT_CACHE_TTL_MS, NOW);
    expect(stats.totalEntries).toBe(2);
    expect(stats.activeEntries).toBe(1);
    expect(stats.expiredEntries).toBe(1);
  });

  it("returns nulls for empty cache", () => {
    const stats = getCacheStats([]);
    expect(stats.totalEntries).toBe(0);
    expect(stats.oldestEntry).toBeNull();
    expect(stats.newestEntry).toBeNull();
  });
});
