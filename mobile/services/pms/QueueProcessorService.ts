/**
 * QueueProcessorService — Pure functions for processing the offline charge queue.
 *
 * Why a separate service from ChargeQueueService?
 * ChargeQueueService manages the queue data structure (enqueue, dequeue, sort).
 * QueueProcessorService manages the processing lifecycle — deciding what to
 * process, enforcing limits, and orchestrating retry logic.
 *
 * This separation keeps each service focused and testable.
 * Every function is pure — no side-effects, no hidden state.
 */

import type { QueuedCharge, QueuePriority } from "./ChargeQueueService";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Maximum queue size. Beyond this, new charges are rejected. */
export const MAX_QUEUE_SIZE = 100;

/** Maximum age for a queued charge before it's flagged for review (24 hours). */
export const MAX_QUEUE_AGE_MS = 24 * 60 * 60 * 1000;

/** Maximum number of retry attempts before flagging for manual review. */
export const MAX_RETRY_ATTEMPTS = 5;

/** Delay between retries in ms (exponential backoff base). */
export const RETRY_BASE_DELAY_MS = 2000;

/** Batch size for processing queued charges. */
export const PROCESS_BATCH_SIZE = 5;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProcessingResult {
  /** Items that were successfully processed */
  succeeded: QueuedCharge[];
  /** Items that failed and should be retried */
  failed: QueuedCharge[];
  /** Items flagged for manual review (too old or too many retries) */
  flagged: QueuedCharge[];
}

export interface QueueLimitCheck {
  /** Whether the queue accepts new items */
  canEnqueue: boolean;
  /** Reason if canEnqueue is false */
  reason: string | null;
  /** Current queue size */
  currentSize: number;
  /** Number of items over the age limit */
  staleCount: number;
}

// ---------------------------------------------------------------------------
// 1. checkQueueLimits
// ---------------------------------------------------------------------------

/**
 * Checks whether the queue can accept new charges.
 * Enforces both size and age limits (tasks 25.5).
 */
export function checkQueueLimits(
  queue: QueuedCharge[],
  maxSize: number = MAX_QUEUE_SIZE,
  maxAgeMs: number = MAX_QUEUE_AGE_MS,
  now: Date = new Date()
): QueueLimitCheck {
  const activeItems = queue.filter(
    (q) => q.syncStatus === "queued" || q.syncStatus === "syncing"
  );

  const nowMs = now.getTime();
  const staleItems = queue.filter((q) => {
    const queuedMs = new Date(q.queuedAt).getTime();
    return nowMs - queuedMs > maxAgeMs && q.syncStatus === "queued";
  });

  if (activeItems.length >= maxSize) {
    return {
      canEnqueue: false,
      reason: `Queue is full (${activeItems.length}/${maxSize}). Process or clear existing charges first.`,
      currentSize: activeItems.length,
      staleCount: staleItems.length,
    };
  }

  return {
    canEnqueue: true,
    reason: null,
    currentSize: activeItems.length,
    staleCount: staleItems.length,
  };
}

// ---------------------------------------------------------------------------
// 2. getNextBatch
// ---------------------------------------------------------------------------

/**
 * Returns the next batch of charges to process, sorted by priority.
 *
 * Why batch processing instead of one-at-a-time?
 * Network round-trips are expensive. Processing in small batches
 * (default: 5) reduces connection overhead while keeping individual
 * failures isolated.
 */
export function getNextBatch(
  queue: QueuedCharge[],
  batchSize: number = PROCESS_BATCH_SIZE
): QueuedCharge[] {
  const PRIORITY_WEIGHT: Record<QueuePriority, number> = {
    high: 0,
    normal: 1,
    low: 2,
  };

  return [...queue]
    .filter((q) => q.syncStatus === "queued")
    .sort((a, b) => {
      const pw = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
      if (pw !== 0) return pw;
      return (
        new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime()
      );
    })
    .slice(0, batchSize);
}

// ---------------------------------------------------------------------------
// 3. calculateRetryDelay
// ---------------------------------------------------------------------------

/**
 * Calculates the retry delay using exponential backoff with jitter.
 *
 * Why jitter? Without it, all failed charges would retry at exactly
 * the same time, creating a thundering herd against the PMS API.
 */
export function calculateRetryDelay(
  attemptNumber: number,
  baseDelayMs: number = RETRY_BASE_DELAY_MS
): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attemptNumber - 1);
  // Cap at 60 seconds
  const cappedDelay = Math.min(exponentialDelay, 60_000);
  // Add ±25% jitter
  const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.round(cappedDelay + jitter);
}

// ---------------------------------------------------------------------------
// 4. shouldFlagForReview
// ---------------------------------------------------------------------------

/**
 * Determines if a queued charge should be escalated to manual review.
 *
 * Why flag instead of auto-retry forever? Infinite retries can cause
 * duplicate charges on the PMS. After MAX_RETRY_ATTEMPTS, a human
 * must verify the charge status before re-attempting.
 */
export function shouldFlagForReview(
  item: QueuedCharge,
  maxRetries: number = MAX_RETRY_ATTEMPTS,
  maxAgeMs: number = MAX_QUEUE_AGE_MS,
  now: Date = new Date()
): boolean {
  // Too many retries
  if (item.charge.attempts >= maxRetries) return true;

  // Too old
  const ageMs = now.getTime() - new Date(item.queuedAt).getTime();
  if (ageMs > maxAgeMs) return true;

  return false;
}

// ---------------------------------------------------------------------------
// 5. categorizeBatch
// ---------------------------------------------------------------------------

/**
 * After a batch of charges has been processed, categorizes them into
 * succeeded, failed, and flagged-for-review.
 *
 * This is the post-processing step after each network batch completes.
 */
export function categorizeBatch(
  items: QueuedCharge[],
  successIds: Set<string>,
  maxRetries: number = MAX_RETRY_ATTEMPTS,
  maxAgeMs: number = MAX_QUEUE_AGE_MS,
  now: Date = new Date()
): ProcessingResult {
  const succeeded: QueuedCharge[] = [];
  const failed: QueuedCharge[] = [];
  const flagged: QueuedCharge[] = [];

  for (const item of items) {
    if (successIds.has(item.id)) {
      succeeded.push(item);
    } else if (shouldFlagForReview(item, maxRetries, maxAgeMs, now)) {
      flagged.push(item);
    } else {
      failed.push(item);
    }
  }

  return { succeeded, failed, flagged };
}

// ---------------------------------------------------------------------------
// 6. getStaleItems
// ---------------------------------------------------------------------------

/**
 * Returns all queued items that have exceeded the maximum age.
 * These should be flagged in the UI for operator attention.
 */
export function getStaleItems(
  queue: QueuedCharge[],
  maxAgeMs: number = MAX_QUEUE_AGE_MS,
  now: Date = new Date()
): QueuedCharge[] {
  const cutoff = now.getTime() - maxAgeMs;

  return queue.filter(
    (q) =>
      q.syncStatus === "queued" &&
      new Date(q.queuedAt).getTime() < cutoff
  );
}

// ---------------------------------------------------------------------------
// 7. isQueueHealthy
// ---------------------------------------------------------------------------

/**
 * Quick health check for the queue. Returns false if there are
 * stale items, items stuck in syncing, or the queue is near capacity.
 */
export function isQueueHealthy(
  queue: QueuedCharge[],
  maxSize: number = MAX_QUEUE_SIZE,
  maxAgeMs: number = MAX_QUEUE_AGE_MS,
  now: Date = new Date()
): boolean {
  const limits = checkQueueLimits(queue, maxSize, maxAgeMs, now);

  // Unhealthy if full or has stale items
  if (!limits.canEnqueue || limits.staleCount > 0) return false;

  // Unhealthy if items are stuck in syncing (likely a crash during processing)
  const stuckSyncing = queue.filter((q) => q.syncStatus === "syncing");
  if (stuckSyncing.length > 0) return false;

  return true;
}

// ---------------------------------------------------------------------------
// 8. resetStuckItems
// ---------------------------------------------------------------------------

/**
 * Resets items stuck in "syncing" status back to "queued".
 *
 * Why? If the app crashes during queue processing, items can get
 * stuck in "syncing" state. This recovery function resets them
 * so they'll be retried on the next processing cycle.
 */
export function resetStuckItems(queue: QueuedCharge[]): QueuedCharge[] {
  return queue.map((q) =>
    q.syncStatus === "syncing" ? { ...q, syncStatus: "queued" as const } : q
  );
}
