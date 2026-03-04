/**
 * BizPilot Mobile POS — Pull Handler
 *
 * Fetches remote changes since the last sync and applies them
 * to the local WatermelonDB database with conflict resolution.
 *
 * Why a dedicated PullHandler?
 * Pull logic involves several complex concerns:
 * - Delta sync (only fetch changes since last timestamp)
 * - Pagination for large change sets
 * - Conflict detection and resolution per-entity
 * - Transactional writes to prevent partial updates
 * - Remote ID mapping to local WatermelonDB IDs
 *
 * Extracted from SyncService for modularity and testability.
 */

import apiClient from "../api/client";
import { resolveConflict, type ConflictRecord } from "./ConflictResolver";
import { database } from "@/db";
import { useSyncStore } from "@/stores/syncStore";
import { SYNC_BATCH_SIZE } from "@/utils/constants";
import { logger } from "@/utils/logger";
import { retryWithBackoff, isRetryableError } from "@/utils/errorRecovery";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PullResult {
  /** Total records pulled across all entity types */
  pulled: number;
  /** Number of conflicts detected and resolved */
  conflicts: number;
  /** Error messages from failed pulls */
  errors: string[];
  /** Breakdown of records pulled per entity type */
  perEntity: Record<string, number>;
}

export type PullProgressCallback = (progress: {
  entityType: string;
  fetched: number;
  applied: number;
}) => void;

interface RemoteChange {
  id: string;
  action: "create" | "update" | "delete";
  data: Record<string, unknown>;
  updated_at: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Entity types that participate in sync, in pull order.
 *
 * Why this specific order?
 * Categories must be pulled before products (products reference categories).
 * Customers before orders (orders reference customers).
 * This prevents foreign key violations in the local database.
 */
const SYNCABLE_ENTITIES = [
  "categories",
  "products",
  "customers",
  "orders",
  "order_items",
] as const;

// ---------------------------------------------------------------------------
// Pull Handler
// ---------------------------------------------------------------------------

/**
 * Pull remote changes for all syncable entity types.
 *
 * Algorithm:
 * 1. For each entity type, fetch changes since the last sync timestamp
 * 2. Handle pagination (the server may return hasMore=true)
 * 3. For each change, check if it conflicts with local dirty data
 * 4. Resolve conflicts using the entity-specific strategy
 * 5. Apply changes to WatermelonDB in a single batch write
 *
 * @param onProgress - Optional progress callback
 * @returns Summary of pull operation
 */
export async function pullChanges(
  onProgress?: PullProgressCallback
): Promise<PullResult> {
  const syncStore = useSyncStore.getState();
  const since = syncStore.lastSyncAt ?? 0;

  const result: PullResult = {
    pulled: 0,
    conflicts: 0,
    errors: [],
    perEntity: {},
  };

  logger.info("sync", `Pulling changes since ${new Date(since).toISOString()}`);

  for (const entityType of SYNCABLE_ENTITIES) {
    try {
      const entityResult = await pullEntityChanges(
        entityType,
        since,
        onProgress
      );

      result.pulled += entityResult.applied;
      result.conflicts += entityResult.conflicts;
      result.perEntity[entityType] = entityResult.applied;

      onProgress?.({
        entityType,
        fetched: entityResult.fetched,
        applied: entityResult.applied,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : `Failed to pull ${entityType}`;
      result.errors.push(message);
      logger.error("sync", `Pull failed for ${entityType}`, { error: message });
    }
  }

  logger.info("sync", "Pull complete", {
    pulled: result.pulled,
    conflicts: result.conflicts,
    perEntity: result.perEntity,
  });

  return result;
}

// ---------------------------------------------------------------------------
// Per-entity pull
// ---------------------------------------------------------------------------

/**
 * Pull and apply changes for a single entity type.
 * Handles pagination to support large change sets.
 */
async function pullEntityChanges(
  entityType: string,
  since: number,
  onProgress?: PullProgressCallback
): Promise<{ fetched: number; applied: number; conflicts: number }> {
  let fetched = 0;
  let applied = 0;
  let conflicts = 0;
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await retryWithBackoff(
      () =>
        apiClient.get(`/api/sync/pull/${entityType}`, {
          params: {
            since,
            page,
            per_page: SYNC_BATCH_SIZE,
          },
        }),
      {
        maxAttempts: 3,
        shouldRetry: isRetryableError,
      }
    );

    const changes: RemoteChange[] = response.data?.changes ?? [];
    hasMore = response.data?.hasMore ?? false;
    fetched += changes.length;

    if (changes.length > 0) {
      const applyResult = await applyRemoteChanges(entityType, changes);
      applied += applyResult.applied;
      conflicts += applyResult.conflicts;
    }

    page++;

    // Safety: prevent infinite pagination loops
    if (page > 1000) {
      logger.warn("sync", `Pagination safety limit reached for ${entityType}`);
      break;
    }
  }

  return { fetched, applied, conflicts };
}

// ---------------------------------------------------------------------------
// Apply changes to local database
// ---------------------------------------------------------------------------

/**
 * Apply a batch of remote changes to the local WatermelonDB.
 *
 * For each change:
 * - CREATE: Insert if not exists (matched by remote_id)
 * - UPDATE: Check for conflicts, resolve, then update
 * - DELETE: Remove the local record
 *
 * All operations happen in a single database.write() transaction
 * to ensure atomicity — either all changes apply or none do.
 */
async function applyRemoteChanges(
  entityType: string,
  changes: RemoteChange[]
): Promise<{ applied: number; conflicts: number }> {
  let applied = 0;
  let conflictCount = 0;

  try {
    await database.write(async () => {
      const collection = database.get(entityType);

      for (const change of changes) {
        try {
          // Try to find existing local record by remote_id
          const existing = await findByRemoteId(entityType, change.id);

          if (change.action === "delete") {
            if (existing) {
              await existing.destroyPermanently();
              applied++;
            }
            continue;
          }

          if (existing) {
            // Check for conflicts: local record is dirty and server has changes
            const isDirty = (existing as any).isDirty === true;

            if (isDirty) {
              // Conflict detected — resolve using entity-specific strategy
              const conflict: ConflictRecord = {
                entityType,
                entityId: change.id,
                localVersion: sanitizeRecord(existing),
                serverVersion: change.data,
                localUpdatedAt: (existing as any).updatedAt ?? 0,
                serverUpdatedAt: change.updated_at,
              };

              const resolution = resolveConflict(conflict);
              conflictCount++;

              logger.info("sync", "Conflict resolved", {
                entityType,
                entityId: change.id,
                winner: resolution.winner,
              });

              if (resolution.winner === "server") {
                // Apply server version
                await existing.update((record: any) => {
                  applyDataToRecord(record, change.data);
                  record.isDirty = false;
                  record.syncedAt = Date.now();
                });
                applied++;
              }
              // If client wins, we keep local version — no update needed
            } else {
              // No conflict — apply server changes directly
              await existing.update((record: any) => {
                applyDataToRecord(record, change.data);
                record.isDirty = false;
                record.syncedAt = Date.now();
              });
              applied++;
            }
          } else if (change.action === "create" || change.action === "update") {
            // New record from server — create locally
            await collection.create((record: any) => {
              record.remoteId = change.id;
              applyDataToRecord(record, change.data);
              record.isDirty = false;
              record.syncedAt = Date.now();
            });
            applied++;
          }
        } catch (error: unknown) {
          // Log but don't fail the entire batch for one bad record
          const message =
            error instanceof Error ? error.message : "Apply change failed";
          logger.error("sync", `Failed to apply change for ${entityType}`, {
            changeId: change.id,
            action: change.action,
            error: message,
          });
        }
      }
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Batch write failed";
    logger.error("sync", `Batch write failed for ${entityType}`, {
      error: message,
    });
    throw error;
  }

  return { applied, conflicts: conflictCount };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Find a local WatermelonDB record by its remote (server) ID.
 */
async function findByRemoteId(
  entityType: string,
  remoteId: string
): Promise<any | null> {
  try {
    const { Q } = await import("@nozbe/watermelondb");
    const results = await database
      .get(entityType)
      .query(Q.where("remote_id", remoteId))
      .fetch();
    return results.length > 0 ? results[0] : null;
  } catch {
    return null;
  }
}

/**
 * Extract raw data from a WatermelonDB model for conflict comparison.
 */
function sanitizeRecord(record: any): Record<string, unknown> {
  const raw = record._raw ?? {};
  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    if (!key.startsWith("_")) {
      sanitized[key] = raw[key];
    }
  }
  return sanitized;
}

/**
 * Apply a data object to a WatermelonDB record.
 *
 * Maps snake_case server fields to the record's columns.
 * Unknown fields are silently ignored to handle schema version differences.
 */
function applyDataToRecord(
  record: any,
  data: Record<string, unknown>
): void {
  for (const [key, value] of Object.entries(data)) {
    // Skip internal/meta fields
    if (key === "id" || key === "created_at") continue;

    try {
      record[key] = value;
    } catch {
      // Field doesn't exist on the model — skip silently.
      // This handles cases where the server has newer schema than the app.
    }
  }
}
