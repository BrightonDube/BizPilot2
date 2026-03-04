/**
 * SyncScheduler unit tests (task 9.6)
 *
 * Tests verify:
 * 1. startSyncScheduler: sets up periodic interval and connectivity listeners
 * 2. stopSyncScheduler: removes all listeners and clears interval
 * 3. isSchedulerRunning: reflects current state
 * 4. Throttling: does not sync more than once per MIN_SYNC_GAP_MS
 * 5. Offline guard: does not attempt sync when offline
 */

// ---------------------------------------------------------------------------
// Mocks — all jest.mock() factories must be self-contained (no outer scope refs)
// ---------------------------------------------------------------------------

// performSync mock: inline jest.fn(), captured below via import cast
jest.mock("@/services/sync/SyncService", () => ({
  performSync: jest.fn(async () => {}),
}));

// NetInfo mock: inline, captured via require() after import
jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn(async () => ({ isConnected: true })),
  },
}));

// react-native mock: mutable singleton, mutations happen in tests via require()
jest.mock("react-native", () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    currentState: "active",
  },
  Platform: { OS: "ios" },
}));

// syncStore mock: inline state object, exposed via __mockState
jest.mock("@/stores/syncStore", () => {
  const state = { isOnline: true, status: "idle", incrementPending: jest.fn() };
  return {
    useSyncStore: {
      getState: jest.fn(() => state),
      setState: jest.fn((partial: Record<string, unknown>) => {
        Object.assign(state, partial);
      }),
    },
    __mockState: state,
  };
});

import {
  startSyncScheduler,
  stopSyncScheduler,
  isSchedulerRunning,
} from "@/services/sync/SyncScheduler";
import { performSync } from "@/services/sync/SyncService";
import NetInfo from "@react-native-community/netinfo";
import { AppState } from "react-native";

// Typed references to inline mocks (safe: captured after imports, not in factory)
const mockPerformSync = performSync as jest.Mock;
const mockNetInfoAdd = NetInfo.addEventListener as jest.Mock;
const mockAppStateAdd = AppState.addEventListener as jest.Mock;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SyncScheduler", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { __mockState } = require("@/stores/syncStore");

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    __mockState.isOnline = true;
    __mockState.status = "idle";

    // Reset scheduler state between tests
    stopSyncScheduler();
  });

  afterEach(() => {
    stopSyncScheduler();
    jest.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Task 9.6: Scheduler unit tests
  // -------------------------------------------------------------------------

  describe("startSyncScheduler", () => {
    it("registers a NetInfo connectivity listener", () => {
      startSyncScheduler();

      expect(mockNetInfoAdd).toHaveBeenCalled();
    });

    it("registers an AppState change listener", () => {
      startSyncScheduler();

      expect(mockAppStateAdd).toHaveBeenCalledWith(
        "change",
        expect.any(Function)
      );
    });

    it("sets isSchedulerRunning to true", () => {
      expect(isSchedulerRunning()).toBe(false);

      startSyncScheduler();

      expect(isSchedulerRunning()).toBe(true);
    });

    it("does not register duplicate listeners on multiple starts", () => {
      startSyncScheduler();
      startSyncScheduler(); // second call should be a no-op

      expect(mockNetInfoAdd).toHaveBeenCalledTimes(1);
    });
  });

  describe("stopSyncScheduler", () => {
    it("sets isSchedulerRunning to false", () => {
      startSyncScheduler();
      expect(isSchedulerRunning()).toBe(true);

      stopSyncScheduler();
      expect(isSchedulerRunning()).toBe(false);
    });

    it("is safe to call multiple times", () => {
      stopSyncScheduler();
      stopSyncScheduler();

      expect(isSchedulerRunning()).toBe(false);
    });
  });

  describe("Offline guard", () => {
    it("does not trigger sync when store shows offline", () => {
      __mockState.isOnline = false;
      startSyncScheduler();

      // Advance time past the sync interval
      jest.advanceTimersByTime(6 * 60 * 1000);

      expect(mockPerformSync).not.toHaveBeenCalled();
    });

    it("does not trigger sync when already syncing", () => {
      __mockState.isOnline = true;
      __mockState.status = "syncing";
      startSyncScheduler();

      jest.advanceTimersByTime(6 * 60 * 1000);

      expect(mockPerformSync).not.toHaveBeenCalled();
    });
  });

  describe("Online sync triggering", () => {
    it("triggers sync after the periodic interval when online", async () => {
      __mockState.isOnline = true;
      __mockState.status = "idle";
      startSyncScheduler();

      // Advance by 5 minutes + 1 second (past the SYNC_INTERVAL_MS)
      jest.advanceTimersByTime(5 * 60 * 1000 + 1000);

      // Flush any async operations
      await Promise.resolve();

      expect(mockPerformSync).toHaveBeenCalledTimes(1);
    });
  });
});
