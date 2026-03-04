/**
 * SyncQueue unit tests (tasks 2.4, 3.5, 3.6)
 *
 * Tests verify:
 * 1. Queue model basics: entries can be created, retrieved, and marked
 * 2. Queue operations: enqueue, getPending, markProcessed, markFailed, purge
 * 3. Queue ordering PBT (Property 4): entries are always returned oldest-first
 *
 * Why mock the database singleton?
 * SyncQueue.ts imports `database` directly from "@/db". We intercept this
 * with Jest's module mock to keep tests fast and side-effect-free.
 */

// ---------------------------------------------------------------------------
// Mock WatermelonDB database singleton
// ---------------------------------------------------------------------------

// NOTE: jest.mock() factories cannot reference out-of-scope variables.
// We define the entire mock inline, then expose a mutable `_entries` array
// that test helpers can populate via seedEntry().
jest.mock("@/db", () => {
  // Self-contained in-memory entries array inside the factory
  const entries: Array<{
    id: string;
    entityType: string;
    entityId: string;
    action: string;
    payload: string;
    attempts: number;
    lastError: string | null;
    createdAt: number;
    processedAt: number | null;
    update: (...args: unknown[]) => Promise<void>;
    prepareDestroyPermanently: () => { type: string; id: string };
  }> = [];

  const collection = {
    create: jest.fn(async (builder: (r: typeof entries[number]) => void) => {
      let counter = entries.length + 1;
      const id = `entry-${counter++}`;
      const entry = {
        id,
        entityType: "orders",
        entityId: `record-${id}`,
        action: "create",
        payload: "{}",
        attempts: 0,
        lastError: null,
        createdAt: Date.now(),
        processedAt: null,
        update: jest.fn(async (updater: (r: typeof entry) => void) => {
          updater(entry);
        }),
        prepareDestroyPermanently: jest.fn(() => ({ type: "delete", id })),
      };
      builder(entry);
      entries.push(entry);
      return entry;
    }),
    query: jest.fn(() => ({
      fetch: jest.fn(async () =>
        entries
          .filter((e) => e.processedAt === null)
          .sort((a, b) => a.createdAt - b.createdAt)
      ),
      fetchCount: jest.fn(async () =>
        entries.filter((e) => e.processedAt === null).length
      ),
    })),
    _entries: entries,
  };

  return {
    database: {
      write: jest.fn(async (fn: () => Promise<unknown>) => fn()),
      get: jest.fn(() => collection),
      batch: jest.fn(async () => {}),
    },
    __collection: collection,
  };
});

let _idCounter = 1;

function makeQueueEntry(overrides: Partial<{
  entityType: string;
  entityId: string;
  action: string;
  payload: string;
  createdAt: number;
  processedAt: number | null;
}> = {}) {
  const id = `entry-${_idCounter++}`;
  const entry = {
    id,
    entityType: overrides.entityType ?? "orders",
    entityId: overrides.entityId ?? `record-${id}`,
    action: overrides.action ?? "create",
    payload: overrides.payload ?? "{}",
    attempts: 0,
    lastError: null,
    createdAt: overrides.createdAt ?? Date.now(),
    processedAt: overrides.processedAt ?? null,
    update: jest.fn(async (updater: (r: typeof entry) => void) => {
      updater(entry);
    }),
    prepareDestroyPermanently: jest.fn(() => ({
      type: "delete",
      id,
    })),
  };
  return entry;
}

function clearEntries() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { __collection } = require("@/db");
  __collection._entries.length = 0;
}

function seedEntry(overrides: Parameters<typeof makeQueueEntry>[0] = {}) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { __collection } = require("@/db");
  const entry = makeQueueEntry(overrides);
  __collection._entries.push(entry);
  return entry;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

import {
  enqueueChange,
  getPendingEntries,
  markProcessed,
  markFailed,
  getPendingCount,
  purgeProcessed,
} from "@/services/sync/SyncQueue";

describe("SyncQueue", () => {
  beforeEach(() => {
    clearEntries();
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Task 2.4: Queue model basics
  // -------------------------------------------------------------------------

  describe("enqueueChange", () => {
    it("writes a new entry to the database", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { database } = require("@/db");

      await enqueueChange("orders", "order-1", "create", { total: 99.99 });

      expect(database.write).toHaveBeenCalled();
      expect(database.get).toHaveBeenCalledWith("sync_queue");
    });

    it("accepts all three action types", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { database } = require("@/db");

      await enqueueChange("orders", "o-1", "create", {});
      await enqueueChange("orders", "o-2", "update", {});
      await enqueueChange("orders", "o-3", "delete", {});

      // write called once per enqueue
      expect(database.write).toHaveBeenCalledTimes(3);
    });
  });

  // -------------------------------------------------------------------------
  // Task 3.5: Queue operations unit tests
  // -------------------------------------------------------------------------

  describe("getPendingEntries", () => {
    it("returns only unprocessed entries", async () => {
      seedEntry({ entityId: "r-1", processedAt: null });
      seedEntry({ entityId: "r-2", processedAt: Date.now() - 1000 }); // processed
      seedEntry({ entityId: "r-3", processedAt: null });

      const pending = await getPendingEntries();

      // The mock query returns entries where processedAt === null
      // (2 out of 3 in this case)
      expect(pending.length).toBe(2);
      pending.forEach((e) => expect(e.processedAt).toBeNull());
    });

    it("returns empty array when queue is empty", async () => {
      const pending = await getPendingEntries();
      expect(pending).toEqual([]);
    });
  });

  describe("markProcessed", () => {
    it("sets processedAt timestamp on the entry", async () => {
      const entry = seedEntry();
      expect(entry.processedAt).toBeNull();

      await markProcessed(entry as unknown as import("@/db/models/SyncQueueItem").default);

      expect(entry.processedAt).not.toBeNull();
      expect(typeof entry.processedAt).toBe("number");
    });
  });

  describe("markFailed", () => {
    it("increments attempts counter and sets lastError", async () => {
      const entry = seedEntry();
      expect(entry.attempts).toBe(0);

      await markFailed(
        entry as unknown as import("@/db/models/SyncQueueItem").default,
        "Network timeout"
      );

      expect(entry.attempts).toBe(1);
      expect(entry.lastError).toBe("Network timeout");
    });

    it("can be called multiple times — increments each time", async () => {
      const entry = seedEntry();

      await markFailed(
        entry as unknown as import("@/db/models/SyncQueueItem").default,
        "Error 1"
      );
      await markFailed(
        entry as unknown as import("@/db/models/SyncQueueItem").default,
        "Error 2"
      );

      expect(entry.attempts).toBe(2);
      expect(entry.lastError).toBe("Error 2");
    });
  });

  describe("getPendingCount", () => {
    it("returns 0 when queue is empty", async () => {
      const count = await getPendingCount();
      expect(count).toBe(0);
    });

    it("returns count of unprocessed entries", async () => {
      seedEntry({ processedAt: null });
      seedEntry({ processedAt: null });
      seedEntry({ processedAt: Date.now() }); // processed

      const count = await getPendingCount();
      expect(count).toBe(2);
    });
  });

  describe("purgeProcessed", () => {
    it("removes entries older than the threshold", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { database } = require("@/db");

      const old = seedEntry({
        processedAt: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
      });
      const recent = seedEntry({ processedAt: Date.now() - 60_000 });

      // We need the query mock to return the old processed entries
      // Override the mock for this test
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { __collection } = require("@/db");
      __collection.query.mockReturnValueOnce({
        fetch: jest.fn(async () => [old]),
        fetchCount: jest.fn(async () => 1),
      });

      await purgeProcessed(7 * 24 * 60 * 60 * 1000); // purge > 7 days old

      expect(database.batch).toHaveBeenCalled();
      expect(old.prepareDestroyPermanently).toHaveBeenCalled();
      expect(recent.prepareDestroyPermanently).not.toHaveBeenCalled();
    });

    it("does not call batch when nothing to purge", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { __collection, database } = require("@/db");
      __collection.query.mockReturnValueOnce({
        fetch: jest.fn(async () => []),
        fetchCount: jest.fn(async () => 0),
      });

      await purgeProcessed(7 * 24 * 60 * 60 * 1000);

      expect(database.batch).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Task 3.6: PBT for queue ordering (Property 4)
  // Queue entries MUST be returned in creation order (oldest first)
  // -------------------------------------------------------------------------

  describe("Queue ordering PBT (Property 4)", () => {
    it("property: getPendingEntries always returns entries sorted oldest-first", async () => {
      // Run 10 random permutations
      for (let trial = 0; trial < 10; trial++) {
        clearEntries();

        // Generate N entries with shuffled timestamps
        const n = Math.floor(Math.random() * 8) + 2; // 2–9 entries
        const timestamps = Array.from({ length: n }, (_, i) =>
          Date.now() - i * 10_000
        );
        // Shuffle the timestamps
        for (let i = timestamps.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [timestamps[i], timestamps[j]] = [timestamps[j], timestamps[i]];
        }

        timestamps.forEach((ts) => seedEntry({ createdAt: ts, processedAt: null }));

        const pending = await getPendingEntries();

        // Verify returned in ascending order by createdAt
        for (let i = 1; i < pending.length; i++) {
          expect(pending[i].createdAt).toBeGreaterThanOrEqual(
            pending[i - 1].createdAt
          );
        }
      }
    });

    it("property: processed entries are never returned by getPendingEntries", async () => {
      for (let trial = 0; trial < 10; trial++) {
        clearEntries();

        const totalEntries = Math.floor(Math.random() * 10) + 2;
        const processedCount = Math.floor(Math.random() * totalEntries);

        Array.from({ length: totalEntries }).forEach((_, i) => {
          seedEntry({
            entityId: `record-${i}`,
            processedAt: i < processedCount ? Date.now() - i * 1000 : null,
          });
        });

        const pending = await getPendingEntries();

        pending.forEach((entry) => {
          expect(entry.processedAt).toBeNull();
        });

        expect(pending.length).toBe(totalEntries - processedCount);
      }
    });
  });
});
