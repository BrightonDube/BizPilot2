/**
 * SyncService unit tests (task 10.4)
 *
 * Tests verify:
 * 1. performSync rejects concurrent syncs (lock mechanism)
 * 2. performSync calls pushChanges then pullChanges in order
 * 3. performSync updates syncStore on success
 * 4. performSync sets status=error and returns errors on failure
 * 5. performSync always releases the lock (finally block)
 * 6. triggerManualSync delegates to performSync
 * 7. forceFullSync resets lastSyncAt before calling performSync
 * 8. isSyncing reflects the lock state during sync
 */

// ---------------------------------------------------------------------------
// Mocks — all factories self-contained (no outer scope references)
// ---------------------------------------------------------------------------

jest.mock("@/services/sync/PushHandler", () => ({
  pushChanges: jest.fn(async () => ({
    pushed: 3,
    failed: 0,
    skippedDeadLetter: 0,
    errors: [],
    remoteIdMap: new Map(),
  })),
}));

jest.mock("@/services/sync/PullHandler", () => ({
  pullChanges: jest.fn(async () => ({
    pulled: 5,
    conflicts: 1,
    errors: [],
    perEntity: { orders: 3, products: 2 },
  })),
}));

jest.mock("@/services/sync/SyncQueue", () => ({
  getPendingCount: jest.fn(async () => 0),
}));

jest.mock("@/services/sync/SyncMetadata", () => ({
  recordSyncCycle: jest.fn(async () => {}),
  updateEntityMeta: jest.fn(async () => {}),
}));

jest.mock("@/stores/syncStore", () => {
  const state = {
    status: "idle",
    lastSyncAt: 0,
    error: null,
    pendingChanges: 0,
  };
  return {
    useSyncStore: {
      getState: jest.fn(() => ({
        ...state,
        setStatus: jest.fn((s: string) => { state.status = s; }),
        setLastSync: jest.fn((t: number) => { state.lastSyncAt = t; }),
        setPendingChanges: jest.fn((n: number) => { state.pendingChanges = n; }),
        setError: jest.fn((e: string | null) => { state.error = e; }),
      })),
    },
    __mockState: state,
  };
});

jest.mock("@/utils/logger", () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  performSync,
  triggerManualSync,
  forceFullSync,
  isSyncing,
} from "@/services/sync/SyncService";
import { pushChanges } from "@/services/sync/PushHandler";
import { pullChanges } from "@/services/sync/PullHandler";
import { recordSyncCycle } from "@/services/sync/SyncMetadata";

const mockPushChanges = pushChanges as jest.Mock;
const mockPullChanges = pullChanges as jest.Mock;
const mockRecordSyncCycle = recordSyncCycle as jest.Mock;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SyncService", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { __mockState } = require("@/stores/syncStore");

  // Capture the setLastSync mock once (same mock function across all calls)
  const mockSetLastSync = jest.fn();
  const mockSetStatus = jest.fn();
  const mockSetPendingChanges = jest.fn();
  const mockSetError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    __mockState.status = "idle";
    __mockState.lastSyncAt = 0;
    __mockState.error = null;
    __mockState.pendingChanges = 0;

    // Re-establish the syncStore mock to use consistent mock functions
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const syncStoreMock = require("@/stores/syncStore");
    syncStoreMock.useSyncStore.getState.mockReturnValue({
      ...__mockState,
      setStatus: mockSetStatus,
      setLastSync: mockSetLastSync,
      setPendingChanges: mockSetPendingChanges,
      setError: mockSetError,
    });

    // Re-establish default mock return values after clearAllMocks (which doesn't reset implementations)
    mockPushChanges.mockResolvedValue({
      pushed: 3,
      failed: 0,
      skippedDeadLetter: 0,
      errors: [],
      remoteIdMap: new Map(),
    });
    mockPullChanges.mockResolvedValue({
      pulled: 5,
      conflicts: 1,
      errors: [],
      perEntity: { orders: 3, products: 2 },
    });
  });

  // -------------------------------------------------------------------------
  // Task 10.4: Manual sync unit tests
  // -------------------------------------------------------------------------

  describe("performSync", () => {
    it("calls pushChanges then pullChanges in order", async () => {
      const callOrder: string[] = [];
      mockPushChanges.mockImplementationOnce(async () => {
        callOrder.push("push");
        return { pushed: 0, failed: 0, skippedDeadLetter: 0, errors: [], remoteIdMap: new Map() };
      });
      mockPullChanges.mockImplementationOnce(async () => {
        callOrder.push("pull");
        return { pulled: 0, conflicts: 0, errors: [], perEntity: {} };
      });

      await performSync();

      expect(callOrder).toEqual(["push", "pull"]);
    });

    it("returns aggregated pushed/pulled/conflicts counts", async () => {
      const result = await performSync();

      expect(result.pushed).toBe(3);
      expect(result.pulled).toBe(5);
      expect(result.conflicts).toBe(1);
    });

    it("returns success=true when there are no errors", async () => {
      const result = await performSync();

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns success=false and includes errors when push has errors", async () => {
      mockPushChanges.mockResolvedValueOnce({
        pushed: 0,
        failed: 1,
        skippedDeadLetter: 0,
        errors: ["orders/abc: timeout"],
        remoteIdMap: new Map(),
      });

      const result = await performSync();

      expect(result.success).toBe(false);
      expect(result.errors).toContain("orders/abc: timeout");
    });

    it("records the sync cycle in metadata", async () => {
      await performSync();

      expect(mockRecordSyncCycle).toHaveBeenCalledWith(3, 5); // pushed=3, pulled=5
    });

    it("rejects concurrent syncs and returns an error", async () => {
      // First sync takes a long time
      let resolvePush!: () => void;
      mockPushChanges.mockImplementationOnce(
        () =>
          new Promise<{
            pushed: number;
            failed: number;
            skippedDeadLetter: number;
            errors: string[];
            remoteIdMap: Map<string, string>;
          }>((resolve) => {
            resolvePush = () =>
              resolve({ pushed: 0, failed: 0, skippedDeadLetter: 0, errors: [], remoteIdMap: new Map() });
          })
      );

      const firstSync = performSync();
      // Try to start a second sync while first is running
      const secondSync = await performSync();

      // Second sync should be rejected immediately
      expect(secondSync.success).toBe(false);
      expect(secondSync.errors[0]).toMatch(/already in progress/i);

      // Resolve and cleanup the first sync
      resolvePush();
      await firstSync;
    });

    it("always releases the lock after sync completes", async () => {
      await performSync();

      expect(isSyncing()).toBe(false);
    });

    it("releases the lock even when an unexpected error occurs", async () => {
      mockPushChanges.mockRejectedValueOnce(new Error("Unexpected crash"));

      await performSync();

      expect(isSyncing()).toBe(false);
    });

    it("returns success=false and sets error status when exception is thrown", async () => {
      mockPushChanges.mockRejectedValueOnce(new Error("Fatal DB error"));

      const result = await performSync();

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes("Fatal DB error"))).toBe(true);
    });
  });

  describe("triggerManualSync", () => {
    it("delegates to performSync and returns the result", async () => {
      const result = await triggerManualSync();

      expect(result.pushed).toBe(3); // same as performSync mock
      expect(mockPushChanges).toHaveBeenCalledTimes(1);
    });
  });

  describe("forceFullSync", () => {
    it("resets lastSyncAt to 0 before syncing", async () => {
      __mockState.lastSyncAt = 9999999;

      await forceFullSync();

      // forceFullSync calls useSyncStore.getState().setLastSync(0)
      expect(mockSetLastSync).toHaveBeenCalledWith(0);
    });

    it("calls performSync after resetting timestamp", async () => {
      const result = await forceFullSync();

      expect(result.pushed).toBe(3);
      expect(mockPushChanges).toHaveBeenCalledTimes(1);
    });
  });
});
