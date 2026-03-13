/**
 * BizPilot Mobile POS — Conflict Resolver Tests
 *
 * Tests the sync conflict resolution strategies.
 * Critical for offline-first correctness — wrong resolution
 * can lead to data loss or inventory discrepancies.
 */

import {
  resolveConflict,
  resolveConflicts,
  type ConflictRecord,
} from "@/services/sync/ConflictResolver";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConflict(
  overrides: Partial<ConflictRecord> = {}
): ConflictRecord {
  return {
    entityType: "products",
    entityId: "entity-1",
    localVersion: { name: "Local Widget", price: 100 },
    serverVersion: { name: "Server Widget", price: 200 },
    localUpdatedAt: 1000,
    serverUpdatedAt: 2000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("resolveConflict", () => {
  // -----------------------------------------------------------------------
  // Server-wins strategy (orders, order_items, users)
  // -----------------------------------------------------------------------

  describe("server-wins strategy", () => {
    it("resolves orders conflicts with server data", () => {
      const result = resolveConflict(
        makeConflict({ entityType: "orders" })
      );

      expect(result.winner).toBe("server");
      expect(result.resolvedData).toEqual({ name: "Server Widget", price: 200 });
    });

    it("resolves order_items conflicts with server data", () => {
      const result = resolveConflict(
        makeConflict({ entityType: "order_items" })
      );

      expect(result.winner).toBe("server");
    });

    it("resolves users conflicts with server data", () => {
      const result = resolveConflict(
        makeConflict({ entityType: "users" })
      );

      expect(result.winner).toBe("server");
    });
  });

  // -----------------------------------------------------------------------
  // Client-wins strategy (customers)
  // -----------------------------------------------------------------------

  describe("client-wins strategy", () => {
    it("resolves customers conflicts with local data", () => {
      const result = resolveConflict(
        makeConflict({ entityType: "customers" })
      );

      expect(result.winner).toBe("local");
      expect(result.resolvedData).toEqual({ name: "Local Widget", price: 100 });
    });
  });

  // -----------------------------------------------------------------------
  // Last-write-wins strategy (products, categories, settings)
  // -----------------------------------------------------------------------

  describe("last-write-wins strategy", () => {
    it("picks server when server is newer", () => {
      const result = resolveConflict(
        makeConflict({
          entityType: "products",
          localUpdatedAt: 1000,
          serverUpdatedAt: 2000,
        })
      );

      expect(result.winner).toBe("server");
      expect(result.resolvedData).toEqual({ name: "Server Widget", price: 200 });
    });

    it("picks local when local is newer", () => {
      const result = resolveConflict(
        makeConflict({
          entityType: "products",
          localUpdatedAt: 3000,
          serverUpdatedAt: 2000,
        })
      );

      expect(result.winner).toBe("local");
      expect(result.resolvedData).toEqual({ name: "Local Widget", price: 100 });
    });

    it("picks local when timestamps are equal (tie-break)", () => {
      const result = resolveConflict(
        makeConflict({
          entityType: "products",
          localUpdatedAt: 2000,
          serverUpdatedAt: 2000,
        })
      );

      // >= means local wins on tie
      expect(result.winner).toBe("local");
    });

    it("works for categories", () => {
      const result = resolveConflict(
        makeConflict({
          entityType: "categories",
          localUpdatedAt: 1000,
          serverUpdatedAt: 2000,
        })
      );

      expect(result.winner).toBe("server");
    });

    it("works for settings", () => {
      const result = resolveConflict(
        makeConflict({
          entityType: "settings",
          localUpdatedAt: 3000,
          serverUpdatedAt: 2000,
        })
      );

      expect(result.winner).toBe("local");
    });
  });

  // -----------------------------------------------------------------------
  // Unknown entity type
  // -----------------------------------------------------------------------

  describe("unknown entity type", () => {
    it("falls back to last-write-wins for unknown entity types", () => {
      const result = resolveConflict(
        makeConflict({
          entityType: "unknown_thing",
          localUpdatedAt: 3000,
          serverUpdatedAt: 2000,
        })
      );

      expect(result.winner).toBe("local");
    });
  });

  // -----------------------------------------------------------------------
  // preserves entityId
  // -----------------------------------------------------------------------

  it("preserves the entityId in the result", () => {
    const result = resolveConflict(
      makeConflict({ entityId: "my-special-id" })
    );

    expect(result.entityId).toBe("my-special-id");
  });
});

// ---------------------------------------------------------------------------
// Batch resolution
// ---------------------------------------------------------------------------

describe("resolveConflicts", () => {
  it("resolves multiple conflicts", () => {
    const conflicts = [
      makeConflict({ entityType: "orders", entityId: "o1" }),
      makeConflict({ entityType: "customers", entityId: "c1" }),
      makeConflict({
        entityType: "products",
        entityId: "p1",
        localUpdatedAt: 3000,
        serverUpdatedAt: 2000,
      }),
    ];

    const results = resolveConflicts(conflicts);

    expect(results).toHaveLength(3);
    expect(results[0].winner).toBe("server"); // orders → server-wins
    expect(results[1].winner).toBe("local"); // customers → client-wins
    expect(results[2].winner).toBe("local"); // products, local newer
  });

  it("returns empty array for empty input", () => {
    expect(resolveConflicts([])).toEqual([]);
  });
});
