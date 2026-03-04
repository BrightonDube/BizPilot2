/**
 * BizPilot Mobile POS — Push Handler
 *
 * Processes the local sync queue and pushes changes to the server
 * in batches with retry logic and exponential backoff.
 *
 * Why a dedicated PushHandler class?
 * Push logic is complex enough to warrant its own module:
 * - Batch processing to avoid overwhelming the API
 * - Per-entry retry with exponential backoff
 * - Dead letter queue for permanently failed entries
 * - Remote ID mapping for newly created records
 * - Progress reporting for UI feedback
 *
 * Extracted from SyncService to keep each module focused.
 */

import {
  getPendingEntries,
  markProcessed,
  markFailed,
  purgeProcessed,
} from "./SyncQueue";
import apiClient from "../api/client";
import {
  SYNC_BATCH_SIZE,
  SYNC_MAX_RETRIES,
  SYNC_RETRY_BASE_DELAY_MS,
} from "@/utils/constants";
import { logger } from "@/utils/logger";
import { retryWithBackoff, isRetryableError } from "@/utils/errorRecovery";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PushResult {
  /** Number of entries successfully pushed */
  pushed: number;
  /** Number of entries that failed */
  failed: number;
  /** Number of entries skipped (exceeded max retries) */
  skippedDeadLetter: number;
  /** Error messages from failed pushes */
  errors: string[];
  /** Remote ID mappings for newly created records */
  remoteIdMap: Map<string, string>;
}

export type PushProgressCallback = (progress: {
  current: number;
  total: number;
  entityType: string;
}) => void;

// ---------------------------------------------------------------------------
// Push Handler
// ---------------------------------------------------------------------------

/**
 * Push all pending local changes to the server.
 *
 * Processing order:
 * 1. Fetch all unprocessed queue entries (oldest first)
 * 2. Skip entries that have exceeded max retries (dead letter)
 * 3. Process in batches of SYNC_BATCH_SIZE
 * 4. For each entry, POST to /api/sync/push
 * 5. On success: mark processed, record remote_id if returned
 * 6. On failure: increment attempts, record error
 *
 * @param onProgress - Optional callback for progress tracking
 * @returns Summary of push operation
 */
export async function pushChanges(
  onProgress?: PushProgressCallback
): Promise<PushResult> {
  const entries = await getPendingEntries();
  const result: PushResult = {
    pushed: 0,
    failed: 0,
    skippedDeadLetter: 0,
    errors: [],
    remoteIdMap: new Map(),
  };

  if (entries.length === 0) {
    logger.debug("sync", "No pending entries to push");
    return result;
  }

  logger.info("sync", `Pushing ${entries.length} pending entries`);

  // Process in batches
  for (let i = 0; i < entries.length; i += SYNC_BATCH_SIZE) {
    const batch = entries.slice(i, i + SYNC_BATCH_SIZE);

    for (const entry of batch) {
      // Dead letter: skip entries that have exhausted all retries
      if (entry.attempts >= SYNC_MAX_RETRIES) {
        result.skippedDeadLetter++;
        logger.warn("sync", "Skipping dead letter entry", {
          entityType: entry.entityType,
          entityId: entry.entityId,
          attempts: entry.attempts,
          lastError: entry.lastError,
        });
        continue;
      }

      try {
        const payload = JSON.parse(entry.payload);

        // Report progress
        onProgress?.({
          current: i + batch.indexOf(entry) + 1,
          total: entries.length,
          entityType: entry.entityType,
        });

        const response = await retryWithBackoff(
          () =>
            apiClient.post("/api/sync/push", {
              entity_type: entry.entityType,
              entity_id: entry.entityId,
              action: entry.action,
              data: payload,
            }),
          {
            maxAttempts: 2,
            baseDelay: SYNC_RETRY_BASE_DELAY_MS,
            shouldRetry: isRetryableError,
          }
        );

        // Mark as processed
        await markProcessed(entry);
        result.pushed++;

        // Store remote ID mapping for newly created records
        const remoteId = response.data?.remote_id;
        if (remoteId && entry.action === "create") {
          result.remoteIdMap.set(entry.entityId, remoteId);
        }

        logger.debug("sync", "Pushed entry", {
          entityType: entry.entityType,
          entityId: entry.entityId,
          action: entry.action,
        });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Push failed";
        await markFailed(entry, message);
        result.failed++;
        result.errors.push(
          `${entry.entityType}/${entry.entityId}: ${message}`
        );

        logger.error("sync", "Failed to push entry", {
          entityType: entry.entityType,
          entityId: entry.entityId,
          error: message,
          attempt: entry.attempts + 1,
        });
      }
    }
  }

  // Report dead letter entries
  if (result.skippedDeadLetter > 0) {
    logger.warn(
      "sync",
      `${result.skippedDeadLetter} entries in dead letter queue`
    );
  }

  logger.info("sync", "Push complete", {
    pushed: result.pushed,
    failed: result.failed,
    deadLetter: result.skippedDeadLetter,
  });

  return result;
}

/**
 * Get entries that have permanently failed (dead letter queue).
 * These need manual intervention or will be purged after 7 days.
 */
export async function getDeadLetterEntries() {
  const entries = await getPendingEntries();
  return entries.filter((e) => e.attempts >= SYNC_MAX_RETRIES);
}

/**
 * Purge old processed entries to free up database space.
 * Default: remove entries processed more than 7 days ago.
 */
export async function cleanupProcessedEntries(
  olderThanDays: number = 7
): Promise<void> {
  const olderThanMs = olderThanDays * 24 * 60 * 60 * 1000;
  await purgeProcessed(olderThanMs);
  logger.info("sync", `Purged processed entries older than ${olderThanDays} days`);
}
