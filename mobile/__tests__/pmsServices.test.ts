/**
 * Tests for ChargePostingService and ChargeQueueService pure functions.
 */

import {
  createCharge,
  validateCharge,
  markPosted,
  markFailed,
  shouldRetry,
  reverseCharge,
  generateChargeReport,
  type PMSCharge,
} from "../services/pms/ChargePostingService";

import {
  enqueueCharge,
  dequeueNext,
  markSynced,
  markConflict,
  getQueueStats,
  purgeCompleted,
  sortByPriority,
  type QueuedCharge,
} from "../services/pms/ChargeQueueService";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date("2025-01-15T10:00:00.000Z");

function makeCharge(overrides: Partial<PMSCharge> = {}): PMSCharge {
  return {
    id: "chg-order1-1736931600000",
    roomNumber: "101",
    guestName: "John Doe",
    amount: 150.0,
    description: "Room service breakfast",
    orderId: "order1",
    status: "pending",
    attempts: 0,
    maxAttempts: 3,
    createdAt: NOW.toISOString(),
    postedAt: null,
    reversedAt: null,
    errorMessage: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ChargePostingService
// ---------------------------------------------------------------------------

describe("ChargePostingService", () => {
  test("createCharge returns valid PMSCharge with pending status", () => {
    const charge = createCharge("101", "John Doe", 150, "Breakfast", "order1", NOW);

    expect(charge.id).toBe(`chg-order1-${NOW.getTime()}`);
    expect(charge.roomNumber).toBe("101");
    expect(charge.guestName).toBe("John Doe");
    expect(charge.amount).toBe(150);
    expect(charge.description).toBe("Breakfast");
    expect(charge.orderId).toBe("order1");
    expect(charge.status).toBe("pending");
    expect(charge.attempts).toBe(0);
    expect(charge.maxAttempts).toBe(3);
    expect(charge.postedAt).toBeNull();
    expect(charge.reversedAt).toBeNull();
    expect(charge.errorMessage).toBeNull();
  });

  test("validateCharge accepts valid charge", () => {
    const charge = makeCharge();
    const result = validateCharge(charge);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("validateCharge rejects charge with amount <= 0", () => {
    const charge = makeCharge({ amount: 0 });
    const result = validateCharge(charge);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Charge amount must be greater than zero");
  });

  test("markPosted sets status and postedAt", () => {
    const charge = makeCharge();
    const posted = markPosted(charge, NOW);

    expect(posted.status).toBe("posted");
    expect(posted.postedAt).toBe(NOW.toISOString());
    expect(posted.errorMessage).toBeNull();
    // Original is not mutated
    expect(charge.status).toBe("pending");
  });

  test("markFailed sets status and error", () => {
    const charge = makeCharge();
    const failed = markFailed(charge, "PMS timeout");

    expect(failed.status).toBe("failed");
    expect(failed.errorMessage).toBe("PMS timeout");
    expect(charge.status).toBe("pending");
  });

  test("shouldRetry returns true when attempts < maxAttempts", () => {
    const charge = makeCharge({ status: "failed", attempts: 1, maxAttempts: 3 });
    expect(shouldRetry(charge)).toBe(true);

    const exhausted = makeCharge({ status: "failed", attempts: 3, maxAttempts: 3 });
    expect(shouldRetry(exhausted)).toBe(false);
  });

  test("reverseCharge sets reversed status", () => {
    const charge = makeCharge({ status: "posted" });
    const reversed = reverseCharge(charge, NOW);

    expect(reversed.status).toBe("reversed");
    expect(reversed.reversedAt).toBe(NOW.toISOString());
    expect(charge.status).toBe("posted");
  });

  test("generateChargeReport counts correctly", () => {
    const charges: PMSCharge[] = [
      makeCharge({ status: "posted", amount: 100 }),
      makeCharge({ status: "posted", amount: 200 }),
      makeCharge({ status: "failed" }),
      makeCharge({ status: "pending" }),
      makeCharge({ status: "reversed" }),
    ];

    const report = generateChargeReport(charges);

    expect(report.total).toBe(5);
    expect(report.posted).toBe(2);
    expect(report.failed).toBe(1);
    expect(report.pending).toBe(1);
    expect(report.reversed).toBe(1);
    expect(report.totalAmount).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// ChargeQueueService
// ---------------------------------------------------------------------------

describe("ChargeQueueService", () => {
  test("enqueueCharge creates queued item", () => {
    const charge = makeCharge();
    const queued = enqueueCharge(charge, "normal", NOW);

    expect(queued.id).toBe(`q-${charge.id}-${NOW.getTime()}`);
    expect(queued.charge).toBe(charge);
    expect(queued.priority).toBe("normal");
    expect(queued.syncStatus).toBe("queued");
    expect(queued.queuedAt).toBe(NOW.toISOString());
    expect(queued.lastAttemptAt).toBeNull();
  });

  test("dequeueNext returns highest priority first", () => {
    const low = enqueueCharge(makeCharge(), "low", NOW);
    const high = enqueueCharge(makeCharge(), "high", NOW);
    const normal = enqueueCharge(makeCharge(), "normal", NOW);

    const next = dequeueNext([low, high, normal]);
    expect(next).not.toBeNull();
    expect(next!.priority).toBe("high");
  });

  test("markSynced updates sync status", () => {
    const item = enqueueCharge(makeCharge(), "normal", NOW);
    const synced = markSynced(item, NOW);

    expect(synced.syncStatus).toBe("synced");
    expect(synced.lastAttemptAt).toBe(NOW.toISOString());
    expect(item.syncStatus).toBe("queued");
  });

  test("markConflict sets conflict status", () => {
    const item = enqueueCharge(makeCharge(), "normal", NOW);
    const conflicted = markConflict(item, "retry");

    expect(conflicted.syncStatus).toBe("conflict");
    expect(conflicted.conflictResolution).toBe("retry");
  });

  test("getQueueStats calculates correct stats", () => {
    const t1 = new Date("2025-01-15T08:00:00.000Z");
    const t2 = new Date("2025-01-15T09:00:00.000Z");

    const items: QueuedCharge[] = [
      enqueueCharge(makeCharge(), "normal", t1),
      enqueueCharge(makeCharge(), "normal", t2),
      { ...enqueueCharge(makeCharge(), "normal", NOW), syncStatus: "synced" },
      { ...enqueueCharge(makeCharge(), "normal", NOW), syncStatus: "conflict" },
      { ...enqueueCharge(makeCharge(), "normal", NOW), syncStatus: "error" },
    ];

    const stats = getQueueStats(items);

    expect(stats.totalQueued).toBe(2);
    expect(stats.synced).toBe(1);
    expect(stats.conflicts).toBe(1);
    expect(stats.errors).toBe(1);
    expect(stats.oldestQueuedAt).toBe(t1.toISOString());
  });

  test("purgeCompleted removes old synced items", () => {
    const old = markSynced(
      enqueueCharge(makeCharge(), "normal", new Date("2025-01-10T00:00:00.000Z")),
      new Date("2025-01-10T00:00:00.000Z"),
    );
    const recent = markSynced(
      enqueueCharge(makeCharge(), "normal", NOW),
      NOW,
    );
    const pending = enqueueCharge(makeCharge(), "normal", NOW);

    const cutoff = "2025-01-14T00:00:00.000Z";
    const result = purgeCompleted([old, recent, pending], cutoff);

    expect(result).toHaveLength(2);
    expect(result).toContain(recent);
    expect(result).toContain(pending);
  });

  test("sortByPriority orders high > normal > low", () => {
    const low = enqueueCharge(makeCharge(), "low", NOW);
    const normal = enqueueCharge(makeCharge(), "normal", NOW);
    const high = enqueueCharge(makeCharge(), "high", NOW);

    const sorted = sortByPriority([low, normal, high]);

    expect(sorted[0].priority).toBe("high");
    expect(sorted[1].priority).toBe("normal");
    expect(sorted[2].priority).toBe("low");
  });
});
