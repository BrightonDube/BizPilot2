/**
 * BizPilot Mobile POS — Permission Sync Handler (Task 15.2)
 *
 * Transforms the server's permission payload into a local
 * PermissionsRecord and manages create/update logic.
 *
 * Why a standalone sync function instead of embedding in SyncService?
 * Permissions sync has unique requirements: it must run on every
 * sync cycle (not just on data changes), and it must upsert a
 * single record per business rather than merging a list of entities.
 * Keeping it separate avoids polluting the generic sync pipeline.
 *
 * Why JSON.stringify for grantedFeatures?
 * WatermelonDB stores columns as primitives (string, number, boolean).
 * We serialize the features array to JSON for storage and parse it
 * back in hasFeature(). This avoids needing a join table for a
 * read-heavy, write-rare dataset.
 */

import type {
  PermissionsRecord,
  PermissionsSyncPayload,
} from "./PermissionsModel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Result of a permission sync operation.
 */
export interface PermissionSyncResult {
  /** Whether the sync completed without errors */
  success: boolean;
  /** "created" if a new record was inserted, "updated" if existing was modified, "unchanged" if no diff */
  action: "created" | "updated" | "unchanged";
  /** The resulting permissions record */
  record: PermissionsRecord;
  /** Error message if sync failed */
  error?: string;
}

/**
 * Storage adapter interface for decoupling from WatermelonDB.
 *
 * Why an adapter instead of importing WatermelonDB directly?
 * 1. Tests can use an in-memory implementation without WatermelonDB runtime
 * 2. The sync handler logic is testable as a pure function
 * 3. Future migration away from WatermelonDB requires only a new adapter
 */
export interface PermissionsStorage {
  /** Find the existing permissions record for a business, or null */
  findByBusinessId(businessId: string): Promise<PermissionsRecord | null>;
  /** Create a new permissions record */
  create(record: Omit<PermissionsRecord, "id">): Promise<PermissionsRecord>;
  /** Update an existing permissions record */
  update(
    id: string,
    changes: Partial<Omit<PermissionsRecord, "id">>
  ): Promise<PermissionsRecord>;
}

// ---------------------------------------------------------------------------
// Sync handler
// ---------------------------------------------------------------------------

/**
 * Sync permissions from the server payload into local storage.
 *
 * This function is idempotent — calling it multiple times with the
 * same payload produces the same result. If the data hasn't changed,
 * it returns "unchanged" without writing to the database.
 *
 * @param storage - Storage adapter (WatermelonDB or in-memory for tests)
 * @param payload - Server's permission response from /api/permissions/me
 * @param now - Current ISO timestamp for syncedAt field (injectable for tests)
 */
export async function syncPermissions(
  storage: PermissionsStorage,
  payload: PermissionsSyncPayload,
  now?: string
): Promise<PermissionSyncResult> {
  const syncedAt = now ?? new Date().toISOString();
  const grantedFeaturesJson = JSON.stringify(payload.grantedFeatures);

  try {
    const existing = await storage.findByBusinessId(payload.businessId);

    if (!existing) {
      // First sync — create the record
      const record = await storage.create({
        businessId: payload.businessId,
        grantedFeatures: grantedFeaturesJson,
        tier: payload.tier,
        status: payload.status,
        demoExpiresAt: payload.demoExpiresAt ?? "",
        deviceLimit: payload.deviceLimit,
        syncedAt,
      });

      return { success: true, action: "created", record };
    }

    // Check if anything changed to avoid unnecessary writes
    const hasChanged =
      existing.grantedFeatures !== grantedFeaturesJson ||
      existing.tier !== payload.tier ||
      existing.status !== payload.status ||
      existing.demoExpiresAt !== (payload.demoExpiresAt ?? "") ||
      existing.deviceLimit !== payload.deviceLimit;

    if (!hasChanged) {
      // Update only syncedAt to record that we checked
      const record = await storage.update(existing.id, { syncedAt });
      return { success: true, action: "unchanged", record };
    }

    // Data changed — full update
    const record = await storage.update(existing.id, {
      grantedFeatures: grantedFeaturesJson,
      tier: payload.tier,
      status: payload.status,
      demoExpiresAt: payload.demoExpiresAt ?? "",
      deviceLimit: payload.deviceLimit,
      syncedAt,
    });

    return { success: true, action: "updated", record };
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown sync error";

    // Return a fallback record so callers have something to work with
    const fallbackRecord: PermissionsRecord = {
      id: "sync-error",
      businessId: payload.businessId,
      grantedFeatures: grantedFeaturesJson,
      tier: payload.tier,
      status: payload.status,
      demoExpiresAt: payload.demoExpiresAt ?? "",
      deviceLimit: payload.deviceLimit,
      syncedAt: "",
    };

    return {
      success: false,
      action: "unchanged",
      record: fallbackRecord,
      error: errorMessage,
    };
  }
}

// ---------------------------------------------------------------------------
// In-memory storage adapter (for tests and offline fallback)
// ---------------------------------------------------------------------------

/**
 * Simple in-memory implementation of PermissionsStorage.
 *
 * Why export this?
 * 1. Used directly in unit/integration tests
 * 2. Serves as a fallback if WatermelonDB isn't initialized yet
 *    (e.g., during app cold start before DB migration completes)
 */
export class InMemoryPermissionsStorage implements PermissionsStorage {
  private records: Map<string, PermissionsRecord> = new Map();
  private nextId = 1;

  async findByBusinessId(
    businessId: string
  ): Promise<PermissionsRecord | null> {
    for (const record of this.records.values()) {
      if (record.businessId === businessId) return { ...record };
    }
    return null;
  }

  async create(
    data: Omit<PermissionsRecord, "id">
  ): Promise<PermissionsRecord> {
    const id = `perm-${this.nextId++}`;
    const record: PermissionsRecord = { id, ...data };
    this.records.set(id, record);
    return { ...record };
  }

  async update(
    id: string,
    changes: Partial<Omit<PermissionsRecord, "id">>
  ): Promise<PermissionsRecord> {
    const existing = this.records.get(id);
    if (!existing) throw new Error(`Record not found: ${id}`);
    const updated = { ...existing, ...changes };
    this.records.set(id, updated);
    return { ...updated };
  }

  /** Clear all records (useful in test teardown) */
  clear(): void {
    this.records.clear();
    this.nextId = 1;
  }

  /** Get all records (useful for test assertions) */
  getAll(): PermissionsRecord[] {
    return Array.from(this.records.values()).map((r) => ({ ...r }));
  }
}
