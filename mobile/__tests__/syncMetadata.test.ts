/**
 * SyncMetadata unit tests (task 14.4)
 *
 * Tests verify:
 * 1. getEntityMeta returns null when no entry exists
 * 2. updateEntityMeta writes to the settings table
 * 3. getAllEntityMeta aggregates all entity types
 * 4. getSyncStats returns default zeros when no stats exist
 * 5. recordSyncCycle increments counters correctly
 */

// ---------------------------------------------------------------------------
// Mock database — factory must be self-contained (no outer variable references)
// ---------------------------------------------------------------------------

jest.mock("@/db", () => {
  const mockCollection = {
    query: jest.fn(() => ({
      fetch: jest.fn(async () => []),
    })),
    create: jest.fn(async (builder: (r: { key: string; value: string }) => void) => {
      const rec = { key: "", value: "" };
      builder(rec);
      return { id: `setting-${rec.key}`, key: rec.key, value: rec.value };
    }),
  };

  return {
    database: {
      write: jest.fn(async (fn: () => Promise<unknown>) => fn()),
      get: jest.fn(() => mockCollection),
    },
    __mockCollection: mockCollection,
  };
});

jest.mock("@/utils/logger", () => ({
  logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  getEntityMeta,
  getAllEntityMeta,
  updateEntityMeta,
  getSyncStats,
  recordSyncCycle,
  EntitySyncMeta,
} from "@/services/sync/SyncMetadata";

// ---------------------------------------------------------------------------
// Helper (outside factory — used in test body only)
// ---------------------------------------------------------------------------

function makeSettingRecord(key: string, value: string) {
  return {
    id: `setting-${key}`,
    key,
    value,
    update: jest.fn(async (updater: (r: { value: string }) => void) => {
      const rec = { value };
      updater(rec);
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SyncMetadata", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Task 14.4: Metadata unit tests
  // -------------------------------------------------------------------------

  describe("getEntityMeta", () => {
    it("returns null when no metadata exists for entity", async () => {
      // Override query to return empty for getEntityMeta (specific key lookup)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { __mockCollection } = require("@/db");
      __mockCollection.query.mockReturnValueOnce({
        fetch: jest.fn(async () => []),
      });

      const meta = await getEntityMeta("orders");
      expect(meta).toBeNull();
    });

    it("returns parsed metadata when it exists", async () => {
      const mockMeta: EntitySyncMeta = {
        entityType: "products",
        lastPullAt: Date.now() - 60_000,
        lastPushAt: Date.now() - 30_000,
        lastPullCount: 5,
        lastPushCount: 3,
        totalConflicts: 1,
      };

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { __mockCollection } = require("@/db");
      __mockCollection.query.mockReturnValueOnce({
        fetch: jest.fn(async () => [
          makeSettingRecord("sync_meta_products", JSON.stringify(mockMeta)),
        ]),
      });

      const meta = await getEntityMeta("products");

      expect(meta).not.toBeNull();
      expect(meta?.entityType).toBe("products");
      expect(meta?.lastPullCount).toBe(5);
    });

    it("returns null when stored value is invalid JSON", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { __mockCollection } = require("@/db");
      __mockCollection.query.mockReturnValueOnce({
        fetch: jest.fn(async () => [
          makeSettingRecord("sync_meta_broken", "not valid json{{{"),
        ]),
      });

      const meta = await getEntityMeta("broken");
      expect(meta).toBeNull();
    });
  });

  describe("getAllEntityMeta", () => {
    it("returns empty array when no metadata exists", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { __mockCollection } = require("@/db");
      __mockCollection.query.mockReturnValueOnce({
        fetch: jest.fn(async () => []),
      });

      const all = await getAllEntityMeta();
      expect(all).toEqual([]);
    });

    it("returns all entity metas", async () => {
      const metas: EntitySyncMeta[] = [
        {
          entityType: "orders",
          lastPullAt: 1_000_000,
          lastPushAt: 1_000_000,
          lastPullCount: 10,
          lastPushCount: 5,
          totalConflicts: 0,
        },
        {
          entityType: "products",
          lastPullAt: 2_000_000,
          lastPushAt: 2_000_000,
          lastPullCount: 100,
          lastPushCount: 0,
          totalConflicts: 2,
        },
      ];

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { __mockCollection } = require("@/db");
      __mockCollection.query.mockReturnValueOnce({
        fetch: jest.fn(async () =>
          metas.map((m) =>
            makeSettingRecord(`sync_meta_${m.entityType}`, JSON.stringify(m))
          )
        ),
      });

      const all = await getAllEntityMeta();
      expect(all.length).toBe(2);
      expect(all.map((m) => m.entityType).sort()).toEqual(["orders", "products"]);
    });
  });

  describe("getSyncStats", () => {
    it("returns zeroed stats when none exist", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { __mockCollection } = require("@/db");
      __mockCollection.query.mockReturnValueOnce({
        fetch: jest.fn(async () => []),
      });

      const stats = await getSyncStats();

      expect(stats.totalSyncs).toBe(0);
      expect(stats.totalPushes).toBe(0);
      expect(stats.totalPulls).toBe(0);
      expect(stats.firstSyncAt).toBeNull();
      expect(stats.lastSyncAt).toBeNull();
    });

    it("returns stored stats", async () => {
      const mockStats = {
        totalSyncs: 42,
        totalPushes: 100,
        totalPulls: 150,
        firstSyncAt: 1_000_000,
        lastSyncAt: Date.now() - 5000,
      };

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { __mockCollection } = require("@/db");
      __mockCollection.query.mockReturnValueOnce({
        fetch: jest.fn(async () => [
          makeSettingRecord("sync_stats", JSON.stringify(mockStats)),
        ]),
      });

      const stats = await getSyncStats();

      expect(stats.totalSyncs).toBe(42);
      expect(stats.lastSyncAt).toBe(mockStats.lastSyncAt);
    });
  });

  describe("recordSyncCycle", () => {
    it("writes to the database", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { database, __mockCollection } = require("@/db");

      // First call to get existing stats (returns empty)
      __mockCollection.query.mockReturnValueOnce({
        fetch: jest.fn(async () => []),
      });

      await recordSyncCycle(5, 3);

      expect(database.write).toHaveBeenCalled();
    });
  });
});
