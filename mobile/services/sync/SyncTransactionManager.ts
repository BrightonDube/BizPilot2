/**
 * SyncTransactionManager — pre-flight validation and atomic DB writes for sync.
 *
 * Addresses offline-sync-engine tasks 13.1–13.4:
 *   13.1  Implement database transactions for sync
 *   13.2  Implement rollback on partial failures
 *   13.3  Add data validation before applying changes
 *   13.4  Handle schema version mismatches
 *
 * Why a separate module instead of embedding this in PullHandler?
 * PullHandler already owns the HTTP/pagination logic; mixing in validation
 * and transaction wrappers would make it a 500-line class that's hard to test
 * in isolation.  Separating concerns lets us:
 *   - Unit-test validation rules without mocking the network
 *   - PBT the "all-or-nothing" property with a tiny fake applyFn
 *   - Reuse validation in future import / bulk-edit flows
 */

import { database } from "@/db";
import { logger } from "@/utils/logger";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The WatermelonDB schema version this build of the app understands.
 * Must stay in sync with the `version` field in db/schema.ts.
 *
 * Why hard-coded here rather than imported from schema.ts?
 * The schema file imports WatermelonDB and triggers native module init.
 * Tests that mock @/db don't want that side-effect.  A numeric constant
 * is safe to import anywhere.
 */
export const LOCAL_SCHEMA_VERSION = 5;

// ---------------------------------------------------------------------------
// Per-entity required fields (for validation before DB write)
//
// Only truly required fields are listed — anything that could be absent for
// a valid business reason is left off.  Overly strict validation would reject
// legitimate server records, breaking the sync for the whole batch.
// ---------------------------------------------------------------------------

const ENTITY_REQUIRED_FIELDS: Readonly<Record<string, readonly string[]>> = {
  products: ["name"],
  categories: ["name"],
  orders: [],
  order_items: ["order_id", "product_id"],
  customers: [],
  users: [],
  payments: ["order_id", "payment_method", "amount"],
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RemoteChangeBasic {
  id: string;
  action: "create" | "update" | "delete";
  data: Record<string, unknown>;
}

export interface ValidationError {
  changeId: string;
  entityType: string;
  field: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Validation (task 13.3)
// ---------------------------------------------------------------------------

/**
 * Validate a single remote change.
 * Returns `null` when valid, or a ValidationError when a required field is
 * missing/empty.
 *
 * Why validate before writing instead of relying on DB constraints?
 * SQLite constraints throw at the DB layer, which would abort the whole
 * `database.write()` transaction — that's actually desirable for atomicity,
 * but the error message would be opaque.  Pre-flight validation gives us
 * actionable log messages and lets us reject a bad batch BEFORE touching
 * the DB at all.
 */
export function validateChange(
  entityType: string,
  change: RemoteChangeBasic
): ValidationError | null {
  // DELETE operations carry no data payload — nothing to validate
  if (change.action === "delete") return null;

  const required = ENTITY_REQUIRED_FIELDS[entityType] ?? [];

  for (const field of required) {
    const value = change.data[field];
    if (value === undefined || value === null || value === "") {
      return {
        changeId: change.id,
        entityType,
        field,
        message:
          `Required field '${field}' is missing or empty ` +
          `in ${entityType} change ${change.id}`,
      };
    }
  }

  return null;
}

/**
 * Validate every change in a batch, returning ALL validation errors found.
 *
 * Why return all errors instead of failing fast?
 * Collecting every invalid change lets the caller (and the server) know about
 * all broken records in one round-trip, speeding up debugging.
 */
export function validateBatch(
  entityType: string,
  changes: RemoteChangeBasic[]
): ValidationError[] {
  return changes.reduce<ValidationError[]>((errors, change) => {
    const err = validateChange(entityType, change);
    if (err) errors.push(err);
    return errors;
  }, []);
}

// ---------------------------------------------------------------------------
// Schema version check (task 13.4)
// ---------------------------------------------------------------------------

/**
 * Verify that the server's schema version is not newer than what this build
 * of the app understands.
 *
 * Why check the server schema version?
 * If the server has been migrated to schema v6 but the app is still on v5,
 * new columns may be present in the server payload that we'd silently drop.
 * Worse, renamed / removed columns could overwrite local data with nulls.
 * Refusing to sync until the user updates the app is safer than silent
 * data corruption.
 *
 * @throws Error when serverSchemaVersion > LOCAL_SCHEMA_VERSION
 */
export function checkServerSchemaVersion(serverSchemaVersion: number): void {
  if (serverSchemaVersion > LOCAL_SCHEMA_VERSION) {
    const message =
      `Schema version mismatch: server=${serverSchemaVersion}, ` +
      `local=${LOCAL_SCHEMA_VERSION}. Please update the app to continue syncing.`;
    logger.error("sync", message, { serverSchemaVersion, LOCAL_SCHEMA_VERSION });
    throw new Error(message);
  }
}

// ---------------------------------------------------------------------------
// Atomic batch apply (tasks 13.1 + 13.2)
// ---------------------------------------------------------------------------

/**
 * Apply a batch of pre-validated changes inside a single WatermelonDB
 * transaction.
 *
 * Contract:
 *   • BEFORE calling this, run `validateBatch` and handle any errors.
 *   • If `applyFn` throws for ANY change, the entire `database.write()`
 *     transaction is rolled back by WatermelonDB — no partial state.
 *   • Returns the number of changes applied.
 *
 * Why delegate the actual write logic to `applyFn`?
 * The caller (PullHandler) already knows how to create/update/delete
 * WatermelonDB records.  This wrapper adds only the transaction boundary and
 * rollback guarantee.  Injecting `applyFn` also makes this testable without
 * a real SQLite DB.
 *
 * Why throw (not catch) inside database.write?
 * WatermelonDB documents that throwing inside the `write` callback causes
 * the SQLite transaction to roll back.  Catching the error here and returning
 * a partial count would hide data-integrity problems.
 */
export async function applyBatchTransactional(
  entityType: string,
  changes: RemoteChangeBasic[],
  applyFn: (change: RemoteChangeBasic) => Promise<void>
): Promise<number> {
  if (changes.length === 0) return 0;

  // All DB writes happen in a single atomic transaction.
  // If ANY write fails the whole batch is rolled back.
  await database.write(async () => {
    for (const change of changes) {
      await applyFn(change);
    }
  });

  logger.info("sync", `Applied ${changes.length} ${entityType} changes transactionally`);
  return changes.length;
}
