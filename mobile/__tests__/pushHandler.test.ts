/**
 * PushHandler unit tests (task 6.6)
 *
 * Tests verify:
 * 1. pushChanges returns empty result when queue is empty
 * 2. pushChanges processes pending entries and calls the API
 * 3. pushChanges marks entries as processed on success
 * 4. pushChanges marks entries as failed when API errors
 * 5. pushChanges skips dead-letter entries (exhausted retries)
 * 6. pushChanges captures remote ID mapping for new records
 * 7. getDeadLetterEntries filters by max-retry threshold
 */

// ---------------------------------------------------------------------------
// Mocks — all factories self-contained (no outer scope references)
// ---------------------------------------------------------------------------

jest.mock("@/services/sync/SyncQueue", () => ({
  getPendingEntries: jest.fn(async () => []),
  markProcessed: jest.fn(async () => {}),
  markFailed: jest.fn(async () => {}),
  purgeProcessed: jest.fn(async () => {}),
}));

jest.mock("@/services/api/client", () => ({
  __esModule: true,
  default: {
    post: jest.fn(async () => ({ data: {} })),
    get: jest.fn(async () => ({ data: {} })),
  },
}));

jest.mock("@/utils/logger", () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Mock errorRecovery to bypass real retry timers in tests
jest.mock("@/utils/errorRecovery", () => ({
  retryWithBackoff: jest.fn(async (fn: () => Promise<unknown>) => fn()),
  isRetryableError: jest.fn(() => false),
}));

import { pushChanges, getDeadLetterEntries } from "@/services/sync/PushHandler";
import { getPendingEntries, markProcessed, markFailed } from "@/services/sync/SyncQueue";
import apiClient from "@/services/api/client";

// Typed mock references (safe: captured after imports, not in factory)
const mockGetPendingEntries = getPendingEntries as jest.Mock;
const mockMarkProcessed = markProcessed as jest.Mock;
const mockMarkFailed = markFailed as jest.Mock;
const mockApiPost = apiClient.post as jest.Mock;

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function makePendingEntry(overrides: Partial<{
  id: string;
  entityType: string;
  entityId: string;
  action: "create" | "update" | "delete";
  payload: string;
  attempts: number;
  lastError: string | null;
  status: string;
}> = {}) {
  return {
    id: overrides.id ?? "entry-1",
    entityType: overrides.entityType ?? "orders",
    entityId: overrides.entityId ?? "local-uuid-1",
    action: overrides.action ?? "create",
    payload: overrides.payload ?? JSON.stringify({ name: "Test Order" }),
    attempts: overrides.attempts ?? 0,
    lastError: overrides.lastError ?? null,
    status: overrides.status ?? "pending",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PushHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Task 6.6: Push handler unit tests
  // -------------------------------------------------------------------------

  describe("pushChanges", () => {
    it("returns zeroed result when queue is empty", async () => {
      mockGetPendingEntries.mockResolvedValueOnce([]);

      const result = await pushChanges();

      expect(result.pushed).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.skippedDeadLetter).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockApiPost).not.toHaveBeenCalled();
    });

    it("calls the push API for each pending entry", async () => {
      const entries = [makePendingEntry({ id: "e1" }), makePendingEntry({ id: "e2" })];
      mockGetPendingEntries.mockResolvedValueOnce(entries);
      mockApiPost.mockResolvedValue({ data: { remote_id: null } });

      const result = await pushChanges();

      expect(mockApiPost).toHaveBeenCalledTimes(2);
      expect(result.pushed).toBe(2);
      expect(result.failed).toBe(0);
    });

    it("marks each entry as processed on success", async () => {
      const entry = makePendingEntry();
      mockGetPendingEntries.mockResolvedValueOnce([entry]);
      mockApiPost.mockResolvedValue({ data: {} });

      await pushChanges();

      expect(mockMarkProcessed).toHaveBeenCalledWith(entry);
    });

    it("marks entry as failed and records error when API throws", async () => {
      const entry = makePendingEntry({ entityType: "products" });
      mockGetPendingEntries.mockResolvedValueOnce([entry]);
      mockApiPost.mockRejectedValue(new Error("Network error"));

      const result = await pushChanges();

      expect(mockMarkFailed).toHaveBeenCalledWith(entry, "Network error");
      expect(result.failed).toBe(1);
      expect(result.errors[0]).toContain("products");
      expect(result.errors[0]).toContain("Network error");
    });

    it("skips entries that have exhausted max retries (dead letter)", async () => {
      // SYNC_MAX_RETRIES is imported from constants; default is 3
      const deadEntry = makePendingEntry({ attempts: 999, id: "dead-1" });
      const liveEntry = makePendingEntry({ attempts: 0, id: "live-1" });
      mockGetPendingEntries.mockResolvedValueOnce([deadEntry, liveEntry]);
      mockApiPost.mockResolvedValue({ data: {} });

      const result = await pushChanges();

      expect(result.skippedDeadLetter).toBe(1);
      expect(result.pushed).toBe(1);
      // Dead entry is never sent to the API
      expect(mockApiPost).toHaveBeenCalledTimes(1);
    });

    it("captures remote_id mapping for create actions", async () => {
      const entry = makePendingEntry({ action: "create", entityId: "local-123" });
      mockGetPendingEntries.mockResolvedValueOnce([entry]);
      mockApiPost.mockResolvedValue({ data: { remote_id: "server-456" } });

      const result = await pushChanges();

      expect(result.remoteIdMap.get("local-123")).toBe("server-456");
    });

    it("does NOT map remote_id for non-create actions", async () => {
      const entry = makePendingEntry({ action: "update", entityId: "local-789" });
      mockGetPendingEntries.mockResolvedValueOnce([entry]);
      mockApiPost.mockResolvedValue({ data: { remote_id: "should-be-ignored" } });

      const result = await pushChanges();

      expect(result.remoteIdMap.has("local-789")).toBe(false);
    });

    it("calls the onProgress callback for each entry", async () => {
      const entries = [
        makePendingEntry({ id: "e1" }),
        makePendingEntry({ id: "e2" }),
      ];
      mockGetPendingEntries.mockResolvedValueOnce(entries);
      mockApiPost.mockResolvedValue({ data: {} });

      const progressCalls: unknown[] = [];
      await pushChanges((p) => progressCalls.push(p));

      expect(progressCalls).toHaveLength(2);
    });

    it("continues processing after one entry fails", async () => {
      const entries = [
        makePendingEntry({ id: "e1", entityType: "orders" }),
        makePendingEntry({ id: "e2", entityType: "products" }),
      ];
      mockGetPendingEntries.mockResolvedValueOnce(entries);
      // First call fails, second succeeds
      mockApiPost
        .mockRejectedValueOnce(new Error("Timeout"))
        .mockResolvedValueOnce({ data: {} });

      const result = await pushChanges();

      expect(result.pushed).toBe(1);
      expect(result.failed).toBe(1);
    });
  });

  describe("getDeadLetterEntries", () => {
    it("returns entries that have exceeded max retries", async () => {
      const live = makePendingEntry({ attempts: 1 });
      const dead = makePendingEntry({ attempts: 999, id: "dead-1" });
      mockGetPendingEntries.mockResolvedValueOnce([live, dead]);

      const deadLetters = await getDeadLetterEntries();

      expect(deadLetters).toHaveLength(1);
      expect(deadLetters[0].id).toBe("dead-1");
    });

    it("returns empty array when all entries are within retry limit", async () => {
      const entries = [
        makePendingEntry({ attempts: 0 }),
        makePendingEntry({ attempts: 1 }),
        makePendingEntry({ attempts: 2 }),
      ];
      mockGetPendingEntries.mockResolvedValueOnce(entries);

      const deadLetters = await getDeadLetterEntries();

      expect(deadLetters).toHaveLength(0);
    });
  });
});
