/**
 * ChargeQueueService — Pure functions for managing an offline charge queue.
 *
 * Why: POS terminals may lose network connectivity. Charges must be queued
 * locally and synced to the PMS when connectivity resumes. This service
 * manages the queue lifecycle, prioritization, and conflict resolution.
 *
 * Every function is pure — no side-effects, no hidden state.
 * Injected `now` parameters keep date handling deterministic in tests.
 */

import type { PMSCharge } from "./ChargePostingService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QueuePriority = "high" | "normal" | "low";

export type SyncStatus = "queued" | "syncing" | "synced" | "conflict" | "error";

export type ConflictResolution = "retry" | "skip" | "manual";

export interface QueuedCharge {
  id: string;
  charge: PMSCharge;
  priority: QueuePriority;
  queuedAt: string;
  lastAttemptAt: string | null;
  syncStatus: SyncStatus;
  conflictResolution?: ConflictResolution;
}

export interface QueueStats {
  totalQueued: number;
  syncing: number;
  synced: number;
  conflicts: number;
  errors: number;
  oldestQueuedAt: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Numeric weight for priority — lower is more urgent.
 * Why numeric? So `Array.sort` can use a simple subtraction comparator.
 */
const PRIORITY_WEIGHT: Record<QueuePriority, number> = {
  high: 0,
  normal: 1,
  low: 2,
};

// ---------------------------------------------------------------------------
// 1. enqueueCharge
// ---------------------------------------------------------------------------

/**
 * Wraps a PMSCharge into a QueuedCharge ready for offline storage.
 *
 * Why default to "normal" priority? Most POS charges are routine; only
 * VIP or high-value charges should be promoted to "high".
 */
export function enqueueCharge(
  charge: PMSCharge,
  priority: QueuePriority = "normal",
  now: Date = new Date()
): QueuedCharge {
  return {
    id: `q-${charge.id}-${now.getTime()}`,
    charge,
    priority,
    queuedAt: now.toISOString(),
    lastAttemptAt: null,
    syncStatus: "queued",
  };
}

// ---------------------------------------------------------------------------
// 2. dequeueNext
// ---------------------------------------------------------------------------

/**
 * Returns the next item to sync — highest priority first, then oldest.
 *
 * Why not mutate the array? The caller decides when to remove the item
 * from its local store; we just identify the best candidate.
 */
export function dequeueNext(
  queue: QueuedCharge[]
): QueuedCharge | null {
  const candidates = queue.filter((q) => q.syncStatus === "queued");

  if (candidates.length === 0) return null;

  // Sort: priority weight ascending, then queuedAt ascending (oldest first)
  const sorted = [...candidates].sort((a, b) => {
    const pw = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
    if (pw !== 0) return pw;
    return new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime();
  });

  return sorted[0];
}

// ---------------------------------------------------------------------------
// 3. markSyncing
// ---------------------------------------------------------------------------

/**
 * Transitions a queued item to `syncing` status.
 * Why a separate status? So the UI can display a spinner for in-flight items.
 */
export function markSyncing(item: QueuedCharge): QueuedCharge {
  return {
    ...item,
    syncStatus: "syncing",
  };
}

// ---------------------------------------------------------------------------
// 4. markSynced
// ---------------------------------------------------------------------------

/**
 * Marks an item as successfully synced to the PMS.
 * Records the sync timestamp so `purgeCompleted` can age out old items.
 */
export function markSynced(
  item: QueuedCharge,
  now: Date = new Date()
): QueuedCharge {
  return {
    ...item,
    syncStatus: "synced",
    lastAttemptAt: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 5. markConflict
// ---------------------------------------------------------------------------

/**
 * Marks an item as conflicted and optionally sets a resolution strategy.
 *
 * Why track conflicts separately from errors? Conflicts require human
 * decision-making (e.g. duplicate charge on the PMS side), while errors
 * are typically transient network issues.
 */
export function markConflict(
  item: QueuedCharge,
  resolution: ConflictResolution = "manual"
): QueuedCharge {
  return {
    ...item,
    syncStatus: "conflict",
    conflictResolution: resolution,
  };
}

// ---------------------------------------------------------------------------
// 6. markError
// ---------------------------------------------------------------------------

/** Marks an item as errored — eligible for future retry. */
export function markError(item: QueuedCharge): QueuedCharge {
  return {
    ...item,
    syncStatus: "error",
  };
}

// ---------------------------------------------------------------------------
// 7. getQueueStats
// ---------------------------------------------------------------------------

/**
 * Produces aggregate statistics for the current queue.
 *
 * Why include `oldestQueuedAt`? So the UI can warn when items have been
 * stuck offline too long (e.g. "Oldest pending charge: 4 hours ago").
 */
export function getQueueStats(queue: QueuedCharge[]): QueueStats {
  const queued = queue.filter((q) => q.syncStatus === "queued");
  const syncing = queue.filter((q) => q.syncStatus === "syncing");
  const synced = queue.filter((q) => q.syncStatus === "synced");
  const conflicts = queue.filter((q) => q.syncStatus === "conflict");
  const errors = queue.filter((q) => q.syncStatus === "error");

  // Find the oldest queued item by comparing ISO timestamps
  let oldestQueuedAt: string | null = null;
  for (const item of queued) {
    if (oldestQueuedAt === null || item.queuedAt < oldestQueuedAt) {
      oldestQueuedAt = item.queuedAt;
    }
  }

  return {
    totalQueued: queued.length,
    syncing: syncing.length,
    synced: synced.length,
    conflicts: conflicts.length,
    errors: errors.length,
    oldestQueuedAt,
  };
}

// ---------------------------------------------------------------------------
// 8. getRetryableItems
// ---------------------------------------------------------------------------

/**
 * Returns items that can be retried: errored items and conflicts
 * marked with a `retry` resolution.
 *
 * Why include conflicts with "retry" resolution? The operator has
 * explicitly chosen to re-attempt the sync.
 */
export function getRetryableItems(queue: QueuedCharge[]): QueuedCharge[] {
  return queue.filter(
    (q) =>
      q.syncStatus === "error" ||
      (q.syncStatus === "conflict" && q.conflictResolution === "retry")
  );
}

// ---------------------------------------------------------------------------
// 9. purgeCompleted
// ---------------------------------------------------------------------------

/**
 * Removes synced items that were completed before the `olderThan` cutoff.
 *
 * Why keep recent synced items? They serve as a local receipt log for
 * the operator until the cutoff window expires.
 */
export function purgeCompleted(
  queue: QueuedCharge[],
  olderThan: string
): QueuedCharge[] {
  const cutoff = new Date(olderThan).getTime();

  return queue.filter((q) => {
    // Keep anything that is not synced
    if (q.syncStatus !== "synced") return true;

    // Keep synced items newer than the cutoff
    const syncedAt = q.lastAttemptAt
      ? new Date(q.lastAttemptAt).getTime()
      : new Date(q.queuedAt).getTime();

    return syncedAt >= cutoff;
  });
}

// ---------------------------------------------------------------------------
// 10. sortByPriority
// ---------------------------------------------------------------------------

/**
 * Returns a new array sorted by priority (high → normal → low),
 * then by queue time (oldest first within the same priority).
 */
export function sortByPriority(queue: QueuedCharge[]): QueuedCharge[] {
  return [...queue].sort((a, b) => {
    const pw = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
    if (pw !== 0) return pw;
    return new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime();
  });
}
