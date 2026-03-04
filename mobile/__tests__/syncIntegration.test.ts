/**
 * Sync Integration Tests — task 8.6
 *
 * These are INTEGRATION tests: they run the real SyncService, PushHandler,
 * and PullHandler code together, mocking only the external boundaries:
 *   - @/services/api/client  (HTTP calls)
 *   - @/db                   (WatermelonDB)
 *   - @/services/sync/SyncQueue   (queue primitives)
 *   - @/services/sync/SyncMetadata (metadata writes)
 *   - @/services/sync/ConflictResolver (deterministic in unit tests)
 *   - @/stores/syncStore     (Zustand store)
 *   - @/utils/errorRecovery  (passthrough — no real timers)
 *   - @/utils/logger         (silenced)
 *
 * Why are unit tests NOT enough here?
 * The unit tests for SyncService, PushHandler, and PullHandler all mock their
 * direct collaborators (e.g., PushHandler mocks SyncQueue, SyncService mocks
 * PushHandler).  Those tests verify each module in isolation, but don't catch
 * integration bugs such as:
 *   - Incorrect argument forwarding between SyncService → PushHandler
 *   - Progress callback wiring across the push/pull boundary
 *   - Aggregate result assembly (pushed + pulled combined correctly)
 *   - Lock semantics holding across the real async call chain
 *
 * Tests in this file verify the three-module chain end-to-end.
 */

// ---------------------------------------------------------------------------
// Mocks — all factories self-contained (Babel hoisting rule)
// ---------------------------------------------------------------------------

jest.mock("@/utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock("@/utils/errorRecovery", () => ({
  retryWithBackoff: jest.fn(async (fn: () => unknown) => fn()),
  isRetryableError: jest.fn(() => false),
}));

// SyncQueue — expose queue items so individual tests can configure them
jest.mock("@/services/sync/SyncQueue", () => ({
  getPendingEntries: jest.fn(async () => []),
  markProcessed: jest.fn(async () => {}),
  markFailed: jest.fn(async () => {}),
  purgeProcessed: jest.fn(async () => {}),
  getPendingCount: jest.fn(async () => 0),
  getDeadLetterEntries: jest.fn(async () => []),
  enqueueChange: jest.fn(async () => {}),
}));

// SyncMetadata — record calls but don't write anything
jest.mock("@/services/sync/SyncMetadata", () => ({
  recordSyncCycle: jest.fn(async () => {}),
  updateEntityMeta: jest.fn(async () => {}),
  getLastSyncAt: jest.fn(async () => 0),
}));

// ConflictResolver — always let server win (deterministic)
jest.mock("@/services/sync/ConflictResolver", () => ({
  resolveConflict: jest.fn(() => ({ winner: "server", resolvedData: {} })),
}));

// WatermelonDB — capture and execute write callbacks; simulate collections
jest.mock("@/db", () => {
  const mockCollection = {
    query: jest.fn(() => ({
      fetch: jest.fn(async () => []),
    })),
    create: jest.fn(async () => ({})),
  };
  return {
    database: {
      write: jest.fn(async (callback: () => Promise<void>) => callback()),
      get: jest.fn(() => mockCollection),
    },
  };
});

// syncStore — expose __mockState so tests can set lastSync, etc.
jest.mock("@/stores/syncStore", () => {
  const mockState = {
    status: "idle" as string,
    lastSync: 0,
    pendingChanges: 0,
    error: null as string | null,
  };
  const setStatus = jest.fn((s: string) => { mockState.status = s; });
  const setLastSync = jest.fn((t: number) => { mockState.lastSync = t; });
  const setPendingChanges = jest.fn((n: number) => { mockState.pendingChanges = n; });
  const setError = jest.fn((e: string | null) => { mockState.error = e; });
  return {
    useSyncStore: {
      getState: jest.fn(() => ({
        ...mockState,
        setStatus,
        setLastSync,
        setPendingChanges,
        setError,
      })),
    },
    __mockState: mockState,
  };
});

// apiClient — default: POST returns success, GET returns empty change list
// __esModule: true is required so Babel's interop helper correctly extracts
// the `default` export rather than wrapping the whole object.
jest.mock("@/services/api/client", () => ({
  __esModule: true,
  default: {
    post: jest.fn(async () => ({ data: { remoteId: "remote-001" } })),
    get: jest.fn(async () => ({
      data: { changes: [], hasMore: false, schemaVersion: 5 },
    })),
  },
}));

// ---------------------------------------------------------------------------
// Imports — after jest.mock() so they receive mocked modules
// ---------------------------------------------------------------------------

import { performSync, isSyncing } from "@/services/sync/SyncService";
import type { SyncProgressCallback } from "@/services/sync/SyncService";
import { getPendingEntries, markProcessed } from "@/services/sync/SyncQueue";
import { recordSyncCycle, updateEntityMeta } from "@/services/sync/SyncMetadata";
import apiClient from "@/services/api/client";

const mockGetPendingEntries = getPendingEntries as jest.Mock;
const mockMarkProcessed = markProcessed as jest.Mock;
const mockRecordSyncCycle = recordSyncCycle as jest.Mock;
const mockUpdateEntityMeta = updateEntityMeta as jest.Mock;
const mockApiPost = (apiClient.post as jest.Mock);
const mockApiGet = (apiClient.get as jest.Mock);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal SyncQueueEntry compatible object */
function makeQueueEntry(
  id: string,
  entityType = "orders",
  action: "create" | "update" | "delete" = "create"
) {
  return {
    id,
    entityType,
    action,
    payload: JSON.stringify({ id, name: "Test" }),
    attempts: 0,
    // WatermelonDB model-like shape
    isDirty: false,
    markAsProcessed: jest.fn(),
  };
}

/** Build a fake remote change returned by the pull endpoint */
function makeRemoteChange(
  id: string,
  action: "create" | "update" | "delete" = "create",
  entityType = "products"
) {
  return {
    id,
    action,
    data: { id, name: `Remote ${entityType} ${id}`, updated_at: Date.now() },
    updated_at: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();

  // Re-establish defaults cleared by clearAllMocks
  mockGetPendingEntries.mockResolvedValue([]);
  mockMarkProcessed.mockResolvedValue(undefined);
  mockRecordSyncCycle.mockResolvedValue(undefined);
  mockUpdateEntityMeta.mockResolvedValue(undefined);

  mockApiPost.mockResolvedValue({ data: { remoteId: "remote-001" } });
  mockApiGet.mockResolvedValue({
    data: { changes: [], hasMore: false, schemaVersion: 5 },
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Sync integration — SyncService → PushHandler → PullHandler", () => {
  // ---------
  // Happy path
  // ---------

  it("returns success with pushed=2 when queue has 2 entries", async () => {
    mockGetPendingEntries.mockResolvedValue([
      makeQueueEntry("entry-1"),
      makeQueueEntry("entry-2"),
    ]);

    const result = await performSync();

    expect(result.success).toBe(true);
    expect(result.pushed).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  it("returns pulled count matching remote changes from GET endpoints", async () => {
    // 2 changes on the 'products' entity, 0 elsewhere
    mockApiGet.mockImplementation(async (url: string) => {
      if (url.includes("/products")) {
        return {
          data: {
            changes: [makeRemoteChange("p-1"), makeRemoteChange("p-2")],
            hasMore: false,
            schemaVersion: 5,
          },
        };
      }
      return { data: { changes: [], hasMore: false, schemaVersion: 5 } };
    });

    const result = await performSync();

    expect(result.success).toBe(true);
    expect(result.pulled).toBe(2);
  });

  it("calls pushChanges before pullChanges (push-first ordering)", async () => {
    const callOrder: string[] = [];

    mockGetPendingEntries.mockResolvedValue([makeQueueEntry("e-1")]);
    mockApiPost.mockImplementation(async () => {
      callOrder.push("push");
      return { data: { remoteId: "r-1" } };
    });
    mockApiGet.mockImplementation(async () => {
      callOrder.push("pull");
      return { data: { changes: [], hasMore: false, schemaVersion: 5 } };
    });

    await performSync();

    expect(callOrder[0]).toBe("push");
    const pullIndex = callOrder.findIndex((c) => c === "pull");
    const pushIndex = callOrder.findIndex((c) => c === "push");
    expect(pushIndex).toBeLessThan(pullIndex);
  });

  it("records sync cycle metadata after a successful sync", async () => {
    await performSync();
    expect(mockRecordSyncCycle).toHaveBeenCalledTimes(1);
  });

  it("calls updateEntityMeta for every entity that returned changes", async () => {
    mockApiGet.mockImplementation(async (url: string) => {
      if (url.includes("/products")) {
        return {
          data: {
            changes: [makeRemoteChange("p-1")],
            hasMore: false,
            schemaVersion: 5,
          },
        };
      }
      if (url.includes("/customers")) {
        return {
          data: {
            changes: [makeRemoteChange("c-1", "create", "customers")],
            hasMore: false,
            schemaVersion: 5,
          },
        };
      }
      return { data: { changes: [], hasMore: false, schemaVersion: 5 } };
    });

    await performSync();

    // updateEntityMeta should have been called for products and customers
    const calledEntities = mockUpdateEntityMeta.mock.calls.map(
      (args: unknown[]) => args[0]
    );
    expect(calledEntities).toContain("products");
    expect(calledEntities).toContain("customers");
  });

  // ---------
  // Empty queue
  // ---------

  it("succeeds with pushed=0 when queue is empty", async () => {
    mockGetPendingEntries.mockResolvedValue([]);

    const result = await performSync();

    expect(result.success).toBe(true);
    expect(result.pushed).toBe(0);
  });

  // ---------
  // Error handling
  // ---------

  it("continues to pull even when push API call returns an error", async () => {
    mockGetPendingEntries.mockResolvedValue([makeQueueEntry("e-fail")]);
    mockApiPost.mockRejectedValueOnce(new Error("Network timeout"));

    // Pull endpoint returns 1 change
    mockApiGet.mockImplementation(async (url: string) => {
      if (url.includes("/products")) {
        return {
          data: {
            changes: [makeRemoteChange("p-1")],
            hasMore: false,
            schemaVersion: 5,
          },
        };
      }
      return { data: { changes: [], hasMore: false, schemaVersion: 5 } };
    });

    const result = await performSync();

    // Push failed — 0 pushed, but pull should still have run
    expect(result.pushed).toBe(0);
    expect(result.pulled).toBe(1);
    // Errors array reports the push failure
    expect(result.errors.length).toBeGreaterThan(0);
    // Result is not a hard crash — success=false but the function returned
    expect(result.success).toBe(false);
  });

  it("returns errors when pull GET endpoint throws", async () => {
    mockApiGet.mockRejectedValue(new Error("Server 500"));

    const result = await performSync();

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  // ---------
  // Concurrent lock
  // ---------

  it("rejects a concurrent sync while the first is still running", async () => {
    // Make the first sync take "a while" (don't resolve immediately)
    let resolveSync!: () => void;
    const syncBarrier = new Promise<void>((res) => { resolveSync = res; });

    mockGetPendingEntries.mockImplementation(async () => {
      await syncBarrier;
      return [];
    });

    // Start first sync (does NOT await — it's stuck on syncBarrier)
    const firstSync = performSync();
    // Yield to allow the async chain to advance past the lock acquisition
    await new Promise((res) => setImmediate(res));

    // Second sync attempt while first is in flight
    const secondResult = await performSync();

    expect(secondResult.success).toBe(false);
    expect(secondResult.errors).toContain("Sync already in progress");

    // Unblock the first sync
    resolveSync();
    const firstResult = await firstSync;
    expect(firstResult.success).toBe(true);
  });

  // ---------
  // Progress callbacks
  // ---------

  it("fires progress callbacks with push phase before pull phase", async () => {
    mockGetPendingEntries.mockResolvedValue([makeQueueEntry("e-1")]);

    const phases: string[] = [];
    const onProgress: SyncProgressCallback = ({ phase }) => {
      phases.push(phase);
    };

    await performSync(onProgress);

    // At least one "push" callback then at least one "pull" callback
    const firstPull = phases.indexOf("pull");
    const lastPush = phases.lastIndexOf("push");

    // There must be at least one of each
    expect(phases).toContain("push");
    expect(phases).toContain("pull");
    // All pushes come before any pull
    if (firstPull !== -1 && lastPush !== -1) {
      expect(lastPush).toBeLessThan(firstPull);
    }
  });

  // ---------
  // isSyncing utility
  // ---------

  it("isSyncing() returns false before and after performSync", async () => {
    expect(isSyncing()).toBe(false);
    const syncPromise = performSync();
    // isSyncing should be true mid-flight... after the lock is set
    await new Promise((res) => setImmediate(res));
    // (Lock is already released by the time setImmediate fires in a mock env,
    //  so we just verify the final state is false.)
    await syncPromise;
    expect(isSyncing()).toBe(false);
  });
});
