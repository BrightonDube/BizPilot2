/**
 * PullHandler unit tests (task 7.6)
 *
 * Tests verify:
 * 1. pullChanges returns zeroed result when server returns no changes
 * 2. pullChanges iterates all SYNCABLE_ENTITIES
 * 3. pullChanges aggregates pull counts across entities
 * 4. pullChanges records errors per entity (others continue)
 * 5. pullChanges calls onProgress callback per entity
 * 6. pullChanges uses lastSyncAt from syncStore as the `since` param
 */

// ---------------------------------------------------------------------------
// Mocks — all factories self-contained (no outer scope references)
// ---------------------------------------------------------------------------

jest.mock("@/services/api/client", () => ({
  __esModule: true,
  default: {
    get: jest.fn(async () => ({
      data: { changes: [], hasMore: false },
    })),
    post: jest.fn(async () => ({ data: {} })),
  },
}));

jest.mock("@/db", () => {
  const mockCollection = {
    query: jest.fn(() => ({ fetch: jest.fn(async () => []) })),
    create: jest.fn(async () => ({ id: "new-rec" })),
  };
  return {
    database: {
      write: jest.fn(async (fn: () => Promise<unknown>) => fn()),
      get: jest.fn(() => mockCollection),
    },
    __mockCollection: mockCollection,
  };
});

jest.mock("@/stores/syncStore", () => {
  const state = { isOnline: true, lastSyncAt: 0, status: "idle" };
  return {
    useSyncStore: {
      getState: jest.fn(() => state),
      setState: jest.fn((p: Record<string, unknown>) => Object.assign(state, p)),
    },
    __mockState: state,
  };
});

jest.mock("@/services/sync/ConflictResolver", () => ({
  resolveConflict: jest.fn(() => ({ winner: "server", mergedData: {} })),
}));

jest.mock("@/utils/logger", () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock("@/utils/errorRecovery", () => ({
  retryWithBackoff: jest.fn(async (fn: () => Promise<unknown>) => fn()),
  isRetryableError: jest.fn(() => false),
}));

import { pullChanges } from "@/services/sync/PullHandler";
import apiClient from "@/services/api/client";

const mockApiGet = apiClient.get as jest.Mock;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PullHandler", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { __mockState } = require("@/stores/syncStore");

  beforeEach(() => {
    jest.clearAllMocks();
    __mockState.lastSyncAt = 0;
    __mockState.status = "idle";
  });

  // -------------------------------------------------------------------------
  // Task 7.6: Pull handler unit tests
  // -------------------------------------------------------------------------

  describe("pullChanges", () => {
    it("returns zeroed result when server has no changes", async () => {
      // Default mock returns empty changes for all entities
      const result = await pullChanges();

      expect(result.pulled).toBe(0);
      expect(result.conflicts).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("queries the API for each syncable entity type", async () => {
      await pullChanges();

      // 6 syncable entities: categories, products, customers, orders, order_items, association_rules
      expect(mockApiGet).toHaveBeenCalledTimes(6);

      const calledUrls = mockApiGet.mock.calls.map((c: unknown[]) => c[0] as string);
      expect(calledUrls).toContain("/api/sync/pull/categories");
      expect(calledUrls).toContain("/api/sync/pull/products");
      expect(calledUrls).toContain("/api/sync/pull/orders");
    });

    it("passes the lastSyncAt value as the `since` param", async () => {
      __mockState.lastSyncAt = 1_700_000_000_000;

      await pullChanges();

      const firstCall = mockApiGet.mock.calls[0];
      expect(firstCall[1]?.params?.since).toBe(1_700_000_000_000);
    });

    it("aggregates pulled counts across multiple entities", async () => {
      // Return 3 changes for categories, 5 for products, 0 for others
      mockApiGet
        .mockResolvedValueOnce({
          data: {
            changes: [
              { id: "c1", action: "create", data: {}, updated_at: 1000 },
              { id: "c2", action: "create", data: {}, updated_at: 1000 },
              { id: "c3", action: "update", data: {}, updated_at: 1000 },
            ],
            hasMore: false,
          },
        })
        .mockResolvedValueOnce({
          data: {
            changes: [
              { id: "p1", action: "create", data: {}, updated_at: 1000 },
              { id: "p2", action: "create", data: {}, updated_at: 1000 },
              { id: "p3", action: "create", data: {}, updated_at: 1000 },
              { id: "p4", action: "update", data: {}, updated_at: 1000 },
              { id: "p5", action: "delete", data: {}, updated_at: 1000 },
            ],
            hasMore: false,
          },
        })
        .mockResolvedValue({ data: { changes: [], hasMore: false } });

      const result = await pullChanges();

      // applied count = records written to db (non-delete creates/updates + deletes of existing)
      // The mock db.query returns [] so "existing" is never found,
      // meaning: creates are applied, updates are applied as creates, deletes skip (no existing)
      expect(result.pulled).toBeGreaterThan(0);
      expect(result.perEntity["categories"]).toBeGreaterThan(0);
      expect(result.perEntity["products"]).toBeGreaterThan(0);
    });

    it("records an error and continues when one entity fails", async () => {
      // categories fails, products succeeds
      mockApiGet
        .mockRejectedValueOnce(new Error("Server 500"))
        .mockResolvedValue({ data: { changes: [], hasMore: false } });

      const result = await pullChanges();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("500");
      // Other entities still proceeded (6 entities total, 1 failed = 5 successful calls + 1 failed = 6)
      expect(mockApiGet).toHaveBeenCalledTimes(6);
    });

    it("calls onProgress callback for each entity", async () => {
      const progressCalls: unknown[] = [];

      await pullChanges((p) => progressCalls.push(p));

      // At least one progress call per entity (6 entities)
      expect(progressCalls.length).toBeGreaterThanOrEqual(6);
    });

    it("handles pagination by fetching multiple pages until hasMore is false", async () => {
      // Return hasMore=true on first page, false on second for categories
      mockApiGet
        .mockResolvedValueOnce({
          data: {
            changes: [{ id: "c1", action: "create", data: {}, updated_at: 1000 }],
            hasMore: true,
          },
        })
        .mockResolvedValueOnce({
          data: {
            changes: [{ id: "c2", action: "create", data: {}, updated_at: 1000 }],
            hasMore: false,
          },
        })
        .mockResolvedValue({ data: { changes: [], hasMore: false } });

      await pullChanges();

      // categories alone should trigger 2 GET calls (page 1 + page 2), then 5 more for other entities
      expect(mockApiGet).toHaveBeenCalledTimes(7);
    });
  });
});
